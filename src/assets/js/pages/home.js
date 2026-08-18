/* ============================================================
 * 墨韵 · 个人主页交互（home.js）v3.0
 * ------------------------------------------------------------
 * 结构：纯函数核心（可单测，无 DOM 依赖） + DOM 装配层（浏览器执行）。
 * 纯函数：filterTools / groupTools / escHtml
 * 装配层：render / bindEvents（搜索、分类、快捷键、返回顶部）
 * 所有用户交互通过 Logger 事务记录（见 plan/api-doc.md §2.3）。
 * ============================================================ */
(function (global) {
  'use strict';

  var DATA = global.TOOLS_DATA;

  /* ---------------- 纯函数核心 ---------------- */

  /**
   * 按分类 + 关键词过滤工具清单（条件叠加为 AND）。
   * @param {Array} tools  工具数组（TOOLS_DATA.tools）
   * @param {string} cat   分类 key，'all' 表示不限
   * @param {string} query 关键词，匹配 name/desc，大小写不敏感
   * @returns {Array} 命中的工具（保持原顺序）
   */
  function filterTools(tools, cat, query) {
    var q = (query || '').toLowerCase().trim();
    return (tools || []).filter(function (t) {
      var matchCat = !cat || cat === 'all' || t.cat === cat;
      var matchQ = !q || t.name.toLowerCase().indexOf(q) > -1
        || t.desc.toLowerCase().indexOf(q) > -1;
      return matchCat && matchQ;
    });
  }

  /**
   * 将过滤结果按分组定义归组（保持 groups 顺序，空组剔除）。
   * @returns {Array<{key,title,items}>}
   */
  function groupTools(filtered, groups) {
    return (groups || []).map(function (g) {
      return { key: g.key, title: g.title, items: filtered.filter(function (t) { return t.cat === g.key; }) };
    }).filter(function (g) { return g.items.length > 0; });
  }

  /** HTML 转义：卡片文本来自本仓库数据，此处兜底防注入 */
  function escHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------------- DOM 装配层（仅浏览器执行） ---------------- */
  var HomeApp = {
    filterTools: filterTools,
    groupTools: groupTools,
    escHtml: escHtml,
    state: { cat: 'all', query: '' }
  };

  if (typeof document === 'undefined' || !DATA) {
    // Node 单测环境：只暴露纯函数
    if (typeof module !== 'undefined' && module.exports) module.exports = HomeApp;
    return;
  }

  var Logger = global.Logger;

  /**
   * 渲染工具网格到 #toolContainer。
   * @param {string} cat   当前分类 key
   * @param {string} query 当前搜索词
   */
  HomeApp.render = function (cat, query) {
    var box = document.getElementById('toolContainer');
    var filtered = filterTools(DATA.tools, cat, query);
    var sections = groupTools(filtered, DATA.groups);

    if (!sections.length) {
      box.innerHTML = '<div class="empty">' + escHtml('没有找到「' + (query || '') + '」相关的工具') + '</div>';
      HomeApp.lastMatches = [];
      return;
    }
    var html = sections.map(function (sec) {
      var cards = sec.items.map(function (t) {
        var icon = DATA.ICONS[t.icon] || DATA.ICONS.doc;
        return '<a class="tool-card" href="' + escHtml(t.link) + '" data-id="' + escHtml(t.id) + '">'
          + '<span class="tool-icon">' + icon + '</span>'
          + '<span class="tool-name">' + escHtml(t.name) + '</span>'
          + '<span class="tool-desc">' + escHtml(t.desc) + '</span>'
          + '<span class="tool-go">打开 <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg></span>'
          + '</a>';
      }).join('');
      return '<section class="tool-section"><h2 class="section-title">' + escHtml(sec.title)
        + '<span class="sec-line"></span>'
        + '<span class="section-count">' + sec.items.length + '</span></h2>'
        + '<div class="tools-grid">' + cards + '</div></section>';
    }).join('');
    box.innerHTML = html;
    HomeApp.lastMatches = filtered;
  };

  /**
   * 绑定全部主页事件：搜索输入、分类 chips、快捷键、返回顶部。
   */
  HomeApp.bindEvents = function () {
    var input = document.getElementById('searchInput');

    /* 搜索：即时过滤，打点日志 */
    input.addEventListener('input', function () {
      HomeApp.state.query = this.value;
      HomeApp.render(HomeApp.state.cat, HomeApp.state.query);
      if (Logger) Logger.info('搜索输入 "' + this.value + '"，命中 ' + (HomeApp.lastMatches || []).length + ' 个');
    });

    /* 回车：打开第一个匹配结果（对话式直达，DeepSeek 风格） */
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') HomeApp.openFirst();
      if (e.key === 'Escape') { this.value = ''; this.dispatchEvent(new Event('input')); }
    });

    /* 分类 chips：单选高亮 */
    document.querySelectorAll('.chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        document.querySelectorAll('.chip').forEach(function (c) { c.classList.remove('is-active'); });
        this.classList.add('is-active');
        HomeApp.state.cat = this.dataset.cat;
        var tx = Logger && Logger.tx('切换分类');
        if (tx) { var s = tx.span('渲染 ' + this.dataset.cat); HomeApp.render(HomeApp.state.cat, HomeApp.state.query); s.end(); tx.end(); }
        else HomeApp.render(HomeApp.state.cat, HomeApp.state.query);
      });
    });

    /* 快捷键：/ 或 Ctrl/⌘+K 聚焦搜索 */
    document.addEventListener('keydown', function (e) {
      if (e.key === '/' && document.activeElement !== input) { e.preventDefault(); input.focus(); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); input.focus(); input.select(); }
    });

    /* 返回顶部 */
    var backTop = document.getElementById('backTop');
    window.addEventListener('scroll', function () {
      backTop.classList.toggle('visible', window.scrollY > 300);
    });
    backTop.addEventListener('click', function (e) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  };

  /** 打开第一个匹配结果（Enter 触发），带事务日志 */
  HomeApp.openFirst = function () {
    var first = (HomeApp.lastMatches || [])[0];
    if (!first) return;
    if (Logger) {
      var tx = Logger.tx('回车直达');
      tx.span('打开 ' + first.name).info('跳转 ' + first.link);
      tx.end();
    }
    global.location.href = first.link;
  };

  /* 启动：初始渲染 + 事件绑定 + 启动事务日志 */
  HomeApp.render('all', '');
  HomeApp.bindEvents();
  if (Logger) {
    var bootTx = Logger.tx('主页加载');
    bootTx.span('渲染工具网格').info('共 ' + DATA.tools.length + ' 个工具 / ' + DATA.groups.length + ' 个分组').end();
    bootTx.end();
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = HomeApp;
})(typeof window !== 'undefined' ? window : globalThis);
