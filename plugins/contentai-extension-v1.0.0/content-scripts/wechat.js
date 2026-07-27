/**
 * 轻狐AI Chrome 插件 — 微信公众号 Content Script
 * 运行在 mp.weixin.qq.com 域名下
 */
(function () {
  'use strict';

  const PLATFORM = 'wechat';
  let isProcessing = false;

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'FILL_CONTENT' && message.platform === PLATFORM) {
      sendResponse({ ok: true });
      if (isProcessing) return;
      isProcessing = true;
      fillWechatArticle(message.article);
    }
  });

  function waitUntil(condition) {
    return new Promise((resolve) => {
      const check = () => {
        if (condition()) resolve();
        else setTimeout(check, 200);
      };
      check();
    });
  }

  async function fillWechatArticle(article) {
    const steps = ['新建图文', '粘贴标题', '粘贴正文', '上传封面图', '完成'];
    let currentStep = 0;
    const progressImages = {};

    const htmlContent = article.content_html || markdownToHtml(article.content || '');
    const contentText = stripHtml(htmlContent);
    const titleText = (article.title || '未命名文章').substring(0, 100);
    const clipboardData = {
      1: { text: titleText, label: '📋 粘贴标题' },
      2: { text: contentText, html: htmlContent, label: '📋 粘贴正文' },
    };

    const actionButtons = {
      3: {
        label: '🚀 执行',
        loadingText: '⏳ 执行中...',
        doneText: '✅ 已完成',
        failText: '❌ 失败',
        doneNotification: '✅ 封面图已上传',
        failNotification: '❌ 封面图上传失败',
        onClick: async () => {
          if (article.cover_image) {
            progressImages.cover = { url: article.cover_image, name: '封面图片.jpg' };
            updateProgressPanel({ steps, currentStep, images: progressImages, clipboardData, actionButtons, onStepCopy });
            await uploadCoverImageWechat(article.cover_image);
          }
        },
      },
    };

    const onStepCopy = (stepIdx) => {
      currentStep = stepIdx + 1;
      updateProgressPanel({ steps, currentStep, images: progressImages, clipboardData, actionButtons, onStepCopy });
    };

    try {
      showProgressPanel({
        title: '轻狐AI 发布助手',
        steps,
        currentStep,
        images: {},
        clipboardData,
        actionButtons,
        onStepCopy,
      });

      showFloatingNotification('🔄 正在准备公众号编辑器...', 'info');

      // 1. 点击"新建图文"按钮
      currentStep = 0;
      updateProgressPanel({ steps, currentStep, images: progressImages, clipboardData, actionButtons, onStepCopy });
      const newBtn = await waitForAnyElement(
        ['.weui-desktop-card__opr a.js-btn-new', '.js-btn-new', 'a[href*="appmsgt=0&action=edit"]'],
        15000
      );
      newBtn.click();
      showFloatingNotification('🔄 已点击新建图文，等待编辑器加载...', 'info');
      await delay(3000);

      // 显示所有操作按钮（复制 + 执行）
      currentStep = 1;
      updateProgressPanel({ steps, currentStep, images: progressImages, clipboardData, actionButtons, onStepCopy });
      showFloatingNotification('📋 请复制标题和正文后粘贴到编辑器中', 'info');

      // 等待用户完成复制（步骤1: 粘贴标题, 步骤2: 粘贴正文）
      await waitForStepsDone(2);

      // 等待执行按钮完成（步骤3: 上传封面图）
      await waitForActionsDone([3]);

      // 5. 完成
      currentStep = 4;
      updateProgressPanel({ steps, currentStep, images: progressImages, clipboardData, actionButtons, onStepCopy });
      notifyFillComplete(PLATFORM, true);
    } catch (e) {
      console.error('[轻狐AI] 公众号填充失败:', e);
      updateProgressPanel({
        steps,
        currentStep: steps.length,
        images: progressImages,
        clipboardData,
        actionButtons,
        onStepCopy,
      });
      notifyFillComplete(PLATFORM, false, e.message);
    }
  }

  async function uploadCoverImageWechat(imageUrl) {
    const file = await fetchImageAsFile(imageUrl, 'cover.jpg');

    const coverArea = await waitForAnyElement(
      ['.js-cover-area', '.appmsg-cover', '[class*="cover"] input[type="file"]'],
      8000
    );

    if (coverArea.tagName === 'INPUT' && coverArea.type === 'file') {
      setFileInput(coverArea, file);
      return;
    }

    const fileInput = document.querySelector('[class*="cover"] input[type="file"], input[type="file"][accept*="image"]');
    if (fileInput) {
      setFileInput(fileInput, file);
    } else {
      coverArea.click();
      await delay(500);
      throw new Error('请手动选择封面图文件');
    }
  }

})();
