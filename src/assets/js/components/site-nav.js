/* ============================================================
 * 墨韵 · 全站统一导航组件（site-nav.js）V5
 * ------------------------------------------------------------
 * 功能：所有页面注入统一头部（logo + 页面标题 + 导航链接 +
 *       「工具」hover 分类下拉 + 管理菜单）。
 * 规则（TX-20260817-06）：
 *   - 页面自身按钮【不迁移】进导航：按钮留在页面自身顶部居右，
 *     页头组件只接管标题展示（hideSelectors 隐藏页面标题块）；
 *   - 「工具」只保留一个入口（hover 分类下拉），不再渲染普通「工具」链接；
 *   - 下拉悬停/点击均可：透明桥接消除按钮→菜单间隙导致的闪退；
 *   - 全屏工具页按实际 topbar 高度动态压缩 .workspace。
 * 用法：
 *   - 根页面：<script src="src/assets/js/components/site-nav.js"></script>
 *   - 一级工具页：<script src="../../assets/js/components/site-nav.js"></script>
 *   - 二级工具页：<script src="../../../assets/js/components/site-nav.js"></script>
 * 配置（可选）：window.SITE_NAV = {
 *   title: '页面标题',              // 显示在 logo 右侧
 *   links: [{href,text}...],        // 自定义导航链接（主页锚点）
 *   menu: true|false,               // 是否显示「管理菜单」
 *   hideSelectors: ['.header > div:first-child']  // 仅隐藏页面标题块，保留按钮
 * }
 * ============================================================ */
