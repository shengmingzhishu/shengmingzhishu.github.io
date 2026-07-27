/**
 * 轻狐AI Chrome 插件 — 轻狐AI 页面注入脚本
 * 运行在轻狐AI Web 应用页面上
 *
 * 职责：
 * 1. 监听 window.postMessage，接收文章列表的发布请求
 * 2. 通过 chrome.runtime.sendMessage 转发给 background
 * 3. 接收 background 的回调，通过 postMessage 通知页面
 */

(function () {
  'use strict';

  // 防止重复注入
  if (window.__contentaiExtensionInjected) return;
  window.__contentaiExtensionInjected = true;

  console.log('[轻狐AI Extension] 注入脚本已加载');

  /* ========== 自动获取登录 Token ==========
   * 轻狐AI 前端登录后将 token 存储在 localStorage['contentai-token']
   * 插件在轻狐AI 页面上运行，可直接读取 localStorage
   * 读取后发送给 background service worker 存储，用于后续 API 调用
   */
  function captureAndSendToken() {
    try {
      const token = localStorage.getItem('contentai-token');
      if (token) {
        chrome.runtime.sendMessage({
          action: 'SAVE_TOKEN',
          token: token,
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.warn('[轻狐AI Extension] Token 同步失败:', chrome.runtime.lastError.message);
          } else {
            console.log('[轻狐AI Extension] 登录 Token 已自动同步到插件');
          }
        });
      } else {
            console.warn('[轻狐AI Extension] 未检测到登录 Token，请先登录轻狐AI');
      }
    } catch (e) {
      console.error('[轻狐AI Extension] 读取 Token 出错:', e);
    }
  }

  // 立即获取一次
  captureAndSendToken();

  // 监听 localStorage 变化（登录/登出时自动更新）
  window.addEventListener('storage', (event) => {
    if (event.key === 'contentai-token') {
      console.log('[轻狐AI Extension] 检测到 Token 变化，重新同步');
      captureAndSendToken();
    }
  });

  // 定期检查 token（覆盖同页面内登录场景，storage 事件不触发）
  let _lastToken = localStorage.getItem('contentai-token') || '';
  setInterval(() => {
    const currentToken = localStorage.getItem('contentai-token') || '';
    if (currentToken !== _lastToken) {
      _lastToken = currentToken;
      console.log('[轻狐AI Extension] 检测到 Token 变化（轮询），重新同步');
      captureAndSendToken();
    }
  }, 5000);

  /* ========== 监听来自页面的发布消息 ========== */
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;

    // 发布请求
    if (event.data.type === 'CONTENTAI_PUBLISH') {
      const { article, platform } = event.data;
      console.log('[轻狐AI Extension] 收到发布请求:', platform, article.title);

      // 预处理文章数据：生成 content_html 和 content_text
      // 这样各平台 content script 可直接使用，无需各自转换
      let galleryImages = article.gallery_images || [];
      if (typeof galleryImages === 'string') {
        try { galleryImages = JSON.parse(galleryImages); } catch (e) { galleryImages = []; }
      }
      if (!Array.isArray(galleryImages)) galleryImages = [];

      // 规范化图片 URL（normalizeImageUrl 由 lib/url-utils.js 提供）
      galleryImages = galleryImages.map(normalizeImageUrl);
      const coverImage = normalizeImageUrl(article.cover_image || '');

      const enrichedArticle = Object.assign({}, article, {
        content_html: article.content_html || markdownToHtml(article.content || ''),
        content_text: article.content_text || markdownToText(article.content || ''),
        gallery_images: galleryImages,
        cover_image: coverImage,
      });

      chrome.runtime.sendMessage(
        {
          action: 'PUBLISH_ARTICLE',
          article: enrichedArticle,
          platform,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            window.postMessage(
              {
                type: 'CONTENTAI_PUBLISH_RESULT',
                success: false,
                error: chrome.runtime.lastError.message,
              },
              '*'
            );
          } else {
            window.postMessage(
              {
                type: 'CONTENTAI_PUBLISH_RESULT',
                success: true,
                ...response,
              },
              '*'
            );
          }
        }
      );
    }

    // 检测插件是否可用
    if (event.data.type === 'CONTENTAI_CHECK_EXTENSION') {
      window.postMessage({ type: 'CONTENTAI_EXTENSION_READY' }, '*');
    }
  });

  /* ========== 监听来自 background 的消息 ========== */
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // 填充完成通知
    if (message.action === 'FILL_COMPLETE') {
      window.postMessage(
        {
          type: 'CONTENTAI_FILL_COMPLETE',
          platform: message.platform,
          success: message.success,
          error: message.error || '',
        },
        '*'
      );
    }

    // 发布完成通知
    if (message.action === 'PUBLISH_COMPLETE') {
      window.postMessage(
        {
          type: 'CONTENTAI_PUBLISH_COMPLETE',
          platform: message.platform,
          url: message.url || '',
          articleId: message.articleId || '',
        },
        '*'
      );
    }

    sendResponse({ ok: true });
  });

  /* ========== 通知页面插件已就绪 ========== */
  // 页面加载后立即通知，让文章列表显示"浏览器发布"按钮
  function notifyReady() {
    window.postMessage({ type: 'CONTENTAI_EXTENSION_READY' }, '*');
    console.log('[轻狐AI Extension] 已通知页面插件就绪');
  }

  // 立即通知 + 延迟再通知一次（确保页面 JS 已加载）
  notifyReady();
  setTimeout(notifyReady, 1500);
  setTimeout(notifyReady, 3000);
})();
