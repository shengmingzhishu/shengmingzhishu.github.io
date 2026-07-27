/**
 * 轻狐AI Chrome 插件 — 百家号 Content Script
 * 运行在 baijiahao.baidu.com 域名下
 *
 * 职责：接收 background 的填充指令，自动填充百家号文章编辑器
 * 百家号发布流程：填标题 → 填正文
 */

(function () {
  'use strict';

  const PLATFORM = 'baijiahao';
  let isProcessing = false;

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'FILL_CONTENT' && message.platform === PLATFORM) {
      sendResponse({ ok: true });
      if (isProcessing) return;
      isProcessing = true;
      fillBaijiahaoArticle(message.article);
    }
  });

  /**
   * 填充百家号文章
   */
  async function fillBaijiahaoArticle(article) {
    const steps = ['等待编辑器加载', '粘贴标题', '粘贴正文', '完成'];
    let currentStep = 0;

    const titleText = (article.title || '未命名文章').substring(0, 40);
    const contentHtml = article.content_html || markdownToHtml(article.content || '');
    const contentText = stripHtml(contentHtml);

    const clipboardData = {
      1: { text: titleText, label: '📋 粘贴标题' },
      2: { text: contentText, html: contentHtml, label: '📋 粘贴正文' },
    };

    try {
      showProgressPanel({
        title: '轻狐AI 发布助手',
        steps,
        currentStep,
        clipboardData,
      });

      showFloatingNotification('🔄 正在准备百家号编辑器...', 'info');

      // 1. 等待编辑器加载
      currentStep = 0;
      updateProgressPanel({ steps, currentStep, clipboardData });
      await waitForAnyElement(
        [
          '.ql-editor',
          '[contenteditable="true"]',
          '[class*="editor"]',
          'input[placeholder*="标题"]',
        ],
        15000
      );

      // 显示所有操作按钮
      currentStep = 1;
      updateProgressPanel({ steps, currentStep, clipboardData });
      showFloatingNotification('📋 请复制标题和正文后粘贴到编辑器中', 'info');
      await waitForStepsDone(2);

      // 4. 完成
      updateProgressPanel({ steps, currentStep: 3, clipboardData });
      notifyFillComplete(PLATFORM, true);
    } catch (e) {
      console.error('[轻狐AI] 百家号填充失败:', e);
      updateProgressPanel({
        steps,
        currentStep: steps.length,
        clipboardData,
      });
      notifyFillComplete(PLATFORM, false, e.message);
    }
  }

})();
