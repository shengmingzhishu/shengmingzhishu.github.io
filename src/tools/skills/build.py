#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build.py - 构建 tools/skills/skill.html

流程:
  1. 扫描 skills-doc/*/*.txt(由 .md 重命名而来),解析 frontmatter
     (name/description)与首个 # 标题。
  2. 把所有 skill 的元数据 + 全文内容以 JSON 内联到 skill.html。

(.md -> .txt 的重命名是一次性操作,不在本脚本内完成;本脚本只读取 .txt,
 因此可反复运行:新增/编辑 .txt 后重新执行即可。)

数据思路参考 tools/image-layout/image-text-layout-v11.html:
  - 维护一个「文件列表」(skillFiles: name/path/title/desc)
  - 维护一个「内联内容映射」(skillContent: slug -> 全文)
  - 运行时优先 fetch .txt(http 环境下编辑即时生效),
    file:// 下 fetch 受限则回退到内联内容(避免跨域)。
  - md 预览沿用 skill.html 既有的完整 markdown 渲染器
    (标题/列表/表格/代码块/引用/行内格式),并参考 v11 的行内代码样式。

用法:  python build.py
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DOC_DIR = os.path.join(HERE, 'skills-doc')


def parse_frontmatter(text):
    """返回 (frontmatter_dict, body)。frontmatter 形如:
       ---\n name: xx\n description: "yy"\n ---\n
    """
    m = re.match(r'^﻿?---\s*\n(.*?)\n---\s*\n?(.*)$', text, re.S)
    if not m:
        return {}, text
    fm_text, body = m.group(1), m.group(2)
    fm = {}
    for line in fm_text.splitlines():
        mm = re.match(r'^(\w+)\s*:\s*(.*)$', line)
        if not mm:
            continue
        val = mm.group(2).strip()
        if (val.startswith('"') and val.endswith('"')) or (val.startswith("'") and val.endswith("'")):
            val = val[1:-1]
        fm[mm.group(1)] = val
    return fm, body


def extract_title(body):
    """取正文中第一个 # 标题文本。"""
    for line in body.splitlines():
        s = line.strip()
        if re.match(r'^#{1,6}\s+', s):
            return re.sub(r'^#+\s+', '', s).strip()
    return ''


def collect_skills():
    """遍历 skills-doc,读取每个 .txt,返回 skill 列表。"""
    skills = []
    for dirpath, _dirs, files in os.walk(DOC_DIR):
        for fn in sorted(files):
            if not fn.endswith('.txt'):
                continue
            txt_path = os.path.join(dirpath, fn)
            with open(txt_path, 'r', encoding='utf-8') as f:
                text = f.read()
            fm, body = parse_frontmatter(text)
            slug = fm.get('name') or os.path.basename(dirpath)
            desc = fm.get('description', '')
            title = extract_title(body) or slug

            rel_dir = os.path.relpath(dirpath, HERE).replace('\\', '/')
            txt_rel = rel_dir + '/' + fn

            skills.append({
                'slug': slug,
                'name': fn,
                'title': title,
                'desc': desc,
                'file': txt_rel,
                'raw': text,
            })
    skills.sort(key=lambda s: s['slug'])
    return skills


# ---------------------------------------------------------------------------
# skill.html 模板。__SKILL_DATA__ 由 JSON 替换。
# markdown 渲染器用 @@TOKEN@@ 形式的哨兵占位(可打印、不与正文冲突):
# 行内元素先替换为哨兵,转义正文后再还原,避免代码/链接内部被二次处理。
# ---------------------------------------------------------------------------
TEMPLATE = r'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Skills 技能文档</title>
<style>
:root{
  --bg:#f4f6fa; --card:#ffffff; --text:#1f2937; --muted:#6b7280;
  --primary:#2563eb; --primary-dark:#1d4ed8; --primary-soft:#dbeafe;
  --border:#e5e7eb; --code-bg:#0f172a; --code-text:#e2e8f0; --code-border:#1e293b;
  --shadow:0 1px 3px rgba(0,0,0,.06),0 1px 2px rgba(0,0,0,.04);
  --shadow-hover:0 10px 25px rgba(37,99,235,.12),0 4px 10px rgba(0,0,0,.06);
}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;
  background:var(--bg);color:var(--text);line-height:1.6;-webkit-font-smoothing:antialiased}
a{color:var(--primary);text-decoration:none}
a:hover{color:var(--primary-dark)}

/* 顶栏 */
.topbar{position:sticky;top:0;z-index:10;background:rgba(255,255,255,.92);backdrop-filter:blur(8px);
  border-bottom:1px solid var(--border)}
