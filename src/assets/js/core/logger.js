/* ============================================================
 * 墨韵工具集 · 日志系统（logger.js）
 * ------------------------------------------------------------
 * 目标：打印日志翻阅简单、内容详细、排版清晰，
 *       有统一事务 ID，方便查看调用链路。
 *
 * 核心概念：
 *   事务（Transaction）：一次完整业务动作（如"用户搜索"），
 *       ID 形如 TX-20260816-153012-a1b2（日期-时间-随机4位）。
 *   链路（Span）：事务内的调用步骤，ID 形如 S1、S2…自动递增；
 *       日志输出携带 [事务ID:链路ID]，串联整条调用路径。
 *
 * 用法：
 *   const tx = Logger.tx('用户搜索');        // 开启事务
 *   const s1 = tx.span('过滤工具');           // 开启链路
 *   s1.info('命中 3 个', {query:'md'});       // 链路内打点
 *   Logger.info('游离日志');                  // 不属于任何事务时使用
 *   tx.end();                                 // 结束并持久化摘要
 *   Logger.history();                         // 回看最近 50 条事务
 *
 * 兼容：同时支持浏览器（window/globalThis）与 Node（单测用），
 *       无 localStorage 环境自动降级为仅控制台输出。
 * ============================================================ */
(function (global) {
  'use strict';

  /** 持久化键名与历史上限（防止 localStorage 无限膨胀） */
  var STORE_KEY = 'moyun.logs';
  var MAX_HISTORY = 50;

  /** 日志级别权重：低于当前级别的输出会被忽略 */
  var LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

  /** 级别对应的 console 方法（降级安全：不存在时退回 log） */
  var CONSOLE_FN = {
    debug: 'debug', info: 'info', warn: 'warn', error: 'error'
  };

  /** 生成事务 ID：TX-<yyyymmdd-HHmmss>-<hex4> */
  function makeTxId(now) {
    var d = now instanceof Date ? now : new Date();
    var p = function (n, w) { return String(n).padStart(w || 2, '0'); };
    var rand = Math.random().toString(16).slice(2, 6);
    return 'TX-' + p(d.getFullYear()) + p(d.getMonth() + 1) + p(d.getDate())
      + '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()) + '-' + rand;
  }

  /** 时间戳：HH:mm:ss.SSS，日志行首展示 */
  function ts(d) {
    var p = function (n, w) { return String(n).padStart(w || 2, '0'); };
    return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds())
      + '.' + p(d.getMilliseconds(), 3);
  }

  /** localStorage 安全读写（隐私模式/Node 下返回 null） */
  function storeRead() {
    try { return JSON.parse(global.localStorage.getItem(STORE_KEY) || '[]'); }
    catch (e) { return []; }
  }
  function storeWrite(list) {
    try { global.localStorage.setItem(STORE_KEY, JSON.stringify(list)); }
    catch (e) { /* 存储不可用时静默降级 */ }
  }

  /** 输出一条日志行：[级别] 时间 [事务:链路] 消息 附加数据 */
  function emit(level, span, msg, data) {
    if (LEVELS[level] < Logger.level) return;
    var fn = console[CONSOLE_FN[level]] || console.log;
    var head = '[' + level.toUpperCase() + '] ' + ts(new Date())
      + ' [' + (span ? span.tx.id + ':' + span.id : '-') + '] ' + msg;
    if (data !== undefined) fn(head, data); else fn(head);
    if (span) span.logs.push({ level: level, msg: msg, data: data, at: Date.now() });
    if (level === 'error' && span) span.tx.errors++;
  }

  /* ------------------------------------------------------------
   * Span：事务内的一个链路步骤
   * ------------------------------------------------------------ */
  function Span(tx, id, name) {
    this.tx = tx; this.id = id; this.name = name; this.logs = [];
    this.startedAt = Date.now();
  }
  Span.prototype.debug = function (m, d) { emit('debug', this, m, d); return this; };
  Span.prototype.info  = function (m, d) { emit('info',  this, m, d); return this; };
  Span.prototype.warn  = function (m, d) { emit('warn',  this, m, d); return this; };
  Span.prototype.error = function (m, d) { emit('error', this, m, d); return this; };
  /** 结束链路：记录耗时并输出摘要（支持链式 tx.span().info().end()） */
  Span.prototype.end = function () {
    this.duration = Date.now() - this.startedAt;
    emit('debug', this, '← ' + this.name + ' 完成 ' + this.duration + 'ms');
    return this;
  };

  /* ------------------------------------------------------------
   * Transaction：一次业务动作
   * ------------------------------------------------------------ */
  function Transaction(name) {
    this.id = makeTxId(); this.name = name || '未命名事务';
    this.spans = []; this.errors = 0; this.startedAt = Date.now();
    if (console.groupCollapsed) {
      console.groupCollapsed('%c▶ 事务开始 ' + this.name + '  ' + this.id,
        'color:#4d6bfe;font-weight:600');
      console.log('%c  时间 ' + ts(new Date()), 'color:#9ca3af');
    }
  }
  /** 在事务内开启新链路（ID 自动递增 S1、S2…） */
  Transaction.prototype.span = function (name) {
    var s = new Span(this, 'S' + (this.spans.length + 1), name);
    this.spans.push(s);
    if (console.group) console.group('⑂ ' + s.id + ' ' + s.name);
    return s;
  };
  /** 结束事务：汇总耗时/链路数，持久化摘要 */
  Transaction.prototype.end = function () {
    this.duration = Date.now() - this.startedAt;
    if (console.groupEnd) console.groupEnd();
    console.info('%c■ 事务结束 ' + this.name + '  ' + this.id
      + '  链路 ' + this.spans.length + ' 条 · 耗时 ' + this.duration + 'ms'
      + (this.errors ? ' · 错误 ' + this.errors + ' 个' : ''),
      'color:' + (this.errors ? '#dc2626' : '#4b5563'));
    persist(this);
    return this;
  };

  /** 事务摘要写入 localStorage（保留最近 MAX_HISTORY 条） */
  function persist(tx) {
    var list = storeRead();
    list.push({
      id: tx.id, name: tx.name, at: tx.startedAt,
      spans: tx.spans.map(function (s) {
        return { id: s.id, name: s.name, logs: s.logs.length, duration: s.duration || 0 };
      }),
      errors: tx.errors, duration: tx.duration
    });
    storeWrite(list.slice(-MAX_HISTORY));
  }

  /* ------------------------------------------------------------
   * Logger：对外全局对象
   * ------------------------------------------------------------ */
  var Logger = {
    /** 当前输出门槛：debug < info < warn < error，可按需调高降噪 */
    level: LEVELS.debug,
    LEVELS: LEVELS,

    /** 开启一个事务 */
    tx: function (name) { return new Transaction(name); },

    /** 游离日志（不属于任何事务时的快捷输出） */
    debug: function (m, d) { emit('debug', null, m, d); },
    info:  function (m, d) { emit('info',  null, m, d); },
    warn:  function (m, d) { emit('warn',  null, m, d); },
    error: function (m, d) { emit('error', null, m, d); },

    /** 读取最近事务历史（浏览器持久化；Node 返回内存副本） */
    history: function () { return storeRead(); },

    /** 清空历史（调试用） */
    clearHistory: function () { storeWrite([]); },

    /** 暴露内部构造器仅供单元测试使用，业务代码勿依赖 */
    _internals: { makeTxId: makeTxId, Transaction: Transaction, Span: Span }
  };

  /* 挂载：浏览器全局 + Node module.exports 双兼容 */
  global.Logger = Logger;
  if (typeof module !== 'undefined' && module.exports) module.exports = Logger;
})(typeof window !== 'undefined' ? window : globalThis);
