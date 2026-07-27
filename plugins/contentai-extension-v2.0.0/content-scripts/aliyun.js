/**
 * 轻狐AI Chrome 插件 — 阿里云社区 Content Script
 * 运行在 developer.aliyun.com 域名下
 */
(function () {
  'use strict';

  const PLATFORM = 'aliyun';
  let isProcessing = false;

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'FILL_CONTENT' && message.platform === PLATFORM) {
      sendResponse({ ok: true });
      if (isProcessing) return;
      isProcessing = true;
      fillAliyunArticle(message.article);
    }
  });

  async function fillAliyunArticle(article) {
    const steps = ['等待编辑器加载', '复制标题', '复制正文', '上传封面图', '添加标签', '完成'];
    let currentStep = 0;
    const progressImages = {};

    if (article.cover_image) {
      progressImages.cover = { url: article.cover_image, name: '封面图片.jpg' };
    }

    const markdownContent = article.content || '';
    const htmlContent = article.content_html || markdownToHtml(markdownContent);
    const clipboardData = {
      1: { text: article.title || '未命名文章', label: '📋 复制标题' },
      2: { text: markdownContent, html: htmlContent, label: '📋 复制正文' },
    };

    const actionButtons = {
      3: {
        label: '🚀 执行',
        loadingText: '⏳ 执行中...',
        doneText: '✅ 已完成',
        failText: '❌ 失败',
        onClick: async () => {
          if (!article.cover_image) return;
          await uploadCoverAliyun(article.cover_image);
        },
      },
      4: {
        label: '🚀 执行',
        loadingText: '⏳ 执行中...',
        doneText: '✅ 已完成',
        failText: '❌ 失败',
        onClick: async () => {
          if (!article.tags) return;
          const tags = String(article.tags).split(',').map(t => t.trim().replace(/^#/, '')).filter(Boolean).slice(0, 5);
          for (const tag of tags) await inputAliyunTag(tag);
        },
      },
    };

    try {
      showProgressPanel({
        title: '轻狐AI 发布助手',
        steps,
        currentStep,
        images: progressImages,
        clipboardData,
        actionButtons,
      });

      showFloatingNotification('正在准备阿里云社区编辑器...', 'info');

      // 1. 等待编辑器加载
      currentStep = 0;
      updateProgressPanel({ steps, currentStep, images: progressImages, clipboardData, actionButtons });
      await waitForAnyElement([
        'textarea.textarea', 'textarea#article-editor', '.mditor',
        'input[placeholder="请填写标题"]',
      ], 15000);

      // 显示所有操作按钮
      currentStep = 1;
      updateProgressPanel({ steps, currentStep, images: progressImages, clipboardData, actionButtons });
      showFloatingNotification('📋 请复制标题和正文后粘贴到编辑器中', 'info');
      await waitForStepsDone(2);
      await waitForActionsDone([3, 4]);

      // 6. 完成
      updateProgressPanel({ steps, currentStep: 5, images: progressImages, clipboardData, actionButtons });
      notifyFillComplete(PLATFORM, true);
    } catch (e) {
      console.error('[轻狐AI] 阿里云填充失败:', e);
      updateProgressPanel({
        steps,
        currentStep: steps.length,
        images: progressImages,
        clipboardData,
        actionButtons,
      });
      notifyFillComplete(PLATFORM, false, e.message);
    }
  }

  /**
   * 上传封面图到阿里云社区
   *
   * Chrome 扩展 content script 运行在 isolated world，无法直接修改页面的
   * HTMLInputElement.prototype。解决方案：注入 <script> 到页面主 world，
   * 在其中进行原型拦截。数据通过 CustomEvent 跨 world 传递。
   */
  async function uploadCoverAliyun(imageUrl) {
    const file = await fetchImageAsFile(imageUrl, 'cover.jpg');

    // 先注入主 world 脚本（仅一次）
    await ensureInjectLoaded();

    // File 转为 base64
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);

    // 通过 CustomEvent 触发上传
    return new Promise((resolve) => {
      const requestId = 'aly_' + Date.now() + '_' + Math.random().toString(36).slice(2);

      const handler = (e) => {
        if (e.detail && e.detail.requestId === requestId) {
          window.removeEventListener('__ALIYUN_RESULT__', handler);
          const url = e.detail.url;
          if (url) {
            console.log('[轻狐AI] 封面上传成功:', url.substring(0, 80));
          } else {
            console.warn('[轻狐AI] 封面上传失败:', e.detail.error || '无返回 URL');
          }
          resolve(url);
        }
      };
      window.addEventListener('__ALIYUN_RESULT__', handler);

      window.dispatchEvent(new CustomEvent('__ALIYUN_UPLOAD__', {
        detail: { requestId, base64, fileName: file.name, fileType: file.type },
      }));

      setTimeout(() => {
        window.removeEventListener('__ALIYUN_RESULT__', handler);
        resolve(null);
      }, 60000);
    });
  }

  let injectPromise = null;

  async function ensureInjectLoaded() {
    if (injectPromise) return injectPromise;

    injectPromise = new Promise((resolve) => {
      // 检查是否已注入（DOM 属性跨 world 共享）
      if (document.documentElement.hasAttribute('data-aly-inject')) return resolve(true);

      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('content-scripts/inject-aliyun.js');
      script.onload = () => {
        script.remove();
        setTimeout(() => resolve(true), 50);
      };
      script.onerror = () => {
        console.warn('[轻狐AI] 注入脚本加载失败');
        resolve(false);
      };
      document.documentElement.appendChild(script);
    });

    return injectPromise;
  }

  /**
   * 输入阿里云标签
   */
  async function inputAliyunTag(tag) {
    const tagInput = await waitForAnyElement([
      'input[placeholder*="标签"]', 'input[placeholder*="tag"]', '[class*="tag"] input',
    ], 3000).catch(() => null);
    if (!tagInput) return;
    setNativeValue(tagInput, tag);
    tagInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await delay(500);
  }
})();
