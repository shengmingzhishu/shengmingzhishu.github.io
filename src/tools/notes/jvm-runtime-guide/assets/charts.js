/* JVM 运行机制与内存原理 · 图表初始化
   配色来源：guide.css :root 中已定义的 chart 令牌
   所有图表统一从 CSS 变量读取，不定义局部调色板。 */

(function () {
  'use strict';

  var root = document.documentElement;
  function token(name, fallback) {
    var v = getComputedStyle(root).getPropertyValue(name).trim();
    return v || fallback;
  }

  var c1 = token('--chart-series-1', '#0969DA');
  var c2 = token('--chart-series-2', '#8250DF');
  var c3 = token('--chart-series-3', '#06B6D4');
  var c4 = token('--chart-series-4', '#BF3989');
  var cOther = token('--chart-other', '#D1D9E0');
  var cGrid = token('--chart-grid', 'rgba(31, 35, 40, 0.10)');
  var cAxis = token('--chart-axis', '#636C76');
  var cLabel = token('--chart-label', '#636C76');
  var cTip = token('--chart-tooltip-bg', '#FFFFFF');
  var cText = token('--page-text', '#1F2328');
  var cBorder = token('--page-border', '#D1D9E0');
  var cPositive = token('--chart-positive', '#1A7F37');
  var cWarning = token('--chart-warning', '#9A6700');
  var cNegative = token('--chart-negative', '#CF222E');

  var FONT = "'Instrument Sans', 'PingFang SC', 'Microsoft YaHei', 'Noto Sans CJK SC', sans-serif";

  var charts = [];

  function baseOption(opt) {
    return {
      animation: false,
      textStyle: { fontFamily: FONT, color: cText },
      grid: { left: 8, right: 24, top: 56, bottom: 8, containLabel: true },
      legend: {
        top: 8, right: 8, icon: 'circle', itemWidth: 10, itemHeight: 10,
        textStyle: { color: cText, fontFamily: FONT, fontSize: 13 }
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: cTip,
        borderColor: cBorder,
        borderWidth: 1,
        padding: [8, 12],
        textStyle: { color: cText, fontFamily: FONT, fontSize: 13 },
        axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(9, 105, 218, 0.06)' } }
      }
    };
  }

  function catAxis(data, extra) {
    return Object.assign({
      type: 'category',
      data: data,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: cText, fontFamily: FONT, fontSize: 12 }
    }, extra || {});
  }

  function valAxis(name, max, extra) {
    return Object.assign({
      type: 'value',
      name: name,
      nameTextStyle: { color: cLabel, fontFamily: FONT, fontSize: 12 },
      max: max,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: cLabel, fontFamily: FONT, fontSize: 11 },
      splitLine: { lineStyle: { color: cGrid, width: 1 } }
    }, extra || {});
  }

  function mk(el, option) {
    if (!el || typeof echarts === 'undefined') return null;
    var chart = echarts.init(el, null, { renderer: 'svg' });
    chart.setOption(option);
    charts.push(chart);
    return chart;
  }

  /* ---------- 图 1：容器 16GB limit 的内存分布（堆 vs 堆外） ---------- */
  function initMemorySplitChart() {
    var el = document.getElementById('chart-memory-split');
    if (!el) return;

    var categories = [
      'Java 堆\n（-Xmx）',
      '直接内存\n（-XX:MaxDirectMemorySize）',
      '线程栈\n（-Xss）',
      'Metaspace\n（-XX:MaxMetaspaceSize）',
      'Code Cache',
      'GC 自身结构\n+ JVM 内部',
      '未分配保留\n（容器缓冲）'
    ];

    var withLimit = [8, 1, 0.5, 0.4, 0.25, 0.35, 5];
    var noLimit = [13, 0, 0.2, 0.4, 0.25, 0.3, 1.85];

    var option = baseOption({});
    option.tooltip.formatter = function (params) {
      var lines = params.map(function (p) { return p.marker + p.seriesName + '：' + p.value + ' GB'; });
      lines.push('');
      lines.push('容器 limit：16 GB');
      lines.push('合计：' + params[0].value + ' / ' + params[1].value + ' GB');
      return lines.join('<br/>');
    };
    option.xAxis = valAxis('GB', 14);
    option.yAxis = catAxis(categories, { inverse: true, axisLabel: { color: cText, fontFamily: FONT, fontSize: 11.5, lineHeight: 15 } });
    option.series = [
      {
        name: '显式设置（-Xmx8g）',
        type: 'bar',
        data: withLimit,
        barMaxWidth: 15,
        barGap: '18%',
        itemStyle: { color: c1, borderRadius: [0, 4, 4, 0] },
        label: {
          show: true, position: 'right', color: cLabel, fontFamily: FONT, fontSize: 11,
          formatter: function (p) { return p.value > 0 ? p.value : ''; }
        }
      },
      {
        name: '未显式设置（默认推断）',
        type: 'bar',
        data: noLimit,
        barMaxWidth: 15,
        itemStyle: { color: cOther, borderRadius: [0, 4, 4, 0] },
        label: {
          show: true, position: 'right', color: cLabel, fontFamily: FONT, fontSize: 11,
          formatter: function (p) { return p.value > 0 ? p.value : ''; }
        }
      }
    ];
    mk(el, option);
  }

  /* ---------- 图 2：堆分代与默认比例 ---------- */
  function initGenerationsChart() {
    var el = document.getElementById('chart-generations');
    if (!el) return;

    var option = baseOption({});
    option.tooltip.formatter = function (params) {
      var total = params.reduce(function (a, p) { return a + p.value; }, 0);
      var lines = params.map(function (p) {
        return p.marker + p.seriesName + '：' + p.value + '%';
      });
      lines.push('');
      lines.push('堆占比合计：' + total + '%');
      return lines.join('<br/>');
    };
    option.xAxis = valAxis('%', 100, { axisLabel: { color: cLabel, fontFamily: FONT, fontSize: 11, formatter: '{value}%' } });
    option.yAxis = catAxis(['Survivor S0', 'Survivor S1', 'Eden', 'Old Gen'], { inverse: true });
    option.series = [
      {
        name: 'G1 默认比例',
        type: 'bar',
        stack: 'a',
        data: [5, 5, 60, 30],
        barMaxWidth: 28,
        itemStyle: { color: c1 },
        label: {
          show: true, position: 'inside', color: '#fff', fontFamily: FONT, fontSize: 11,
          formatter: function (p) { return p.value + '%'; }
        }
      }
    ];
    mk(el, option);
  }

  /* ---------- 图 3：对象大小与对齐填充 ---------- */
  function initObjectSizeChart() {
    var el = document.getElementById('chart-object-size');
    if (!el) return;

    var categories = ['Object 头', '引用指针\n（压缩指针）', '字段数据', '对齐填充'];
    var plain = [12, 4, 0, 0];
    var withField = [12, 4, 4, 0];
    var padded = [12, 4, 4, 8];

    var option = baseOption({});
    option.tooltip.formatter = function (params) {
      var lines = params.map(function (p) { return p.marker + p.seriesName + '：' + p.value + ' 字节'; });
      lines.push('');
      lines.push('合计：' + params[0].value + ' / ' + params[1].value + ' / ' + params[2].value + ' 字节');
      return lines.join('<br/>');
    };
    option.xAxis = valAxis('字节', 32);
    option.yAxis = catAxis(categories, { inverse: true });
    option.series = [
      {
        name: '空对象 new Object()',
        type: 'bar', stack: 's', data: plain, barMaxWidth: 16,
        itemStyle: { color: cOther },
        label: { show: true, position: 'right', color: cLabel, fontFamily: FONT, fontSize: 11, formatter: function (p) { return p.value ? p.value : ''; } }
      },
      {
        name: '加 1 个 int 字段',
        type: 'bar', stack: 's', data: withField, barMaxWidth: 16,
        itemStyle: { color: c2 },
        label: { show: true, position: 'right', color: cLabel, fontFamily: FONT, fontSize: 11, formatter: function (p) { return p.value ? p.value : ''; } }
      },
      {
        name: '加 1 个 long 字段（触发 8 字节对齐）',
        type: 'bar', stack: 's', data: padded, barMaxWidth: 16,
        itemStyle: { color: c1 },
        label: { show: true, position: 'right', color: cLabel, fontFamily: FONT, fontSize: 11, formatter: function (p) { return p.value ? p.value : ''; } }
      }
    ];
    mk(el, option);
  }

  /* ---------- 图 4：线程数 vs 内存占用 ---------- */
  function initThreadMemoryChart() {
    var el = document.getElementById('chart-thread-memory');
    if (!el) return;

    var threads = ['50', '200', '500', '1000', '2000'];
    /* -Xss1m 下的线程栈占用（MB） */
    var stack1m = [50, 200, 500, 1000, 2000];
    /* -Xss512k 下的线程栈占用（MB） */
    var stack512k = [25, 100, 250, 500, 1000];
    /* 线程对象本身 + TLAB 等开销，粗略按每线程 32KB 估算 */
    var overhead = threads.map(function (t) { return Math.round(parseInt(t, 10) * 0.032); });

    var option = baseOption({});
    option.tooltip.formatter = function (params) {
      var lines = params.map(function (p) { return p.marker + p.seriesName + '：' + p.value + ' MB'; });
      return lines.join('<br/>');
    };
    option.xAxis = catAxis(threads, { name: '线程数', nameTextStyle: { color: cLabel, fontFamily: FONT, fontSize: 12 } });
    option.yAxis = valAxis('MB', 2200);
    option.series = [
      {
        name: '线程栈（-Xss1m）',
        type: 'bar', stack: 't', data: stack1m, barMaxWidth: 34,
        itemStyle: { color: c1 },
        label: { show: true, position: 'right', color: cLabel, fontFamily: FONT, fontSize: 10.5, formatter: function (p) { return p.value; } }
      },
      {
        name: '线程栈（-Xss512k）',
        type: 'bar', stack: 't', data: stack512k, barMaxWidth: 34,
        itemStyle: { color: c2 },
        label: { show: true, position: 'right', color: cLabel, fontFamily: FONT, fontSize: 10.5, formatter: function (p) { return p.value; } }
      },
      {
        name: '线程对象 + TLAB 开销（估算）',
        type: 'bar', stack: 't', data: overhead, barMaxWidth: 34,
        itemStyle: { color: cOther },
        /* 该系列数值远小于前两项，堆叠后标签会与相邻系列重叠，故不显示数值标签 */
        label: { show: false }
      }
    ];
    mk(el, option);
  }

  /* ---------- 图 5：RSS 与 -Xmx 的差距 ---------- */
  function initRssChart() {
    var el = document.getElementById('chart-rss');
    if (!el) return;

    var categories = ['容器 limit', '进程 RSS', '已提交堆 committed', '存活对象 live set'];
    var values = [8, 6.2, 4.0, 2.1];

    var option = baseOption({});
    option.legend.show = false;
    option.tooltip.formatter = function (params) {
      return params[0].marker + params[0].name + '：<b>' + params[0].value + ' GB</b>';
    };
    option.xAxis = valAxis('GB', 9);
    option.yAxis = catAxis(categories, { inverse: true });
    option.series = [
      {
        name: '内存占用',
        type: 'bar',
        data: values.map(function (v, i) { return { value: v, itemStyle: { color: i === 0 ? cOther : (i === 3 ? cPositive : c1) } }; }),
        barMaxWidth: 26,
        itemStyle: { borderRadius: [0, 4, 4, 0] },
        label: {
          show: true, position: 'right', color: cLabel, fontFamily: FONT, fontSize: 11.5,
          formatter: function (p) { return p.value + ' GB'; }
        }
      }
    ];
    mk(el, option);
  }

  /* ---------- 图 6：外部 OOM vs 内部 OOM 的责任边界 ---------- */
  function initOomChart() {
    var el = document.getElementById('chart-oom');
    if (!el) return;

    var option = baseOption({});
    option.legend.show = false;
    option.tooltip.formatter = function (params) {
      return params[0].marker + params[0].name + '：<b>' + params[0].value + '</b>';
    };
    option.xAxis = catAxis(['外部 OOM\nOOMKilled', '内部 OOM\nOutOfMemoryError'], { inverse: true });
    option.yAxis = valAxis('判定依据数量', 4, { max: 4, min: 0, interval: 1 });
    option.series = [
      {
        name: '观测信号',
        type: 'bar',
        data: [
          { value: 4, itemStyle: { color: cNegative } },
          { value: 3, itemStyle: { color: cWarning } }
        ],
        barMaxWidth: 40,
        itemStyle: { borderRadius: [0, 4, 4, 0] },
        label: {
          show: true, position: 'right', color: cLabel, fontFamily: FONT, fontSize: 11.5,
          formatter: function (p) {
            return p.dataIndex === 0 ? 'killed / OOMKilled / 无异常栈' : '有异常栈 / HeapDump 可取';
          }
        }
      }
    ];
    mk(el, option);
  }

  /* ---------- 图 7：NMT 分类占比（示意） ---------- */
  function initNmtChart() {
    var el = document.getElementById('chart-nmt');
    if (!el) return;

    var categories = ['Java Heap', 'Class\n(Metaspace)', 'Thread\n(Stack + TLS)', 'Code\n(CodeCache)', 'GC', 'Compiler', 'Internal', 'Other'];
    var values = [64, 8, 12, 3, 5, 2, 4, 2];

    var option = baseOption({});
    option.tooltip.formatter = function (params) {
      return params[0].marker + params[0].name + '：<b>' + params[0].value + '%</b>';
    };
    option.xAxis = valAxis('%', 70, { axisLabel: { color: cLabel, fontFamily: FONT, fontSize: 11, formatter: '{value}%' } });
    option.yAxis = catAxis(categories, { inverse: true, axisLabel: { color: cText, fontFamily: FONT, fontSize: 11.5 } });
    option.series = [
      {
        name: '占 RSS 比例',
        type: 'bar',
        data: values.map(function (v) { return v; }),
        barMaxWidth: 18,
        itemStyle: { color: c1, borderRadius: [0, 4, 4, 0] },
        label: {
          show: true, position: 'right', color: cLabel, fontFamily: FONT, fontSize: 11,
          formatter: function (p) { return p.value + '%'; }
        }
      }
    ];
    mk(el, option);
  }

  function initAll() {
    try {
      initMemorySplitChart();
      initGenerationsChart();
      initObjectSizeChart();
      initThreadMemoryChart();
      initRssChart();
      initOomChart();
      initNmtChart();
    } catch (err) {
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
