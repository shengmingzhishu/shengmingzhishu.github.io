/* Mermaid 图初始化
   图中配色使用报告 :root 中已选定的 Business Blue 预设的页面令牌解析值
   （page-brand / page-brand-soft / page-surface / page-border），
   结构性图与数据图分属不同令牌层，此处不引用数据系列令牌。 */

(function () {
  'use strict';

  if (typeof mermaid === 'undefined') return;

  mermaid.initialize({
    startOnLoad: false,
    theme: 'base',
    securityLevel: 'loose',
    fontFamily: "'Instrument Sans', 'PingFang SC', 'Microsoft YaHei', 'Noto Sans CJK SC', sans-serif",
    flowchart: {
      curve: 'basis',
      padding: 16,
      nodeSpacing: 36,
      rankSpacing: 44,
      useMaxWidth: true,
      htmlLabels: true
    },
    themeVariables: {
      primaryColor: '#F0F6FF',
      primaryTextColor: '#0A3069',
      primaryBorderColor: '#0969DA',
      lineColor: '#D1D9E0',
      secondaryColor: '#F6F8FA',
      tertiaryColor: '#FFFFFF',
      fontSize: '14px'
    }
  });

  function renderAll() {
    var nodes = document.querySelectorAll('pre.mermaid');
    if (!nodes.length) return;

    var list = Array.prototype.slice.call(nodes);

    list.forEach(function (node) {
      node.removeAttribute('data-processed');
    });

    try {
      var result = mermaid.run({ nodes: list, suppressErrors: false });
      if (result && typeof result.catch === 'function') {
        result.catch(function (err) {
          if (window.console && console.error) console.error('[mermaid] render failed:', err);
        });
      }
    } catch (err) {
      if (window.console && console.error) console.error('[mermaid] init failed:', err);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(renderAll, 0);
    });
  } else {
    setTimeout(renderAll, 0);
  }
})();
