// 临时实测脚本：验证 v11 预览视口定位框是否真渲染
const puppeteer = require('puppeteer-core');
const path = require('path');
const os = require('os');

const CHROME = path.join(os.homedir(), '.cache/puppeteer/chrome/win64-150.0.7871.24/chrome-win64/chrome.exe');
const URL_ = 'file:///D:/workspace-AiGithub/LeeCommonWxMDFormatHtml/tools/emoji/emoji-splitter-v11.html';
const OUT = path.join(__dirname, '_tmp_preview.png');

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(URL_, { waitUntil: 'networkidle0' });

  const result = await page.evaluate(async () => {
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
      $('uploadPreview').style.display='block';
      $('gridCard').style.display='block';
      $('cutoutCard').style.display='block';
      initViewport();
      drawPreview();
      return 'ok';
    } catch (e) { return 'ERR:' + e.message + ' | state?' + (typeof state); }
  });
  console.log('inject:', result);
  await new Promise(r => setTimeout(r, 400));

  const px = await page.evaluate(() => {
    const cv = document.getElementById('previewCanvas');
    if (!cv) return { err: 'no canvas' };
    const x = cv.getContext('2d');
    const d = x.getImageData(0, 0, cv.width, cv.height).data;
    let green = 0, nonWhite = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (Math.abs(d[i] - 7) < 50 && Math.abs(d[i + 1] - 193) < 50 && Math.abs(d[i + 2] - 96) < 50) green++;
      if (d[i] < 240 || d[i + 1] < 240 || d[i + 2] < 240) nonWhite++;
    }
    return { w: cv.width, h: cv.height, greenPixels: green, nonWhitePixels: nonWhite };
  });
  console.log('pixel:', JSON.stringify(px));

  const el = await page.$('#previewCanvas');
  if (el) { await el.screenshot({ path: OUT }); console.log('shot:', OUT); }
  await browser.close();
})();