.topbar-inner{max-width:1100px;margin:0 auto;padding:14px 24px;display:flex;align-items:center;gap:16px}
.topbar h1{font-size:18px;margin:0;flex:0 0 auto;font-weight:700}
.search-wrap{margin-left:auto;display:flex;align-items:center;gap:10px}
#search{width:220px;padding:7px 12px;border:1px solid var(--border);border-radius:8px;font-size:14px;
  outline:none;transition:border-color .15s,box-shadow .15s;background:#fff}
#search:focus{border-color:var(--primary);box-shadow:0 0 0 3px var(--primary-soft)}
.count{font-size:13px;color:var(--muted);white-space:nowrap}

/* 返回栏 */
.detail-topbar .topbar-inner{justify-content:flex-start}
.back-btn{display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:8px;
  background:var(--primary-soft);color:var(--primary-dark);font-weight:600;font-size:14px;transition:background .15s}
.back-btn:hover{background:#bfdbfe}
.detail-file{font-family:"SFMono-Regular",Consolas,Menlo,monospace;font-size:13px;color:var(--muted);
  margin-left:4px;word-break:break-all}

/* 容器 */
.container{max-width:1100px;margin:0 auto;padding:28px 24px 60px}
.container-narrow{max-width:880px}

/* 列表 */
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px}
.card{display:flex;flex-direction:column;background:var(--card);border:1px solid var(--border);
  border-radius:12px;padding:18px 18px 14px;box-shadow:var(--shadow);transition:transform .15s,box-shadow .15s,border-color .15s;
  border-left:3px solid var(--primary);color:inherit;cursor:pointer}
