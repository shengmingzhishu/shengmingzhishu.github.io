/**
 * 轻狐AI Chrome 插件 — 今日头条 Content Script
 * 运行在 mp.toutiao.com 域名下
 */
(function () {
  'use strict';

  const PLATFORM = 'toutiao';
  let isProcessing = false;

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'FILL_CONTENT' && message.platform === PLATFORM) {
      sendResponse({ ok: true });
      if (isProcessing) return;
      isProcessing = true;
      fillToutiaoArticle(message.article);
    }
  });

  async function fillToutiaoArticle(article) {
    const steps = ['等待编辑器加载', '复制标题', '复制正文', '完成'];
    let currentStep = 0;
    const progressImages = {};

    const htmlContent = article.content_html || markdownToHtml(article.content || '');
    const plainText = stripHtml(htmlContent);
    const clipboardData = {
      1: { text: article.title || '未命名文章', label: '📋 复制标题' },
      2: { text: plainText, html: htmlContent, label: '📋 复制正文' },
    };

    try {
      showProgressPanel({
        title: '轻狐AI 发布助手',
        steps,
        currentStep,
        images: {},
        clipboardData,
      });

      showFloatingNotification('🔄 正在准备今日头条编辑器...', 'info');

      // 1. 等待编辑器加载
      currentStep = 0;
      updateProgressPanel({ steps, currentStep, clipboardData });
      await waitForAnyElement(
        [
          '[class*="editor"]',
          '[contenteditable="true"]',
          '.ProseMirror',
          'input[placeholder*="标题"]',
          'textarea[placeholder*="标题"]',
        ],
        15000
      );

      // 显示所有操作按钮
      currentStep = 1;
      updateProgressPanel({ steps, currentStep, clipboardData });
      showFloatingNotification('📋 请复制标题和正文后粘贴到编辑器中', 'info');

      // 等待用户完成复制
      await waitForStepsDone(2);

      // 4. 完成
      updateProgressPanel({ steps, currentStep: 3, images: progressImages, clipboardData });
      notifyFillComplete(PLATFORM, true);
    } catch (e) {
      console.error('[轻狐AI] 今日头条填充失败:', e);
      updateProgressPanel({
        steps,
        currentStep: steps.length,
        images: progressImages,
        clipboardData,
      });
      notifyFillComplete(PLATFORM, false, e.message);
    }
  }
})();
