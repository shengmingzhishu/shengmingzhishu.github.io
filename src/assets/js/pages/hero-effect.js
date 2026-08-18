/* ============================================================
 * 墨韵 · hero 背景特效（hero-effect.js）v3.1
 * ------------------------------------------------------------
 * 功能：
 *   1) Canvas 鼠标轨迹擦除：鼠标划过 hero 时按轨迹"擦除"遮罩，
 *      露出底层的品牌蓝调渐变圆点图案（方案移植自
 *      history/old-format-project/index.html 的 Canvas 擦除效果）；
 *   2) 仅 hover:hover 设备生效（触摸设备自动跳过，避免误触）。
 * 依赖：css/home.css 的 .hero__pattern（底层图案）与
 *       .hero__gloss（默认光泽晕染动画），本脚本只负责擦除遮罩。
 * 交互记录：擦除过程属于展示型特效，不写入 Logger（不产生业务噪音）。
 * ============================================================ */
(function (global) {
  'use strict';
  if (typeof document === 'undefined') return;

  var hero = document.getElementById('hero');
  var canvas = document.getElementById('heroMask');
  if (!hero || !canvas) return;

  // 仅悬停设备生效，触摸设备跳过
  if (!window.matchMedia || !window.matchMedia('(hover: hover)').matches) return;

  var ctx = canvas.getContext('2d');
  if (!ctx) return;

  var MASK = '255, 255, 255';       // 遮罩底色 = 页面底色（白），擦除后露出图案
  var R_START = 8;                  // 擦除半径起始
  var R_END = 128;                  // 擦除半径最大
  var R_VARY = 0.45;                // 半径随机浮动比例
  var LIFETIME = 520;               // 每个印记生命周期（ms）
  var STAMP_STEP = 12;              // 轨迹采样间距（px）
  var MAX_STAMPS = 160;             // 同时存在的印记上限
  var DPR = Math.min(window.devicePixelRatio || 1, 2);

  var w = 0, h = 0;
  /** 初始化/重置画布尺寸（DPR 适配） */
  function resize() {
    var rect = hero.getBoundingClientRect();
    w = rect.width;
    h = rect.height;
    canvas.width = Math.round(w * DPR);
    canvas.height = Math.round(h * DPR);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgb(' + MASK + ')';
    ctx.fillRect(0, 0, w, h);
  }
  resize();
  window.addEventListener('resize', resize);

  var stamps = [];
  var lastX = null, lastY = null;

  /** 记录一个擦除印记 */
  function addStamp(x, y) {
    if (stamps.length >= MAX_STAMPS) stamps.shift();
    stamps.push({
      x: x, y: y,
      born: performance.now(),
      seed: Math.random() * Math.PI * 2,
      rmax: R_END * (1 - R_VARY + Math.random() * R_VARY)
    });
  }

  /** 沿鼠标轨迹按采样步长补点，保证快速滑动不留空隙 */
  function stampAlong(x, y) {
    if (lastX === null) {
      addStamp(x, y);
    } else {
      var dx = x - lastX, dy = y - lastY;
      var dist = Math.hypot(dx, dy);
      var steps = Math.max(1, Math.ceil(dist / STAMP_STEP));
      for (var i = 1; i <= steps; i++)
        addStamp(lastX + (dx * i) / steps, lastY + (dy * i) / steps);
    }
    lastX = x; lastY = y;
  }

  /** 绘制一个不规则墨渍（destination-out 擦除遮罩） */
  function carveInk(x, y, r, alpha, seed) {
    var g = ctx.createRadialGradient(x, y, r * 0.25, x, y, r);
    g.addColorStop(0, 'rgba(0,0,0,' + (0.95 * alpha) + ')');
    g.addColorStop(0.55, 'rgba(0,0,0,' + (0.88 * alpha) + ')');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    var segs = 32;
    for (var i = 0; i <= segs; i++) {
      var a = (i / segs) * Math.PI * 2;
      var wob = 0.78 + 0.14 * Math.sin(a * 3 + seed) + 0.08 * Math.sin(a * 7 + seed * 2.1) + 0.05 * Math.sin(a * 13 + seed * 0.7);
      var rr = r * wob;
      var px = x + Math.cos(a) * rr;
      var py = y + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }

  var running = false;
  /** 动画循环：每帧重绘遮罩并擦除活跃印记，印记清空后停止 */
  function loop() {
    var now = performance.now();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgb(' + MASK + ')';
    ctx.fillRect(0, 0, w, h);

    ctx.globalCompositeOperation = 'destination-out';
    for (var i = stamps.length - 1; i >= 0; i--) {
      var t = (now - stamps[i].born) / LIFETIME;
      if (t >= 1) { stamps.splice(i, 1); continue; }
      var ease = 1 - Math.pow(1 - t, 3);
      var r = R_START + (stamps[i].rmax - R_START) * ease;
      var alpha = 1 - t * t;
      carveInk(stamps[i].x, stamps[i].y, r, alpha, stamps[i].seed);
    }

    if (stamps.length) requestAnimationFrame(loop);
    else running = false;
  }

  function start() { if (!running) { running = true; requestAnimationFrame(loop); } }

  hero.addEventListener('mouseenter', function (e) {
    var rect = hero.getBoundingClientRect();
    lastX = e.clientX - rect.left;
    lastY = e.clientY - rect.top;
    stampAlong(lastX, lastY);
    start();
  });

  hero.addEventListener('mousemove', function (e) {
    var rect = hero.getBoundingClientRect();
    stampAlong(e.clientX - rect.left, e.clientY - rect.top);
    start();
  });

  hero.addEventListener('mouseleave', function () {
    lastX = null; lastY = null;
  });
})(typeof window !== 'undefined' ? window : globalThis);