(function (global) {
  'use strict';
  if (typeof document === 'undefined') return;

  /* 已注入则跳过（防重复） */
  if (document.getElementById('snuNav')) return;

  /* ---- 站点根路径：解析当前脚本绝对 URL，去掉 /js/site-nav.js ---- */
  var script = document.currentScript;
  var base = '';
  if (script && script.src) {
    base = script.src.replace(/\/src\/assets\/js\/components\/site-nav\.js$/, '');
  }

  /* ---- 全屏工具页检测（html,body{height:100%;overflow:hidden}） ---- */
  var isFullscreen = false;
  try {
    isFullscreen = getComputedStyle(document.body).overflow === 'hidden';
  } catch (e) { /* 忽略 */ }

  /* ---- 配置 ---- */
  var cfg = global.SITE_NAV || {};
  var pageTitle = cfg.title || '';
  var links = cfg.links || [
    { href: '/index.html', text: '首页' },
    { href: '/src/tools/docx/doc-manager.html', text: '文档' }
  ];
  var showMenu = cfg.menu !== false;
  var hideSelectors = cfg.hideSelectors || [];

  /* 组装 href：锚点（# 开头）不拼 base，其余拼接站点根 */
  function fullHref(href) {
    if (!href) return '#';
    if (href.charAt(0) === '#') return href;
    if (/^(https?:|mailto:|javascript:)/.test(href)) return href;
    return base + href;
  }

  /* ---- 注入样式（令牌优先，未加载 theme.css 时回退） ---- */
  var navPos = isFullscreen ? 'static' : 'sticky';
  var style = document.createElement('style');
  style.textContent =
    '.snu-nav{position:' + navPos + ';top:0;z-index:300;height:56px;display:flex;' +
    'align-items:center;justify-content:space-between;padding:0 24px;' +
    'background:rgba(255,255,255,.85);backdrop-filter:blur(14px);' +
    '-webkit-backdrop-filter:blur(14px);border-bottom:1px solid var(--line,#e5e7eb);' +
    'font-family:var(--font-sans,-apple-system,"PingFang SC","Microsoft YaHei",system-ui,sans-serif);} ' +
    '.snu-nav *{box-sizing:border-box;} ' +
    '.snu-left{display:flex;align-items:center;gap:12px;min-width:0;} ' +
    '.snu-logo{display:flex;align-items:center;gap:10px;font-size:16px;font-weight:600;' +
    'color:var(--ink-900,#111827);text-decoration:none;letter-spacing:.3px;flex-shrink:0;} ' +
    '.snu-mark{width:28px;height:28px;border-radius:8px;' +
    'background:linear-gradient(135deg,var(--brand,#4d6bfe),#a78bfa);color:#fff;' +
    'display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;} ' +
    '.snu-name{letter-spacing:.5px;} ' +
    '.snu-title{font-size:13px;font-weight:500;color:var(--ink-600,#4b5563);' +
    'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:40vw;' +
    'border-left:1px solid var(--line,#e5e7eb);padding-left:12px;letter-spacing:.3px;} ' +
    '.snu-right{display:flex;align-items:center;gap:16px;} ' +
    '.snu-links{display:flex;align-items:center;gap:20px;} ' +
    '.snu-links>a{color:var(--ink-600,#4b5563);font-size:13px;text-decoration:none;' +
    'letter-spacing:.3px;transition:color .2s;cursor:pointer;white-space:nowrap;} ' +
    '.snu-links>a:hover{color:var(--ink-900,#111827);} ' +
    '.snu-drop{position:relative;} ' +
    '.snu-drop-btn{background:none;border:none;color:var(--ink-600,#4b5563);font-size:13px;' +
    'font-family:inherit;letter-spacing:.3px;cursor:pointer;display:flex;align-items:center;' +
    'gap:4px;padding:4px 0;transition:color .2s;white-space:nowrap;} ' +
    '.snu-drop-btn:hover{color:var(--ink-900,#111827);} ' +
    '.snu-drop-arrow{font-size:10px;opacity:.7;transition:transform .2s;} ' +
    '.snu-drop.open .snu-drop-arrow{transform:rotate(180deg);} ' +
    /* 下拉菜单：紧贴按钮 + 透明桥接（消除悬停间隙闪退） */
    '.snu-drop::after{content:"";position:absolute;top:100%;left:0;right:0;height:10px;} ' +
    '.snu-drop-menu{position:absolute;top:calc(100% + 10px);right:0;min-width:210px;' +
    'background:#fff;border:1px solid var(--line,#e5e7eb);border-radius:12px;' +
    'box-shadow:0 12px 32px rgba(17,24,39,.12);padding:8px;display:none;' +
    'animation:snu-pop .18s ease;} ' +
    '@keyframes snu-pop{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}} ' +
    '.snu-drop.open .snu-drop-menu{display:block;} ' +
    '.snu-drop-menu a{display:flex;align-items:center;gap:8px;padding:8px 12px;' +
    'border-radius:8px;color:var(--ink-600,#4b5563);font-size:13px;text-decoration:none;' +
    'transition:background .15s,color .15s;white-space:nowrap;} ' +
    '.snu-drop-menu a:hover{background:var(--brand-050,#eef1ff);color:var(--brand-600,#3d55d9);} ' +
    '.snu-drop-divider{height:1px;background:var(--line,#e5e7eb);margin:6px 8px;} ' +
    /* 工具分类下拉：紧凑单列 + 纯 CSS :hover 显隐（v4.0 紧凑化）
       仅背景高亮，条目不位移（内容静态）；150ms 防误开由 transition-delay 纯 CSS 实现 */
    '.snu-tools-menu{left:auto;right:0;width:240px;max-width:calc(100vw - 32px);' +
    'padding:6px;display:block;' +
    'opacity:0;visibility:hidden;pointer-events:none;' +
    'transition:opacity .15s ease,visibility 0s .15s;}' +
    '.snu-drop:hover .snu-tools-menu{opacity:1;visibility:visible;pointer-events:auto;' +
    'transition:opacity .15s ease .15s,visibility 0s;}' +
    '.snu-tools-cat{font-size:11px;font-weight:600;color:var(--ink-400,#9ca3af);' +
    'letter-spacing:.08em;margin:8px 8px 2px;text-transform:uppercase;}' +
    '.snu-tools-cat:first-child{margin-top:2px;}' +
    '.snu-tool-item{display:flex;align-items:center;gap:6px;padding:6px 10px;' +
    'border-radius:8px;color:var(--ink-600,#4b5563);font-size:12.5px;font-weight:500;' +
    'text-decoration:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;' +
    'transition:background .15s,color .15s;}' +
    '.snu-tool-item:hover{background:var(--brand-050,#eef1ff);' +
    'color:var(--brand-600,#3d55d9);}' +
    /* 页面自身页头按钮风格统一（仅调整尺寸圆角，颜色保留原主题） */
    '.header-actions button,.header-actions a,.topbar>button,.topbar>.pub-wrap button,' +
    '.topbar .tbtn{height:32px;padding:0 14px;border-radius:8px;font-size:12.5px;' +
    'line-height:1;box-sizing:border-box;vertical-align:middle;} ' +
    '@media (max-width:900px){.snu-nav{padding:0 14px;}.snu-links{gap:12px;}.' +
    '.snu-title{max-width:30vw;}} ' +
    '@media (max-width:768px){.snu-nav{padding:0 12px;}.snu-links{gap:10px;}.' +
    '.snu-right{gap:10px;}}';
  document.head.appendChild(style);

  /* ---- 注入导航 DOM ---- */
  var nav = document.createElement('nav');
  nav.className = 'snu-nav';
  nav.id = 'snuNav';
  nav.setAttribute('aria-label', '全站导航');

  var left = document.createElement('div');
  left.className = 'snu-left';

  var logo = document.createElement('a');
  logo.className = 'snu-logo';
  logo.href = fullHref('/index.html');
  logo.innerHTML = '<span class="snu-mark">墨</span><span class="snu-name">墨韵</span>';
  left.appendChild(logo);

  /* 页面标题入参 */
  if (pageTitle) {
    var titleEl = document.createElement('span');
    titleEl.className = 'snu-title';
    titleEl.textContent = pageTitle;
    left.appendChild(titleEl);
  }

  var right = document.createElement('div');
  right.className = 'snu-right';

  /* 导航链接（默认不含「工具」——工具仅保留下拉入口，避免重复按钮） */
  var linksWrap = document.createElement('div');
  linksWrap.className = 'snu-links';
  links.forEach(function (l) {
    var a = document.createElement('a');
    a.href = fullHref(l.href);
    a.textContent = l.text;
    linksWrap.appendChild(a);
  });
  right.appendChild(linksWrap);

  /* 工具分类下拉（hover 展示，数据来自 js/tools-data.js） */
  var toolsDrop = document.createElement('div');
  toolsDrop.className = 'snu-drop';
  var toolsBtn = document.createElement('button');
  toolsBtn.type = 'button';
  toolsBtn.className = 'snu-drop-btn';
  toolsBtn.innerHTML = '工具<span class="snu-drop-arrow">▾</span>';
  toolsDrop.appendChild(toolsBtn);
  var toolsMenu = document.createElement('div');
  toolsMenu.className = 'snu-drop-menu snu-tools-menu';
  toolsMenu.innerHTML = '<div class="snu-tools-cat">加载中…</div>';
  toolsDrop.appendChild(toolsMenu);
  right.appendChild(toolsDrop);

  /* 管理菜单下拉 */
  if (showMenu) {
    var drop = document.createElement('div');
    drop.className = 'snu-drop';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'snu-drop-btn';
    btn.innerHTML = '管理菜单<span class="snu-drop-arrow">▾</span>';
    var menu = document.createElement('div');
    menu.className = 'snu-drop-menu';
    var items = [
      { href: '/src/tools/docx/doc-manager.html', text: '📄 文档管理器' },
      { href: '/src/tools/skills/skill.html', text: '📚 技能文档' },
      { href: 'https://github.com/', text: '🐙 GitHub' }
    ];
    items.forEach(function (it) {
      var a = document.createElement('a');
      a.href = fullHref(it.href);
      a.target = /^https?:/.test(it.href) ? '_blank' : '';
      a.rel = /^https?:/.test(it.href) ? 'noopener' : '';
      a.textContent = it.text;
      menu.appendChild(a);
    });
    drop.appendChild(btn);
    drop.appendChild(menu);
    right.appendChild(drop);
  }

  nav.appendChild(left);
  nav.appendChild(right);
  document.body.insertBefore(nav, document.body.firstChild);

  /* ---- 仅隐藏页面标题块（按钮保留在页面自身顶部居右，不迁移） ---- */
  hideSelectors.forEach(function (sel) {
    var el = document.querySelector(sel);
    if (!el) return;
    el.style.display = 'none';
    /* 若父容器为 flex space-between（左标题右按钮布局），
       隐藏标题后剩余按钮应保持右对齐 → 改为 flex-end */
    var parent = el.parentElement;
    if (parent) {
      var jc = '';
      try { jc = getComputedStyle(parent).justifyContent; } catch (e) { /* 忽略 */ }
      if (jc === 'space-between' || jc === 'space-around') parent.style.justifyContent = 'flex-end';
    }
  });

  /* ---- 全屏工具页：按实际 nav + topbar 高度动态压缩 .workspace ---- */
  if (isFullscreen) {
    var ws = document.querySelector('.workspace');
    if (ws) {
      var tb = document.querySelector('.topbar, .header');
      var navH = nav.offsetHeight || 56;
      var tbH = tb && tb.offsetHeight ? tb.offsetHeight : 0;
      ws.style.height = 'calc(100vh - ' + (navH + tbH) + 'px)';
    }
  }

  /* ---- 工具分类下拉数据（动态加载 tools-data.js，单一数据源） ---- */
  function renderToolsMenu(data) {
    if (!data || !data.groups || !data.tools) {
      toolsMenu.innerHTML = '<div class="snu-tools-cat">暂无工具</div>';
      return;
    }
    var html = '';
    data.groups.forEach(function (g) {
      var items = data.tools.filter(function (t) { return t.cat === g.key; });
      if (!items.length) return;
      html += '<div class="snu-tools-cat">' + g.title + '</div>';
      items.forEach(function (t) {
        html += '<a class="snu-tool-item" href="' + fullHref('/' + t.link) + '">'
          + '<span class="snu-tool-name">' + t.name + '</span></a>';
      });
    });
    toolsMenu.innerHTML = html || '<div class="snu-tools-cat">暂无工具</div>';
  }
  if (global.TOOLS_DATA) {
    renderToolsMenu(global.TOOLS_DATA);
  } else {
    var dataScript = document.createElement('script');
    dataScript.src = base + '/src/assets/js/core/tools-data.js';
    dataScript.onload = function () { renderToolsMenu(global.TOOLS_DATA); };
    dataScript.onerror = function () {
      toolsMenu.innerHTML = '<div class="snu-tools-cat">工具加载失败</div>';
    };
    document.head.appendChild(dataScript);
  }

  /* 点击页面其他区域关闭下拉（悬停设备保留 hover 展开） */
  document.addEventListener('click', function (e) {
    var drops = document.querySelectorAll('.snu-drop.open');
    drops.forEach(function (d) {
      if (!d.contains(e.target)) d.classList.remove('open');
    });
  });

  /* ---- 悬停延迟开合（150ms）：仅管理菜单（工具下拉已改纯 CSS :hover，V4.0）----
   * 移入 .snu-drop 150ms 后展开（.open），移出立即收起。 */
  var HOVER_DELAY = 150;
  document.querySelectorAll('.snu-drop').forEach(function (d) {
    /* 工具下拉由纯 CSS :hover 控制，JS 不再接管 */
    if (d.querySelector('.snu-tools-menu')) return;
    var timer = null;
    d.addEventListener('mouseenter', function () {
      clearTimeout(timer);
      timer = setTimeout(function () { d.classList.add('open'); }, HOVER_DELAY);
    });
    d.addEventListener('mouseleave', function () {
      clearTimeout(timer);
      d.classList.remove('open');
    });
  });
})(typeof window !== 'undefined' ? window : globalThis);
