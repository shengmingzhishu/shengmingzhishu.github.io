// V11 实测脚本：验证文字缩放/旋转/拖拽、第二文字、样式预设、提示窗口
const puppeteer = require('puppeteer-core');
const path = require('path');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const URL_ = 'file:///D:/workspace-AiGithub/LeeCommonWxMDFormatHtml/tools/emoji/emoji-splitter-v11.html';
const OUT = path.join(__dirname, '_tmp_v11_test.png');

const results = [];
function check(name, cond, extra) {
  results.push({ name, pass: !!cond, extra: extra || '' });
  console.log((cond ? '  ✓ ' : '  ✗ FAIL ') + name + (extra ? '  [' + extra + ']' : ''));
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  const consoleErrors = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', e => consoleErrors.push('PAGEERROR: ' + e.message));
  await page.goto(URL_, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 300));

  // 0) 页面加载无 JS 错误
  check('页面加载无JS错误', consoleErrors.length === 0, consoleErrors.join(' | ').slice(0, 200));

  // T13: smartAvoid 已移除
  const hasSmartAvoid = await page.evaluate(() => !!document.getElementById('smartAvoid'));
  check('T13 smartAvoid已移除', hasSmartAvoid === false);

  // 注入测试网格图 + 初始化拆分，并计数 despeckle/cleanWhiteEdges 调用次数
  const splitStart = await page.evaluate(async () => {
    try {
      const c = document.createElement('canvas'); c.width = 600; c.height = 400;
      const x = c.getContext('2d');
      const colors = ['#fdd', '#dfd', '#ddf', '#fcd', '#cfd', '#dcf'];
      for (let r = 0; r < 2; r++) for (let cc = 0; cc < 3; cc++) {
        x.fillStyle = colors[r * 3 + cc]; x.fillRect(cc * 200, r * 200, 200, 200);
        x.fillStyle = '#000'; x.font = '40px sans-serif'; x.textAlign = 'center';
        x.fillText(String(r * 3 + cc + 1), cc * 200 + 100, r * 200 + 120);
      }
      const blob = await new Promise(r => c.toBlob(r, 'image/png'));
      const burl = URL.createObjectURL(blob);
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = burl; });
      state.originalImage = img;
      state.originalBlob = burl;
      // 计数器
      window.__dsp = 0; window.__cwe = 0; window.__cwl = 0;
      const _dsp = despeckleCanvas, _cwe = cleanWhiteEdges, _cwl = cleanWhiteLines;
      despeckleCanvas = function(){ window.__dsp++; return _dsp.apply(this, arguments); };
      cleanWhiteEdges = function(){ window.__cwe++; return _cwe.apply(this, arguments); };
      cleanWhiteLines = function(){ window.__cwl++; return _cwl.apply(this, arguments); };
      initSplit(); // 异步：内部 processImage 有 setTimeout
      return { ok: true };
    } catch (e) { return { ok: false, err: e.message }; }
  });
  await new Promise(r => setTimeout(r, 800));
  // 等待异步拆分完成后读取计数
  const splitInfo = await page.evaluate(() => ({
    n: state.emojis.length,
    dsp: window.__dsp, cwe: window.__cwe, cwl: window.__cwl
  }));
  check('初始化拆分产生6个表情', splitInfo.n === 6, JSON.stringify(splitInfo));
  // 每格应调用 despeckle 2 次 / cleanWhiteEdges 2 次 / cleanWhiteLines 2 次 -> 6格 = 12次
  check('T1 清斑点每格2次(共12)', splitInfo.dsp === 12, 'dsp=' + splitInfo.dsp);
  check('T2 去白边每格2次(共12)', splitInfo.cwe === 12, 'cwe=' + splitInfo.cwe);

  // 文字渲染纯函数测试：用隔离 canvas 只画文字，测像素 bbox
  const textTest = await page.evaluate(() => {
    function bboxOf(scale, rot) {
      const cv = document.createElement('canvas'); cv.width = 200; cv.height = 200;
      const ctx = cv.getContext('2d');
      const emoji = state.emojis[0];
      const styles = getEffectiveStyles(emoji, 200 / 240, 1);
      styles.textScale = scale; styles.textRotation = rot;
      styles.textDragX = 0; styles.textDragY = 0;
      drawTextOnCanvas(ctx, '测试文字', 200, 200, styles);
      const d = ctx.getImageData(0, 0, 200, 200).data;
      let minX = 999, minY = 999, maxX = -1, maxY = -1, cnt = 0;
      for (let y = 0; y < 200; y++) for (let x = 0; x < 200; x++) {
        const a = d[(y * 200 + x) * 4 + 3];
        if (a > 20) { cnt++; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
      }
      return { w: maxX - minX, h: maxY - minY, cnt, minX, minY };
    }
    const s1 = bboxOf(1, 0);
    const s15 = bboxOf(1.5, 0);
    const r45 = bboxOf(1, 45);
    return { s1, s15, r45 };
  });
  check('T5 文字缩放生效(h1.5≈1.5×h1)', textTest.s15.h > textTest.s1.h * 1.3 && textTest.s15.h < textTest.s1.h * 1.8,
    'h1=' + textTest.s1.h + ' h1.5=' + textTest.s15.h);
  check('T6 文字旋转生效(45°bbox增大)', textTest.r45.w > textTest.s1.w * 1.2 || textTest.r45.h > textTest.s1.h * 1.2,
    'w1=' + textTest.s1.w + ' w45=' + textTest.r45.w + ' h45=' + textTest.r45.h);

  // T7: 文字拖拽 -- 直接设置 textPosX/Y，验证 drawTextOnCanvas 应用偏移（之前bug）
  const dragTest = await page.evaluate(() => {
    const emoji = state.emojis[0];
    function minXAt(dragX) {
      const cv = document.createElement('canvas'); cv.width = 200; cv.height = 200;
      const ctx = cv.getContext('2d');
      const styles = getEffectiveStyles(emoji, 200 / 240, 1);
      styles.textScale = 1; styles.textRotation = 0; styles.textDragX = dragX; styles.textDragY = 0;
      drawTextOnCanvas(ctx, '拖', 200, 200, styles);
      const d = ctx.getImageData(0, 0, 200, 200).data;
      let minX = 999;
      for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 20) { const p = (i / 4) % 200; if (p < minX) minX = p; }
      return minX;
    }
    const a = minXAt(0), b = minXAt(20);
    return { a, b, moved: b - a };
  });
  check('T7 文字拖拽偏移生效(修复bug)', dragTest.moved > 5, 'minX 0->20: ' + dragTest.a + '->' + dragTest.b + ' (Δ=' + dragTest.moved + ')');

  // T8: 第二文字独立位置 -- 设置 text2 + text2PosX，验证 text2Bounds 与 text1Bounds 不重叠/位置不同
  const t2Test = await page.evaluate(() => {
    const emoji = state.emojis[0];
    emoji.text = '第一';
    emoji.text2 = '第二';
    emoji.custom.text2PosX = -25; // 往左挪
    renderEmojiPreview(0);
    const b1 = emoji.textBounds, b2 = emoji.text2Bounds;
    // 直接画 text2 验证它确实出现在偏移位置
    const cv = document.createElement('canvas'); cv.width = 200; cv.height = 200;
    const ctx = cv.getContext('2d');
    const s2 = getEffectiveStyles(emoji, 200 / 240, 2);
    drawTextOnCanvas(ctx, '第二', 200, 200, s2);
    const d = ctx.getImageData(0, 0, 200, 200).data;
    let minX = 999;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 20) { const p = (i / 4) % 200; if (p < minX) minX = p; }
    return { b1: !!b1, b2: !!b2, b2x: b2 ? b2.x : null, text2minX: minX };
  });
  check('T8 第二文字渲染且bounds存在', t2Test.b1 && t2Test.b2, JSON.stringify({ b2x: t2Test.b2x, text2minX: t2Test.text2minX }));

  // T9: 样式预设（气泡/丝带/贴纸）不崩溃且产生背景像素
  const styleTest = await page.evaluate(() => {
    const emoji = state.emojis[0];
    function fillPixels(type) {
      const cv = document.createElement('canvas'); cv.width = 200; cv.height = 200;
      const ctx = cv.getContext('2d');
      const styles = getEffectiveStyles(emoji, 200 / 240, 1);
      styles.textScale = 1; styles.textRotation = 0; styles.textDragX = 0; styles.textDragY = 0;
      styles.textStyleType = type;
      // 贴纸/气泡用不同底色参数
      styles.stickerBg = '#ffffff'; styles.stickerRadius = 8; styles.stickerPad = 6;
      styles.bgBarColor = '#000000'; styles.bgOpacity = 0.9; styles.bubbleTail = 'down';
      drawTextOnCanvas(ctx, '样式', 200, 200, styles);
      const d = ctx.getImageData(0, 0, 200, 200).data;
      let cnt = 0;
      for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 20) cnt++;
      return cnt;
    }
    const plain = fillPixels('plain');
    const bubble = fillPixels('bubble');
    const ribbon = fillPixels('ribbon');
    const sticker = fillPixels('sticker');
    return { plain, bubble, ribbon, sticker };
  });
  check('T9 气泡样式渲染(有背景像素)', styleTest.bubble > styleTest.plain, JSON.stringify(styleTest));
  check('T9 贴纸样式渲染(有背景像素)', styleTest.sticker > styleTest.plain, '');
  check('T9 丝带样式渲染(有背景像素)', styleTest.ribbon > styleTest.plain, '');

  // T10/T11: 提示窗口
  const hintTest = await page.evaluate(() => {
    openHintPanel();
    const modalShow = document.getElementById('hintModal').classList.contains('show');
    const catsCount = document.querySelectorAll('#hintCats .hint-cat').length;
    const wordsCount = document.querySelectorAll('#hintWords .hint-chip').length;
    switchHintTab('prompt');
    genAIPrompt();
    const promptVal = document.getElementById('hintPromptOut').value;
    const linksCount = document.querySelectorAll('#hintLinks a').length;
    return { modalShow, catsCount, wordsCount, promptVal: promptVal.slice(0, 60), linksCount };
  });
  check('T10 提示窗口打开+词典分类/词', hintTest.modalShow && hintTest.catsCount > 0 && hintTest.wordsCount > 0, JSON.stringify({ cats: hintTest.catsCount, words: hintTest.wordsCount }));
  check('T11 AI提示词生成(非空含5×5)', hintTest.promptVal.includes('5×5') && hintTest.promptVal.includes('网格'), hintTest.promptVal);
  check('T12 常用链接渲染', hintTest.linksCount >= 3, 'links=' + hintTest.linksCount);

  // 截图最终预览
  const card = await page.$('.emoji-card .preview canvas');
  if (card) { await card.screenshot({ path: OUT }); console.log('shot:', OUT); }

  await browser.close();
  const passed = results.filter(r => r.pass).length;
  console.log('\n==== ' + passed + '/' + results.length + ' passed ====');
  process.exit(passed === results.length ? 0 : 1);
})();