.card:hover{transform:translateY(-3px);box-shadow:var(--shadow-hover);border-color:var(--primary)}
.card-head{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.card-badge{font-size:11px;font-weight:700;color:var(--primary-dark);background:var(--primary-soft);
  padding:2px 7px;border-radius:5px;letter-spacing:.5px}
.card-title{font-size:16px;margin:0;font-weight:700;color:var(--text);line-height:1.4}
.card-desc{font-size:13.5px;color:var(--muted);margin:0 0 14px;flex:1;
  display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.card-foot{display:flex;align-items:center;justify-content:space-between;border-top:1px dashed var(--border);padding-top:10px}
.card-file{font-size:12px;color:var(--muted);font-family:"SFMono-Regular",Consolas,Menlo,monospace;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:65%}
.card-go{font-size:13px;font-weight:600;color:var(--primary);white-space:nowrap}
.empty{text-align:center;color:var(--muted);padding:60px 0;font-size:15px}

/* markdown 正文 */
.markdown-body{font-size:15px;line-height:1.75}
.markdown-body h1{font-size:26px;margin:8px 0 18px;padding-bottom:10px;border-bottom:2px solid var(--border)}
.markdown-body h2{font-size:21px;margin:32px 0 14px;padding-bottom:8px;border-bottom:1px solid var(--border)}
.markdown-body h3{font-size:18px;margin:26px 0 12px}
.markdown-body h4{font-size:16px;margin:22px 0 10px}
.markdown-body h5,.markdown-body h6{font-size:14.5px;margin:18px 0 8px}
.markdown-body p{margin:0 0 14px}
.markdown-body ul,.markdown-body ol{margin:0 0 14px;padding-left:24px}
.markdown-body li{margin:4px 0}
.markdown-body li.task{list-style:none;margin-left:-20px}
.markdown-body li.task input{margin-right:6px}
.markdown-body blockquote{margin:0 0 14px;padding:8px 16px;border-left:4px solid var(--primary-soft);
  background:#f8fafc;color:#475569;border-radius:0 6px 6px 0}
.markdown-body blockquote p{margin:0}
.markdown-body hr{border:none;border-top:1px solid var(--border);margin:24px 0}
.markdown-body a{word-break:break-word}
.markdown-body strong{font-weight:700;color:#111827}
.markdown-body code{font-family:"SFMono-Regular",Consolas,Menlo,monospace;font-size:13px;
  background:#f1f5f9;color:#db2777;padding:1.5px 5px;border-radius:4px}
.markdown-body pre{background:var(--code-bg);border:1px solid var(--code-border);border-radius:10px;
  padding:16px 18px;overflow:auto;margin:0 0 16px;line-height:1.55}
.markdown-body pre code{background:none;color:var(--code-text);padding:0;font-size:13px;border:none;
  white-space:pre;display:block}
.markdown-body table{border-collapse:collapse;width:100%;margin:0 0 16px;font-size:14px;
  display:block;overflow:auto}
.markdown-body th,.markdown-body td{border:1px solid var(--border);padding:8px 12px;text-align:left}
.markdown-body th{background:#f8fafc;font-weight:700}
.markdown-body tr:nth-child(even) td{background:#fafbfc}
.markdown-body img{max-width:100%;border-radius:8px}
.loading{color:var(--muted);text-align:center;padding:40px 0;font-size:14px}
</style>
</head>
<body>
<div id="app">
  <!-- 列表页 -->
  <section id="list-view">
    <header class="topbar">
      <div class="topbar-inner">
        <h1>🛠️ Skills 技能文档</h1>
        <div class="search-wrap">
          <input id="search" type="text" placeholder="搜索技能名称 / 描述..." autocomplete="off">
          <span id="count" class="count"></span>
        </div>
      </div>
    </header>
    <main class="container">
      <div id="skill-list" class="grid"></div>
      <p id="empty" class="empty" hidden>没有匹配的技能</p>
    </main>
  </section>

  <!-- 详情页 -->
  <section id="detail-view" hidden>
    <header class="topbar detail-topbar">
      <div class="topbar-inner">
        <a href="#" id="back-btn" class="back-btn">← 返回列表</a>
        <span id="detail-file" class="detail-file"></span>
        <a id="raw-link" class="detail-file" target="_blank" rel="noopener" style="margin-left:auto">查看原始 .txt ↗</a>
      </div>
    </header>
    <main class="container container-narrow">
      <article id="detail-content" class="markdown-body"></article>
    </main>
  </section>
</div>

<!-- 内联数据(file:// 回退用),由 build.py 注入到下方 script 标签 -->
<script type="application/json" id="skill-data">__SKILL_DATA__</script>
<script>
(function(){
  "use strict";
  var DATA = JSON.parse(document.getElementById('skill-data').textContent);

  /* ---------- v11 思路:文件列表 + 内联内容映射 ---------- */
  var skillFiles = DATA.map(function(s){
    return {slug:s.slug, name:s.name, title:s.title, desc:s.desc, file:s.file};
  });
  var skillContent = {};
  DATA.forEach(function(s){ skillContent[s.slug] = s.raw; });

  /* ---------- 工具 ---------- */
  function esc(s){
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
  function escAttr(s){
    return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
  function findSkill(slug){
    for(var i=0;i<skillFiles.length;i++){
      if(skillFiles[i].slug === slug) return skillFiles[i];
    }
    return null;
  }

  /* ---------- Markdown 渲染器(轻量,覆盖常见语法)----------
     行内元素先替换为 @@TOKEN@@ 哨兵,转义正文后再还原,
     避免代码/链接内部被二次处理。 */
  function inline(text){
    var codes=[], links=[], imgs=[];
    text = text.replace(/`+([^`]+?)`+/g, function(m,c){ codes.push(c); return '@@CODE'+(codes.length-1)+'@@'; });
    text = text.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, function(m,alt,url,t){
      imgs.push({alt:alt,url:url,t:t}); return '@@IMG'+(imgs.length-1)+'@@';
    });
    text = text.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, function(m,txt,url,t){
      links.push({txt:txt,url:url,t:t}); return '@@LINK'+(links.length-1)+'@@';
    });
    text = esc(text);
    text = text.replace(/\*\*([^\n]+?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/__([^\n]+?)__/g, '<strong>$1</strong>');
    text = text.replace(/~~([^\n]+?)~~/g, '<del>$1</del>');
    text = text.replace(/(^|[^*])\*(?!\s)([^\n*]+?)\*(?!\*)/g, '$1<em>$2</em>');
    text = text.replace(/(^|[^_\w])_(?!\s)([^\n_]+?)_(?!_|\w)/g, '$1<em>$2</em>');
    text = text.replace(/@@LINK(\d+)@@/g, function(m,i){
      var L=links[+i];
      return '<a href="'+escAttr(L.url)+'"'+(L.t?' title="'+escAttr(L.t)+'"':'')+'>'+esc(L.txt)+'</a>';
    });
    text = text.replace(/@@IMG(\d+)@@/g, function(m,i){
      var I=imgs[+i];
      return '<img src="'+escAttr(I.url)+'" alt="'+escAttr(I.alt)+'"'+(I.t?' title="'+escAttr(I.t)+'"':'')+'>';
    });
    text = text.replace(/@@CODE(\d+)@@/g, function(m,i){
      return '<code>'+esc(codes[+i])+'</code>';
    });
    return text;
  }

  function splitRow(line){
    line = line.trim().replace(/^\|/,'').replace(/\|\s*$/,'');
    return line.split('|');
  }

  function renderMarkdown(md){
    if(!md) return '';
    // 去 BOM + frontmatter
    md = md.replace(/^﻿?---\s*\n[\s\S]*?\n---\s*\n/, '');
    // 提取 fenced code block 为哨兵占位。
    // 开闭围栏都必须在行首(常见 Markdown 规范),避免把行内的 ``` 当成围栏
    // 误切(否则会产生 "@@BLOCK0@@文字@@BLOCK1@@" 这种夹杂占位符的行,
    // 既不匹配纯占位符、又被段落守卫 !/^@@BLOCK/ 拒收,导致死循环)。
    var blocks=[];
    md = md.replace(/(^|\n)```([^\n`]*)\r?\n([\s\S]*?)\r?\n```(?=\r?\n|$)/g, function(m,pre,lang,code){
      blocks.push({lang:(lang||'').trim(), code:code.replace(/\n$/,'')});
      return pre+'@@BLOCK'+(blocks.length-1)+'@@';
    });

    var lines = md.split(/\r?\n/);
    var out=[];
    var i=0;
    while(i < lines.length){
      var line = lines[i];

      if(/^\s*$/.test(line)){ i++; continue; }

      // 代码块占位(单独一行)
      var bm = line.match(/^@@BLOCK(\d+)@@\s*$/);
      if(bm){
        var b = blocks[+bm[1]];
        out.push('<pre class="code-block"><code class="lang-'+escAttr(b.lang)+'">'+esc(b.code)+'</code></pre>');
        i++; continue;
      }

      // 标题
      var hm = line.match(/^(#{1,6})\s+(.*?)(?:\s*#+\s*)?$/);
      if(hm){
        var lv = hm[1].length;
        out.push('<h'+lv+'>'+inline(hm[2])+'</h'+lv+'>');
        i++; continue;
      }

      // 水平线
      if(/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)){ out.push('<hr>'); i++; continue; }

      // 引用块
      if(/^\s*>/.test(line)){
        var q=[];
        while(i<lines.length && /^\s*>/.test(lines[i])){
          q.push(lines[i].replace(/^\s*>?\s?/, ''));
          i++;
        }
        out.push('<blockquote>'+inline(q.join('\n').replace(/\n/g,'<br>'))+'</blockquote>');
        continue;
      }

      // 无序列表
      if(/^\s*[-*+]\s+/.test(line)){
        var it=[];
        while(i<lines.length && (/^\s*[-*+]\s+/.test(lines[i]) || (/^\s+\S/.test(lines[i]) && it.length))){
          if(/^\s*[-*+]\s+/.test(lines[i])){
            var c = lines[i].replace(/^\s*[-*+]\s+/, '');
            var tm = c.match(/^\[( |x|X)\]\s+(.*)$/);
            if(tm){
              it.push('<li class="task">'+(tm[1].toLowerCase()==='x'?'<input type="checkbox" checked disabled>':'<input type="checkbox" disabled>')+' '+inline(tm[2])+'</li>');
            } else {
              it.push('<li>'+inline(c)+'</li>');
            }
          } else {
            it[it.length-1] += ' ' + inline(lines[i].trim());
          }
          i++;
        }
        out.push('<ul>'+it.join('')+'</ul>');
        continue;
      }

      // 有序列表
      if(/^\s*\d+\.\s+/.test(line)){
        var ot=[];
        while(i<lines.length && (/^\s*\d+\.\s+/.test(lines[i]) || (/^\s+\S/.test(lines[i]) && ot.length))){
          if(/^\s*\d+\.\s+/.test(lines[i])){
            ot.push('<li>'+inline(lines[i].replace(/^\s*\d+\.\s+/, ''))+'</li>');
          } else {
            ot[ot.length-1] += ' ' + inline(lines[i].trim());
          }
          i++;
        }
        out.push('<ol>'+ot.join('')+'</ol>');
        continue;
      }

      // 表格
      if(/^\s*\|/.test(line) && i+1<lines.length && /^\s*\|[\s:|-]+\|?\s*$/.test(lines[i+1])){
        var hdr = splitRow(line);
        var al = splitRow(lines[i+1]).map(function(c){
          c = c.trim();
          if(/^:.*:$/.test(c)) return 'center';
          if(/:$/.test(c)) return 'right';
          if(/^:/.test(c)) return 'left';
          return '';
        });
        i += 2;
        var rows=[];
        while(i<lines.length && /^\s*\|/.test(lines[i])){
          rows.push(splitRow(lines[i]));
          i++;
        }
        var thead = '<thead><tr>'+hdr.map(function(c,idx){
          return '<th style="text-align:'+(al[idx]||'left')+'">'+inline(c.trim())+'</th>';
        }).join('')+'</tr></thead>';
        var tbody = '<tbody>'+rows.map(function(r){
          return '<tr>'+r.map(function(c,idx){
            return '<td style="text-align:'+(al[idx]||'left')+'">'+inline(c.trim())+'</td>';
          }).join('')+'</tr>';
        }).join('')+'</tbody>';
        out.push('<table>'+thead+tbody+'</table>');
        continue;
      }

      // 段落
      var para=[];
      while(i<lines.length && !/^\s*$/.test(lines[i])
        && !/^@@BLOCK/.test(lines[i])
        && !/^(#{1,6})\s/.test(lines[i])
        && !/^\s*>/.test(lines[i])
        && !/^\s*[-*+]\s+/.test(lines[i])
        && !/^\s*\d+\.\s+/.test(lines[i])
        && !/^\s*\|/.test(lines[i])
        && !/^\s*([-*_])(\s*\1){2,}\s*$/.test(lines[i])){
        para.push(lines[i]); i++;
      }
      if(para.length){
        out.push('<p>'+inline(para.join('\n').replace(/\n/g,'<br>'))+'</p>');
      } else {
        // 安全兜底:该行未被任何块匹配(例如夹杂在行内的 @@BLOCK 占位、孤立的 | 等),
        // 直接作为段落消费并前进,绝对避免死循环。
        out.push('<p>'+inline(lines[i])+'</p>');
        i++;
      }
    }
    return out.join('\n');
  }

  /* ---------- 内容加载:fetch 优先,内联回退 ---------- */
  function loadContent(s, cb){
    var inlineTxt = skillContent[s.slug] || '';
    // file:// 下 fetch 本地文件受跨域限制,直接用内联内容
    if(location.protocol === 'file:' || !window.fetch){
      cb(inlineTxt);
      return;
    }
    fetch(s.file, {cache:'no-store'})
      .then(function(r){ if(!r.ok) throw new Error(r.status); return r.text(); })
      .then(function(txt){ cb(txt); })
      .catch(function(){ cb(inlineTxt); });
  }

  /* ---------- 列表渲染 ---------- */
  function renderList(filter){
    var list = document.getElementById('skill-list');
    var html = '';
    var shown = 0;
    skillFiles.forEach(function(s){
      if(filter){
        var hay = (s.title+' '+s.desc+' '+s.slug).toLowerCase();
        if(hay.indexOf(filter) === -1) return;
      }
      shown++;
      html += '<a class="card" href="#'+escAttr(s.slug)+'">'
        + '<div class="card-head"><span class="card-badge">SKILL</span>'
        + '<h2 class="card-title">'+esc(s.title)+'</h2></div>'
        + '<p class="card-desc">'+esc(s.desc)+'</p>'
        + '<div class="card-foot"><span class="card-file">📁 '+esc(s.file)+'</span>'
        + '<span class="card-go">查看详情 -></span></div>'
        + '</a>';
    });
    list.innerHTML = html;
    document.getElementById('empty').hidden = shown > 0;
    document.getElementById('count').textContent = shown + ' / ' + skillFiles.length;
  }

  /* ---------- 路由 ---------- */
  function showList(){
    document.getElementById('list-view').hidden = false;
    document.getElementById('detail-view').hidden = true;
    document.title = 'Skills 技能文档';
    window.scrollTo(0, 0);
  }
  function showDetail(s){
    document.getElementById('list-view').hidden = true;
    document.getElementById('detail-view').hidden = false;
    document.getElementById('detail-file').textContent = s.file;
    var rawLink = document.getElementById('raw-link');
    rawLink.href = s.file;
    rawLink.style.display = '';
    var box = document.getElementById('detail-content');
    box.innerHTML = '<div class="loading">加载中…</div>';
    document.title = s.title + ' - Skills';
    window.scrollTo(0, 0);
    loadContent(s, function(txt){
      box.innerHTML = renderMarkdown(txt);
    });
  }
  function route(){
    var hash = location.hash.slice(1);
    if(!hash){ showList(); return; }
    try { hash = decodeURIComponent(hash); } catch(e){}
    var s = findSkill(hash);
    if(s){ showDetail(s); return; }
    showList();
  }

  /* ---------- 事件 ---------- */
  window.addEventListener('hashchange', route);
  document.getElementById('search').addEventListener('input', function(){
    renderList(this.value.toLowerCase().trim());
  });
  document.getElementById('back-btn').addEventListener('click', function(e){
    e.preventDefault();
    if(location.hash){
      if(history.length > 1){ history.back(); }
      else { location.hash = ''; }
    }
  });

  renderList('');
  route();
})();
</script>
</body>
</html>
'''


def build():
    skills = collect_skills()
    if not skills:
        print('未找到任何 .txt 文件,已终止。', file=sys.stderr)
        sys.exit(1)
    blob = json.dumps(skills, ensure_ascii=False)
    # 防止内容里的 </script> 截断 <script type="application/json">:
    # 将 </ 转义为 <\/ ,JSON 解析时会还原成 </
    blob = blob.replace('</', '<\\/')
    html = TEMPLATE.replace('__SKILL_DATA__', blob)
    out_path = os.path.join(HERE, 'skill.html')
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(html)
    print('已生成 skill.html,共 %d 个技能:' % len(skills))
    for s in skills:
        print('  - %s  (%s, %d 字)' % (s['slug'], s['file'], len(s['raw'])))


if __name__ == '__main__':
    build()
