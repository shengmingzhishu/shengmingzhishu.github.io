/**
 * 轻狐AI — 阿里云社区注入脚本
 * 运行在页面主 world（通过 <script src="chrome-extension://..."> 加载）
 * 负责拦截 HTMLInputElement 原型方法以注入文件上传
 */
(function () {
  if (document.documentElement.hasAttribute('data-aly-inject')) return;
  document.documentElement.setAttribute('data-aly-inject', '1');

  window.addEventListener('__ALIYUN_UPLOAD__', async function (e) {
    const { requestId, base64, fileName, fileType } = e.detail;

    const byteChars = atob(base64);
    const byteArray = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) byteArray[i] = byteChars.charCodeAt(i);
    const blob = new Blob([byteArray], { type: fileType || 'image/jpeg' });
    const file = new File([blob], fileName || 'upload.jpg', { type: blob.type });

    const btn = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent.trim() === '上传图片' && b.offsetWidth > 0
    );
    if (!btn) {
      window.dispatchEvent(new CustomEvent('__ALIYUN_RESULT__', { detail: { requestId, url: null, error: 'no button' } }));
      return;
    }

    const list = document.querySelector('.next-upload-list, [class*="upload-list"]');
    const prevCount = list ? list.children.length : 0;
    const prevUrls = new Set();
    if (list) list.querySelectorAll('img').forEach((img) => { if (img.src) prevUrls.add(img.src); });

    const origClick = HTMLInputElement.prototype.click;
    const origAE = HTMLInputElement.prototype.addEventListener;
    let intercepted = false;

    HTMLInputElement.prototype.addEventListener = function (type, handler, ...args) {
      origAE.call(this, type, handler, ...args);
      if (type === 'change' && this.type === 'file' && this.files && this.files.length > 0) {
        HTMLInputElement.prototype.addEventListener = origAE;
        setTimeout(() => handler.call(this, new Event('change')), 0);
      }
    };

    HTMLInputElement.prototype.click = function () {
      if (this.type === 'file' && !intercepted) {
        intercepted = true;
        HTMLInputElement.prototype.click = origClick;
        const dt = new DataTransfer();
        dt.items.add(file);
        this.files = dt.files;
        return;
      }
      return origClick.call(this);
    };

    btn.click();

    let url = null;
    for (let w = 0; w < 100; w++) {
      await new Promise((r) => setTimeout(r, 300));
      const el = document.querySelector('.next-upload-list, [class*="upload-list"]');
      if (el && el.children.length > prevCount) {
        const imgs = el.querySelectorAll('img');
        for (const img of imgs) {
          if (img.src && !prevUrls.has(img.src) && img.src.startsWith('http')) { url = img.src; break; }
        }
      }
      if (!url) {
        const imgs = document.querySelectorAll('img');
        for (const img of imgs) {
          if (img.src && !prevUrls.has(img.src) && (img.src.includes('.alicdn.com') || img.src.includes('aliyun')) && img.offsetWidth > 30) {
            url = img.src; break;
          }
        }
      }
      if (url) break;
    }

    HTMLInputElement.prototype.click = origClick;
    HTMLInputElement.prototype.addEventListener = origAE;

    window.dispatchEvent(new CustomEvent('__ALIYUN_RESULT__', { detail: { requestId, url } }));
  });
})();
