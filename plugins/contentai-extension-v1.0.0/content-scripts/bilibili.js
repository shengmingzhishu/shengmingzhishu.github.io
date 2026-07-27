/**
 * 轻狐AI Chrome 插件 — B站专栏 Content Script
 * 运行在 member.bilibili.com 域名下
 */
(function () {
  'use strict';

  const PLATFORM = 'bilibili';
  let isProcessing = false;

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'FILL_CONTENT' && message.platform === PLATFORM) {
      sendResponse({ ok: true });
      if (isProcessing) return;
      isProcessing = true;
      fillBilibiliArticle(message.article);
    }
  });

  function getEditorDoc() {
    return document;
  }

  function extractImagesFromHtml(html) {
    const urls = [];
    const regex = /<img[^>]+src="([^">]+)"/g;
    let match;
    while ((match = regex.exec(html)) !== null) {
      const url = match[1].trim();
      if (url && url.startsWith('http') && !urls.includes(url)) {
        urls.push(url);
      }
    }
    return urls;
  }

  async function fillBilibiliArticle(article) {
    const steps = ['等待编辑器加载', '复制标题', '复制正文', '添加话题', '完成'];
    let currentStep = 0;
    const progressImages = {};

    const htmlContent = article.content_html || markdownToHtml(article.content || '');
    const plainContent = article.content_text || article.content || htmlContent;
    const clipboardData = {
      1: { text: (article.title || '未命名文章').substring(0, 40), label: '📋 复制标题' },
      2: { text: plainContent, html: htmlContent, label: '📋 复制正文' },
    };

    // 提取正文中的图片
    const imageUrls = extractImagesFromHtml(htmlContent);
    const hasImages = imageUrls.length > 0;
    if (hasImages) {
      imageUrls.forEach((url, i) => {
        progressImages[`img_${i}`] = { url, name: `正文图片${i + 1}.jpg` };
      });
    }

    let tagsAdded = false;
    const actionButtons = {
      3: {
        label: '🚀 执行',
        loadingText: '⏳ 添加中...',
        doneText: '✅ 已完成',
        failText: '❌ 失败',
        doneNotification: `✅ 话题已添加`,
        failNotification: '❌ 话题添加失败',
        onClick: async () => {
          if (tagsAdded) return;
          if (article.tags) {
            const tags = String(article.tags).split(',').map(t => t.trim().replace(/^#/, '')).filter(Boolean).slice(0, 10);
            for (const tag of tags) {
              await inputBilibiliTag(tag, getEditorDoc());
            }
            tagsAdded = true;
          }
        },
      },
    };

    const onStepCopy = (stepIdx) => {
      currentStep = stepIdx + 1;
      updateProgressPanel({
        steps, currentStep, images: progressImages,
        clipboardData, actionButtons, imageClipboardData: hasImages,
        onStepCopy,
      });
    };

    try {
      showProgressPanel({
        title: '轻狐AI 发布助手',
        steps,
        currentStep,
        images: progressImages,
        clipboardData,
        actionButtons,
        imageClipboardData: hasImages,
        onStepCopy,
      });

      showFloatingNotification('正在准备B站专栏编辑器...', 'info');

      // 等待编辑器加载
      currentStep = 0;
      updateProgressPanel({
        steps, currentStep, images: progressImages,
        clipboardData, actionButtons, imageClipboardData: hasImages,
        onStepCopy,
      });

      const loginIndicators = ['#login-app', '.login-container', '[class*="login"]', '.passport-body'];
      for (const sel of loginIndicators) {
        if (document.querySelector(sel)) {
          throw new Error(`检测到B站登录页面（${document.location.href}），请先登录B站账号再重试`);
        }
      }

      if (document.location.hostname === 'passport.bilibili.com') {
        throw new Error(`已重定向到B站登录页面，请先登录B站账号再重试`);
      }

      await waitForAnyElement([
        '.title-input', '.ProseMirror', '.tiptap', 'textarea.title-input__inner',
      ], 20000);

      // 显示所有操作按钮 — 按钮由 content-utils 统一控制，始终可见
      currentStep = 1;
      updateProgressPanel({
        steps, currentStep, images: progressImages,
        clipboardData, actionButtons, imageClipboardData: hasImages,
        onStepCopy,
      });

      showFloatingNotification('📋 请复制标题、正文和图片后粘贴到编辑器中', 'info');

      // 等待用户完成所有操作
      await waitForUserComplete();

      currentStep = 4;
      updateProgressPanel({
        steps, currentStep, images: progressImages,
        clipboardData, actionButtons, imageClipboardData: hasImages,
        onStepCopy,
      });
      notifyFillComplete(PLATFORM, true);
    } catch (e) {
      console.error('[轻狐AI] B站填充失败:', e);
      updateProgressPanel({
        steps,
        currentStep: steps.length,
        images: progressImages,
        clipboardData,
        actionButtons,
        imageClipboardData: hasImages,
        onStepCopy,
      });
      notifyFillComplete(PLATFORM, false, e.message);
    }
  }

  function waitForUserComplete() {
    return new Promise((resolve) => {
      const check = () => {
        const step1 = document.getElementById('qinghu-step-1');
        const step2 = document.getElementById('qinghu-step-2');
        const step3 = document.getElementById('qinghu-step-3');
        if (!step1 || !step2 || !step3) { setTimeout(check, 500); return; }

        const copy1 = step1.querySelector('.qinghu-copy-btn');
        const copy2 = step2.querySelector('.qinghu-copy-btn');
        const action3 = step3.querySelector('.qinghu-action-btn');

        const titleDone = copy1 && (copy1.textContent === '✅ 已粘贴' || copy1.textContent === '✅ 已复制');
        const contentDone = copy2 && (copy2.textContent === '✅ 已粘贴' || copy2.textContent === '✅ 已复制');
        const tagsDone = action3 && (action3.textContent === '✅ 已完成' || action3.disabled);

        if (titleDone && contentDone && tagsDone) {
          resolve();
        } else {
          setTimeout(check, 1000);
        }
      };
      check();
    });
  }

  async function inputBilibiliTag(tag, doc) {
    const topicBtn = Array.from(doc.querySelectorAll('button')).find(b => b.textContent.trim() === '添加话题');
    if (!topicBtn) return;

    topicBtn.click();
    await delay(1000);

    const popupInput = doc.querySelector('[class*="modal"] input, [class*="dialog"] input, [class*="popup"] input, [placeholder*="话题"]');
    if (popupInput) {
      setNativeValue(popupInput, tag);
      await delay(300);

      const confirmBtn = Array.from(doc.querySelectorAll('button')).find(b =>
        b.textContent.trim() === '确定' || b.textContent.trim() === '添加' || b.textContent.trim() === '搜索'
      );
      if (confirmBtn) confirmBtn.click();
      await delay(500);
    }
  }
})();
