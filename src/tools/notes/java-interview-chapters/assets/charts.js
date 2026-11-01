/* 章节资料 — 通用图表初始化
   支持按页面存在性条件初始化多个图表；配色统一从 :root 的 chart 令牌读取。 */

(function () {
  'use strict';

  var root = document.documentElement;
  function token(name, fallback) {
    var v = getComputedStyle(root).getPropertyValue(name).trim();
    return v || fallback;
  }

  var C = {
    s1: token('--chart-series-1', '#0969DA'),
    s2: token('--chart-series-2', '#8250DF'),
    s3: token('--chart-series-3', '#06B6D4'),
    s4: token('--chart-series-4', '#BF3989'),
    other: token('--chart-other', '#D1D9E0'),
    grid: token('--chart-grid', 'rgba(31, 35, 40, 0.10)'),
    axis: token('--chart-axis', '#636C76'),
    label: token('--chart-label', '#636C76'),
    tipBg: token('--chart-tooltip-bg', '#FFFFFF'),
    text: token('--page-text', '#1F2328'),
    border: token('--page-border', '#D1D9E0')
  };
  var FONT = "'Instrument Sans', 'PingFang SC', 'Microsoft YaHei', 'Noto Sans CJK SC', sans-serif";

  /* 分类系列令牌序列（值全部来自 :root，不含硬编码色值） */
  var CATEGORY_TOKENS = [C.s1, C.s2, C.s3, C.s4];
  var CATEGORY_TOKENS_3 = [C.s1, C.s2, C.s3];

  var charts = [];

  function baseTooltip() {
    return {
      trigger: 'axis',
      appendToBody: true,
      backgroundColor: C.tipBg,
      borderColor: C.border,
      borderWidth: 1,
      padding: [8, 12],
      textStyle: { color: C.text, fontFamily: FONT, fontSize: 13 },
      axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(9, 105, 218, 0.06)' } }
    };
  }

  function baseGrid(extra) {
    return Object.assign({ left: 8, right: 24, top: 16, bottom: 8, containLabel: true }, extra || {});
  }

  function valueAxis(name) {
    return {
      type: 'value',
      name: name || '',
      nameTextStyle: { color: C.label, fontFamily: FONT, fontSize: 12 },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: C.label, fontFamily: FONT, fontSize: 11 },
      splitLine: { lineStyle: { color: C.grid, width: 1 } }
    };
  }

  function catAxis(data, inverse) {
    return {
      type: 'category',
      inverse: inverse !== false,
      data: data,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: C.text, fontFamily: FONT, fontSize: 12 }
    };
  }

  function register(el, option) {
    var chart = echarts.init(el, null, { renderer: 'svg' });
    chart.setOption(option);
    charts.push(chart);
  }

  /* ---------- 图表：复习排期时长分配 ---------- */
  function initPlanChart() {
    var el = document.getElementById('chart-plan');
    if (!el) return;

    var domains = [
      'JVM 内存与 GC',
      '并发与线程池',
      '存储层 MySQL / Redis',
      '消息队列',
      '高并发设计',
      '分布式事务',
      '分布式锁',
      'Spring 与治理',
      '可观测性',
      '分布式理论',
      '架构方法论'
    ];
    var hours = [10, 11, 11, 7, 7, 6, 5, 6, 4, 4, 3];

    register(el, {
      animation: false,
      grid: baseGrid({ right: 56 }),
      tooltip: Object.assign(baseTooltip(), {
        formatter: function (p) {
          var x = p[0];
          return x.name + '：' + x.value + ' 小时';
        }
      }),
      xAxis: valueAxis('小时'),
      yAxis: catAxis(domains),
      series: [{
        name: '建议投入时长',
        type: 'bar',
        data: hours,
        barMaxWidth: 18,
        itemStyle: { color: C.s1, borderRadius: [0, 4, 4, 0] },
        label: {
          show: true, position: 'right', color: C.label,
          fontFamily: FONT, fontSize: 11, formatter: '{c} h'
        }
      }]
    });
  }

  /* ---------- 图表：容器内存分配对比 ---------- */
  function initMemoryChart() {
    var el = document.getElementById('chart-memory');
    if (!el) return;

    var categories = [
      'Java 堆', '直接内存', '线程栈', 'Metaspace', 'Code Cache', 'GC 自身结构', '预留缓冲'
    ];
    var planA = [12, 0, 0.2, 0.5, 0.25, 0.3, 0];
    var planB = [8, 2, 0.2, 0.5, 0.25, 0.3, 4.75];

    register(el, {
      animation: false,
      grid: baseGrid({ top: 56, right: 64 }),
      legend: {
        top: 8, right: 8, icon: 'circle', itemWidth: 10, itemHeight: 10,
        textStyle: { color: C.text, fontFamily: FONT, fontSize: 13 }
      },
      tooltip: Object.assign(baseTooltip(), {
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
      }),
      xAxis: Object.assign(valueAxis('GB'), { max: 13 }),
      yAxis: catAxis(categories),
      series: [
        {
          name: '方案 A：堆给到 12GB，堆外不设限',
          type: 'bar', data: planA, barMaxWidth: 15, barGap: '18%',
          itemStyle: { color: C.other, borderRadius: [0, 4, 4, 0] },
          label: {
            show: true, position: 'right', color: C.label, fontFamily: FONT, fontSize: 11,
            formatter: function (p) { return p.value > 0 ? p.value : ''; }
          }
        },
        {
          name: '方案 B：按比例显式分配',
          type: 'bar', data: planB, barMaxWidth: 15,
          itemStyle: { color: C.s1, borderRadius: [0, 4, 4, 0] },
          label: {
            show: true, position: 'right', color: C.label, fontFamily: FONT, fontSize: 11,
            formatter: function (p) { return p.value > 0 ? p.value : ''; }
          }
        }
      ]
    });
  }

  /* ---------- 图表：JVM 三大问题的解决手段映射 ---------- */
  function initJmmChart() {
    var el = document.getElementById('chart-jmm');
    if (!el) return;

    var problems = ['原子性', '可见性', '有序性'];
    var solutions = [
      ['synchronized', 'AtomicInteger', 'LongAdder', 'CAS 自旋'],
      ['volatile', 'synchronized', 'Atomic', '并发容器'],
      ['volatile', 'synchronized', 'final', 'Happens-before']
    ];

    register(el, {
      animation: false,
      grid: baseGrid({ top: 56, right: 24 }),
      legend: {
        top: 8, right: 8, icon: 'circle', itemWidth: 10, itemHeight: 10,
        textStyle: { color: C.text, fontFamily: FONT, fontSize: 13 }
      },
      tooltip: Object.assign(baseTooltip(), {
        formatter: function (params) {
          var p = params[0];
          var list = p.seriesName;
          return '<b>' + p.name + '</b><br/>解决手段：' + list;
        }
      }),
      xAxis: Object.assign(valueAxis(''), { max: 4, splitLine: { show: false } }),
      yAxis: catAxis(problems),
      series: problems.map(function (p, i) {
        return {
          name: solutions[i].join('、'),
          type: 'scatter',
          symbolSize: 16,
          data: solutions[i].map(function (_, j) { return [j + 0.5, p]; }),
          itemStyle: { color: CATEGORY_TOKENS[i] },
          label: {
            show: true, position: 'top', color: C.label,
            fontFamily: FONT, fontSize: 11,
            formatter: function (x) { return solutions[i][x.data[0] - 0.5]; }
          }
        };
      })
    });
  }

  /* ---------- 图表：线程池执行流程的状态分布 ---------- */
  function initPoolChart() {
    var el = document.getElementById('chart-pool');
    if (!el) return;

    register(el, {
      animation: false,
      grid: baseGrid({ right: 100 }),
      tooltip: Object.assign(baseTooltip(), {
        formatter: function (p) {
          var x = p[0];
          return '<b>' + x.name + '</b><br/>动作：' + x.value;
        }
      }),
      xAxis: valueAxis(''),
      yAxis: catAxis(['任务提交', '第 1 步', '第 2 步', '第 3 步', '第 4 步']),
      series: [{
        name: '动作',
        type: 'bar',
        data: [
          '提交任务',
          '线程数 < corePoolSize → 创建核心线程',
          '入队 workQueue.offer',
          '队列满且 < maxPoolSize → 创建非核心线程',
          '达到 maxPoolSize → 触发拒绝策略'
        ],
        barMaxWidth: 20,
        itemStyle: { color: C.s1, borderRadius: [0, 4, 4, 0] },
        label: {
          show: true, position: 'right', color: C.label,
          fontFamily: FONT, fontSize: 11
        }
      }]
    });
  }

  /* ---------- 图表：收集器选型矩阵 ---------- */
  function initGcChart() {
    var el = document.getElementById('chart-gc');
    if (!el) return;

    var collectors = [
      { name: 'SerialGC', lat: 1, thr: 1, label: '小堆 / 单核' },
      { name: 'ParallelGC', lat: 2, thr: 5, label: '批处理吞吐优先' },
      { name: 'G1GC', lat: 4, thr: 4, label: '通用场景默认' },
      { name: 'ZGC', lat: 5, thr: 3, label: '大堆低延迟' },
      { name: 'Shenandoah', lat: 5, thr: 2, label: '超低延迟' }
    ];

    register(el, {
      animation: false,
      grid: baseGrid({ top: 24, right: 32, bottom: 40 }),
      tooltip: Object.assign(baseTooltip(), {
        formatter: function (p) {
          var d = p.data;
          return '<b>' + d[2] + '</b><br/>延迟表现：' + d[0] + ' / 5<br/>吞吐表现：' + d[1] + ' / 5<br/>典型场景：' + d[3];
        }
      }),
      xAxis: {
        type: 'value', min: 0, max: 5, interval: 1,
        name: '停顿延迟表现 →',
        nameLocation: 'middle', nameGap: 28,
        nameTextStyle: { color: C.label, fontFamily: FONT, fontSize: 12 },
        axisLine: { show: false }, axisTick: { show: false },
        axisLabel: { color: C.label, fontFamily: FONT, fontSize: 11 },
        splitLine: { lineStyle: { color: C.grid, width: 1 } }
      },
      yAxis: {
        type: 'value', min: 0, max: 5, interval: 1,
        name: '吞吐表现 →',
        nameTextStyle: { color: C.label, fontFamily: FONT, fontSize: 12 },
        axisLine: { show: false }, axisTick: { show: false },
        axisLabel: { color: C.label, fontFamily: FONT, fontSize: 11 },
        splitLine: { lineStyle: { color: C.grid, width: 1 } }
      },
      series: [{
        type: 'scatter',
        symbolSize: 20,
        data: collectors.map(function (c) {
          return [c.lat, c.thr, c.name, c.label];
        }),
        itemStyle: { color: C.s1 },
        label: {
          show: true, position: 'right', color: C.text,
          fontFamily: FONT, fontSize: 12,
          formatter: function (p) { return p.data[2]; }
        }
      }]
    });
  }

  /* ---------- 图表：消息不丢的三环节 ---------- */
  function initMqChart() {
    var el = document.getElementById('chart-mq');
    if (!el) return;

    var stages = [
      { name: '生产端', items: ['acks=all', 'retries', '幂等生产者', '事务消息'], risk: '发送失败无感知' },
      { name: 'Broker 端', items: ['多副本', 'min.insync.replicas', '异步刷盘', 'KRaft 元数据'], risk: '单副本且未刷盘' },
      { name: '消费端', items: ['关闭自动提交', '先处理后提交', '重试上限', '死信队列'], risk: '异常被吞 / 无死信' }
    ];

    register(el, {
      animation: false,
      grid: baseGrid({ top: 56, right: 24 }),
      legend: {
        top: 8, right: 8, icon: 'circle', itemWidth: 10, itemHeight: 10,
        textStyle: { color: C.text, fontFamily: FONT, fontSize: 13 }
      },
      tooltip: Object.assign(baseTooltip(), {
        formatter: function (params) {
          var p = params[0];
          return '<b>' + p.name + '</b><br/>关键配置：' + p.seriesName;
        }
      }),
      xAxis: Object.assign(valueAxis(''), { max: 4, splitLine: { show: false } }),
      yAxis: catAxis(stages.map(function (s) { return s.name; })),
      series: stages.map(function (s, i) {
        return {
          name: s.items.join('、'),
          type: 'scatter',
          symbolSize: 16,
          data: s.items.map(function (_, j) { return [j + 0.5, s.name]; }),
          itemStyle: { color: CATEGORY_TOKENS_3[i] },
          label: {
            show: true, position: 'top', color: C.label,
            fontFamily: FONT, fontSize: 11,
            formatter: function (x) { return s.items[x.data[0] - 0.5]; }
          }
        };
      })
    });
  }

  /* ---------- 图表：一致性模型谱系 ---------- */
  function initConsistencyChart() {
    var el = document.getElementById('chart-consistency');
    if (!el) return;

    var models = [
      { name: '线性一致性', cost: 5, avail: 1, note: '全局实时顺序' },
      { name: '顺序一致性', cost: 3, avail: 3, note: '顺序一致但非实时' },
      { name: '因果一致性', cost: 2, avail: 4, note: '因果事件有序' },
      { name: '最终一致性', cost: 1, avail: 5, note: '最终收敛' }
    ];

    register(el, {
      animation: false,
      grid: baseGrid({ top: 24, right: 32, bottom: 40 }),
      tooltip: Object.assign(baseTooltip(), {
        formatter: function (p) {
          var d = p.data;
          return '<b>' + d[2] + '</b><br/>一致性代价：' + d[0] + ' / 5<br/>可用性：' + d[1] + ' / 5<br/>' + d[3];
        }
      }),
      xAxis: {
        type: 'value', min: 0, max: 5, interval: 1,
        name: '一致性代价 →',
        nameLocation: 'middle', nameGap: 28,
        nameTextStyle: { color: C.label, fontFamily: FONT, fontSize: 12 },
        axisLine: { show: false }, axisTick: { show: false },
        axisLabel: { color: C.label, fontFamily: FONT, fontSize: 11 },
        splitLine: { lineStyle: { color: C.grid, width: 1 } }
      },
      yAxis: {
        type: 'value', min: 0, max: 5, interval: 1,
        name: '可用性 →',
        nameTextStyle: { color: C.label, fontFamily: FONT, fontSize: 12 },
        axisLine: { show: false }, axisTick: { show: false },
        axisLabel: { color: C.label, fontFamily: FONT, fontSize: 11 },
        splitLine: { lineStyle: { color: C.grid, width: 1 } }
      },
      series: [{
        type: 'scatter',
        symbolSize: 20,
        data: models.map(function (m) {
          return [m.cost, m.avail, m.name, m.note];
        }),
        itemStyle: { color: C.s1 },
        label: {
          show: true, position: 'right', color: C.text,
          fontFamily: FONT, fontSize: 12,
          formatter: function (p) { return p.data[2]; }
        }
      }]
    });
  }

  /* ---------- 图表：质量属性六维 ---------- */
  function initQualityChart() {
    var el = document.getElementById('chart-quality');
    if (!el) return;

    var attrs = [
      { name: '可用性', impact: 5, effort: 4 },
      { name: '可扩展性', impact: 4, effort: 4 },
      { name: '性能', impact: 4, effort: 3 },
      { name: '一致性', impact: 4, effort: 5 },
      { name: '安全性', impact: 3, effort: 3 },
      { name: '可维护性', impact: 4, effort: 3 }
    ];

    register(el, {
      animation: false,
      grid: baseGrid({ top: 24, right: 32, bottom: 40 }),
      tooltip: Object.assign(baseTooltip(), {
        formatter: function (p) {
          var d = p.data;
          return '<b>' + d[2] + '</b><br/>业务影响权重：' + d[0] + ' / 5<br/>实现成本：' + d[1] + ' / 5';
        }
      }),
      xAxis: {
        type: 'value', min: 0, max: 5, interval: 1,
        name: '实现成本 →',
        nameLocation: 'middle', nameGap: 28,
        nameTextStyle: { color: C.label, fontFamily: FONT, fontSize: 12 },
        axisLine: { show: false }, axisTick: { show: false },
        axisLabel: { color: C.label, fontFamily: FONT, fontSize: 11 },
        splitLine: { lineStyle: { color: C.grid, width: 1 } }
      },
      yAxis: {
        type: 'value', min: 0, max: 5, interval: 1,
        name: '业务影响权重 →',
        nameTextStyle: { color: C.label, fontFamily: FONT, fontSize: 12 },
        axisLine: { show: false }, axisTick: { show: false },
        axisLabel: { color: C.label, fontFamily: FONT, fontSize: 11 },
        splitLine: { lineStyle: { color: C.grid, width: 1 } }
      },
      series: [{
        type: 'scatter',
        symbolSize: 22,
        data: attrs.map(function (a) {
          return [a.effort, a.impact, a.name];
        }),
        itemStyle: { color: C.s1 },
        label: {
          show: true, position: 'right', color: C.text,
          fontFamily: FONT, fontSize: 12,
          formatter: function (p) { return p.data[2]; }
        }
      }]
    });
  }

  /* ---------- 图表：Redis 淘汰策略对比 ---------- */
  function initRedisChart() {
    var el = document.getElementById('chart-redis');
    if (!el) return;

    register(el, {
      animation: false,
      grid: baseGrid({ right: 150 }),
      tooltip: Object.assign(baseTooltip(), {
        formatter: function (p) {
          var x = p[0];
          return '<b>' + x.name + '</b><br/>' + x.value;
        }
      }),
      xAxis: valueAxis(''),
      yAxis: catAxis([
        'noeviction', 'allkeys-lru', 'allkeys-lfu', 'volatile-lru', 'volatile-lfu'
      ]),
      series: [{
        name: '策略',
        type: 'bar',
        data: [
          '不淘汰，写命令直接返回错误',
          '从所有键中淘汰最近最少使用的',
          '从所有键中淘汰访问频率最低的',
          '只从设了过期时间的键中淘汰',
          '只从设了过期时间的键中按频率淘汰'
        ],
        barMaxWidth: 18,
        itemStyle: { color: C.s1, borderRadius: [0, 4, 4, 0] },
        label: {
          show: true, position: 'right', color: C.label,
          fontFamily: FONT, fontSize: 11
        }
      }]
    });
  }

  /* ---------- 图表：MVCC 可见性判断 ---------- */
  function initMvccChart() {
    var el = document.getElementById('chart-mvcc');
    if (!el) return;

    register(el, {
      animation: false,
      grid: baseGrid({ top: 24, right: 32, bottom: 40 }),
      tooltip: Object.assign(baseTooltip(), {
        formatter: function (p) {
          var d = p.data;
          return '<b>' + d[2] + '</b><br/>一致性强度：' + d[0] + ' / 5<br/>可用性：' + d[1] + ' / 5';
        }
      }),
      xAxis: {
        type: 'value', min: 0, max: 5, interval: 1,
        name: '一致性强度 →',
        nameLocation: 'middle', nameGap: 28,
        nameTextStyle: { color: C.label, fontFamily: FONT, fontSize: 12 },
        axisLine: { show: false }, axisTick: { show: false },
        axisLabel: { color: C.label, fontFamily: FONT, fontSize: 11 },
        splitLine: { lineStyle: { color: C.grid, width: 1 } }
      },
      yAxis: {
        type: 'value', min: 0, max: 5, interval: 1,
        name: '可用性 →',
        nameTextStyle: { color: C.label, fontFamily: FONT, fontSize: 12 },
        axisLine: { show: false }, axisTick: { show: false },
        axisLabel: { color: C.label, fontFamily: FONT, fontSize: 11 },
        splitLine: { lineStyle: { color: C.grid, width: 1 } }
      },
      series: [{
        type: 'scatter',
        symbolSize: 20,
        data: [
          [5, 1, '线性一致性', 'CAP 中只能选 CP'],
          [4, 3, 'RR + Next-Key Lock', 'MySQL 默认，可避免幻读'],
          [3, 4, 'RC + MVCC', '每次快照读生成新 ReadView'],
          [2, 4, '因果一致性', '会话场景'],
          [1, 5, '最终一致性', '需收敛机制']
        ],
        itemStyle: { color: C.s1 },
        label: {
          show: true, position: 'right', color: C.text,
          fontFamily: FONT, fontSize: 12,
          formatter: function (p) { return p.data[2]; }
        }
      }]
    });
  }

  /* ---------- 图表：可观测性三支柱与用途 ---------- */
  function initObsChart() {
    var el = document.getElementById('chart-obs');
    if (!el) return;

    register(el, {
      animation: false,
      grid: baseGrid({ top: 24, right: 32, bottom: 40 }),
      tooltip: Object.assign(baseTooltip(), {
        formatter: function (p) {
          var d = p.data;
          return '<b>' + d[2] + '</b><br/>存储成本：' + d[0] + ' / 5<br/>定位精度：' + d[1] + ' / 5';
        }
      }),
      xAxis: {
        type: 'value', min: 0, max: 5, interval: 1,
        name: '定位精度 →',
        nameLocation: 'middle', nameGap: 28,
        nameTextStyle: { color: C.label, fontFamily: FONT, fontSize: 12 },
        axisLine: { show: false }, axisTick: { show: false },
        axisLabel: { color: C.label, fontFamily: FONT, fontSize: 11 },
        splitLine: { lineStyle: { color: C.grid, width: 1 } }
      },
      yAxis: {
        type: 'value', min: 0, max: 5, interval: 1,
        name: '存储成本 →',
        nameTextStyle: { color: C.label, fontFamily: FONT, fontSize: 12 },
        axisLine: { show: false }, axisTick: { show: false },
        axisLabel: { color: C.label, fontFamily: FONT, fontSize: 11 },
        splitLine: { lineStyle: { color: C.grid, width: 1 } }
      },
      series: [{
        type: 'scatter',
        symbolSize: 22,
        data: [
          [5, 1, 'Logging（日志）', '排障取证，不用于告警'],
          [3, 2, 'Tracing（链路）', '分布式排障，采样可控'],
          [2, 5, 'Metrics（指标）', '趋势聚合，告警首选']
        ],
        itemStyle: { color: C.s1 },
        label: {
          show: true, position: 'right', color: C.text,
          fontFamily: FONT, fontSize: 12,
          formatter: function (p) { return p.data[2]; }
        }
      }]
    });
  }

  /* ---------- 图表：隔离级别与并发问题 ---------- */
  function initIsolationChart() {
    var el = document.getElementById('chart-isolation');
    if (!el) return;

    register(el, {
      animation: false,
      grid: baseGrid({ top: 56, right: 24 }),
      legend: {
        top: 8, right: 8, icon: 'circle', itemWidth: 10, itemHeight: 10,
        textStyle: { color: C.text, fontFamily: FONT, fontSize: 13 }
      },
      tooltip: Object.assign(baseTooltip(), {
        formatter: function (p) {
          var lines = p.map(function (x) {
            return x.marker + x.seriesName + '：' + (x.value === 1 ? '可能出现' : '不会');
          });
          return lines.join('<br/>');
        }
      }),
      xAxis: {
        type: 'category',
        data: ['脏读', '不可重复读', '幻读'],
        axisLine: { show: false }, axisTick: { show: false },
        axisLabel: { color: C.text, fontFamily: FONT, fontSize: 12 }
      },
      yAxis: {
        type: 'category',
        inverse: false,
        data: ['串行化', '可重复读 RR', '读已提交 RC', '读未提交 RU'],
        axisLine: { show: false }, axisTick: { show: false },
        axisLabel: { color: C.text, fontFamily: FONT, fontSize: 12 }
      },
      series: [
        {
          name: '脏读', type: 'bar', stack: 'x', barMaxWidth: 24,
          data: [0, 0, 0, 1],
          itemStyle: { color: C.s1 },
          label: { show: true, position: 'inside', color: '#FFFFFF', fontFamily: FONT, fontSize: 11, formatter: '{c}' }
        },
        {
          name: '不可重复读', type: 'bar', stack: 'x', barMaxWidth: 24,
          data: [0, 0, 1, 1],
          itemStyle: { color: C.s2 },
          label: { show: true, position: 'inside', color: '#FFFFFF', fontFamily: FONT, fontSize: 11, formatter: '{c}' }
        },
        {
          name: '幻读', type: 'bar', stack: 'x', barMaxWidth: 24,
          data: [0, 0, 1, 1],
          itemStyle: { color: C.s3 },
          label: { show: true, position: 'inside', color: '#FFFFFF', fontFamily: FONT, fontSize: 11, formatter: '{c}' }
        }
      ]
    });
  }

  var inits = [
    initPlanChart, initMemoryChart, initJmmChart, initPoolChart,
    initGcChart, initMqChart, initConsistencyChart, initQualityChart,
    initRedisChart, initMvccChart, initObsChart, initIsolationChart
  ];

  function initAll() {
    inits.forEach(function (fn) {
      try {
        fn();
      } catch (err) {
        var el = document.getElementById('chart-plan') || document.querySelector('.chart-box');
        if (el && !el.querySelector('p')) {
          var p = document.createElement('p');
          p.style.cssText = 'padding:24px;color:' + C.label + ';font-size:13px;text-align:center;';
          p.textContent = '图表数据加载失败，请查看浏览器控制台。';
          el.appendChild(p);
        }
        if (window.console && console.error) console.error('[charts] init failed:', err);
      }
    });

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
