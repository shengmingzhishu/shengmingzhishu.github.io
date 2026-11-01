/* JVM 调优案例推演 — 图表初始化
   配色来源：本报告 :root 中已选定的 Business Blue 预设的 chart 令牌
   所有图表统一从 CSS 变量读取，不定义局部调色板。 */

(function () {
  'use strict';

  var root = document.documentElement;
  function token(name, fallback) {
    var v = getComputedStyle(root).getPropertyValue(name).trim();
    return v || fallback;
  }

  var chartSeries1 = token('--chart-series-1', '#0969DA');
  var chartOther = token('--chart-other', '#D1D9E0');
  var chartGrid = token('--chart-grid', 'rgba(31, 35, 40, 0.10)');
  var chartAxis = token('--chart-axis', '#636C76');
  var chartLabel = token('--chart-label', '#636C76');
  var chartTooltipBg = token('--chart-tooltip-bg', '#FFFFFF');
  var pageText = token('--page-text', '#1F2328');
  var pageBorder = token('--page-border', '#D1D9E0');

  var FONT_FAMILY = "'Instrument Sans', 'PingFang SC', 'Microsoft YaHei', 'Noto Sans CJK SC', sans-serif";

  var charts = [];

  function initMemoryChart() {
    var el = document.getElementById('chart-memory');
    if (!el || typeof echarts === 'undefined') return;

    /* 两套方案下各内存区域的分配（GB），limit 均为 16GB */
    var categories = [
      'Java 堆',
      '直接内存',
      '线程栈',
      'Metaspace',
      'Code Cache',
      'GC 自身结构',
      '预留缓冲'
    ];

    /* 方案 A：内存富余，堆给到 12GB，堆外不设限（实际由默认值决定，可能超出 limit） */
    var planA = [12, 0, 0.2, 0.5, 0.25, 0.3, 0];
    /* 方案 B：堆 8GB，其余显式分配，保留 4.75GB 缓冲 */
    var planB = [8, 2, 0.2, 0.5, 0.25, 0.3, 4.75];

    var nameA = '方案 A：堆给到 12GB，堆外不设限';
    var nameB = '方案 B：按比例显式分配';

    var chart = echarts.init(el, null, { renderer: 'svg' });

    chart.setOption({
      animation: false,
      grid: { left: 8, right: 64, top: 56, bottom: 8, containLabel: true },
      legend: {
        top: 8,
        right: 8,
        icon: 'circle',
        itemWidth: 10,
        itemHeight: 10,
        textStyle: { color: pageText, fontFamily: FONT_FAMILY, fontSize: 13 }
      },
      tooltip: {
        trigger: 'axis',
        appendToBody: true,
        backgroundColor: chartTooltipBg,
        borderColor: pageBorder,
        borderWidth: 1,
        padding: [8, 12],
        textStyle: { color: pageText, fontFamily: FONT_FAMILY, fontSize: 13 },
        axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(9, 105, 218, 0.06)' } },
        formatter: function (params) {
          var lines = params.map(function (p) {
            return p.marker + p.seriesName + '：' + p.value + ' GB';
          });
          var sumA = planA.reduce(function (a, b) { return a + b; }, 0);
          var sumB = planB.reduce(function (a, b) { return a + b; }, 0);
          lines.push('');
          lines.push('方案 A 合计：' + sumA.toFixed(2) + ' GB');
          lines.push('方案 B 合计：' + sumB.toFixed(2) + ' GB');
          lines.push('容器 limit：16 GB');
          return lines.join('<br/>');
        }
      },
      xAxis: {
        type: 'value',
        name: 'GB',
        nameTextStyle: { color: chartLabel, fontFamily: FONT_FAMILY, fontSize: 12 },
        max: 13,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: chartLabel, fontFamily: FONT_FAMILY, fontSize: 11 },
        splitLine: { lineStyle: { color: chartGrid, width: 1 } }
      },
      yAxis: {
        type: 'category',
        inverse: true,
        data: categories,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: pageText, fontFamily: FONT_FAMILY, fontSize: 12 }
      },
      series: [
        {
          name: nameA,
          type: 'bar',
          data: planA,
          barMaxWidth: 15,
          barGap: '18%',
          itemStyle: { color: chartOther, borderRadius: [0, 4, 4, 0] },
          label: {
            show: true,
            position: 'right',
            color: chartLabel,
            fontFamily: FONT_FAMILY,
            fontSize: 11,
            formatter: function (p) { return p.value > 0 ? p.value : ''; }
          }
        },
        {
          name: nameB,
          type: 'bar',
          data: planB,
          barMaxWidth: 15,
          itemStyle: { color: chartSeries1, borderRadius: [0, 4, 4, 0] },
          label: {
            show: true,
            position: 'right',
            color: chartLabel,
            fontFamily: FONT_FAMILY,
            fontSize: 11,
            formatter: function (p) { return p.value > 0 ? p.value : ''; }
          }
        }
      ]
    });

    charts.push(chart);
  }

  function initEmptyState(el) {
    var p = document.createElement('p');
    p.style.cssText = 'padding:24px;color:' + chartLabel + ';font-size:13px;text-align:center;';
    p.textContent = '图表数据加载失败，请查看浏览器控制台。';
    el.appendChild(p);
  }

  function initAll() {
    try {
      initMemoryChart();
    } catch (err) {
      var el = document.getElementById('chart-memory');
      if (el && !el.querySelector('p')) initEmptyState(el);
      if (window.console && console.error) console.error('[charts] init failed:', err);
    }

    window.addEventListener('resize', function () {
      charts.forEach(function (c) { c.resize(); });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }
})();
