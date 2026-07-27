/**
 * 轻狐AI Chrome 插件 — 小红书 Content Script
 * 运行在 creator.xiaohongshu.com 域名下
 *
 * 职责：接收 background 的填充指令，自动填充小红书发布页
 * 小红书发布流程：上传图片 → 填标题 → 填正文 → 添加标签
 *
 * 特殊处理：
 * 1. publishUrl 已包含 ?target=image，无需点击 tab 切换
 * 2. 支持「未登录 → 登录后自动恢复」流程：
 *    - Service Worker 在打开页面前存储 pending article
 *    - 如果页面重定向到登录页，content script 检测到不在发布页，
 *      存储 article 并监控 URL 变化
 *    - 用户登录后页面跳回发布页，content script 自动开始填充
 */

(function () {
  'use strict';

  const PLATFORM = 'xiaohongshu';
  const PENDING_KEY = 'pending_xiaohongshu';
  const PUBLISH_URL_PATTERN = '/publish/publish';
  const PENDING_EXPIRE_MS = 30 * 60 * 1000; // 30 分钟过期

  // 防止重复执行
  let isProcessing = false;

  /* ========== 消息监听 ========== */

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'FILL_CONTENT' && message.platform === PLATFORM) {
      sendResponse({ ok: true });
      if (isProcessing) {
        console.log('[轻狐AI] 已在处理中，忽略重复的 FILL_CONTENT');
        return;
      }
      handleFillRequest(message.article);
    }
  });

  /* ========== 页面加载时检查 pending article ========== */
  // 处理场景：用户未登录 → 页面重定向到登录页 → 用户登录后跳回发布页
  // 新的 content script 实例加载时检查 pending article

  initPendingCheck();

  async function initPendingCheck() {
    const data = await chrome.storage.local.get(PENDING_KEY);
    const pending = data[PENDING_KEY];
    if (!pending || isProcessing) return;

    // 检查是否过期
    if (Date.now() - pending.timestamp > PENDING_EXPIRE_MS) {
      chrome.storage.local.remove(PENDING_KEY);
      console.log('[轻狐AI] pending article 已过期，已清除');
      return;
    }

    if (isOnPublishPage()) {
      // 在发布页 — 直接开始填充
      isProcessing = true;
      chrome.storage.local.remove(PENDING_KEY);
      showFloatingNotification('🔄 检测到发布页，开始自动填充...', 'info');
      console.log('[轻狐AI] 从 pending article 恢复，开始填充');
      // 等待页面渲染
      await delay(2000);
      fillXiaohongshuArticle(pending.article);
    } else {
      // 不在发布页（可能登录页）— 等待用户导航
      showFloatingNotification('⏳ 请先登录小红书，登录后将自动继续发布', 'info');
      console.log('[轻狐AI] 当前不在发布页，等待用户登录后导航到发布页');
      monitorUrlChange(pending.article);
    }
  }

  /* ========== 填充请求处理 ========== */

  function handleFillRequest(article) {
    if (isOnPublishPage()) {
      // 在发布页 — 正常填充
      isProcessing = true;
      chrome.storage.local.remove(PENDING_KEY);
      fillXiaohongshuArticle(article);
    } else {
      // 不在发布页（登录重定向）— 存储 article 并等待
      chrome.storage.local.set({
        [PENDING_KEY]: { article, timestamp: Date.now() },
      });
      showFloatingNotification('⏳ 请先登录小红书，登录后将自动继续发布', 'info');
      console.log('[轻狐AI] 当前不在发布页，已存储 article，等待 URL 变化');
      monitorUrlChange(article);
    }
  }

  function isOnPublishPage() {
    return window.location.href.includes(PUBLISH_URL_PATTERN);
  }

  /* ========== URL 变化监控（处理登录后跳转） ========== */

  function monitorUrlChange(article) {
    let lastUrl = window.location.href;
    console.log('[轻狐AI] 开始监控 URL 变化，等待导航到发布页...');

    const interval = setInterval(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        console.log('[轻狐AI] URL 变化:', lastUrl);

        if (isOnPublishPage() && !isProcessing) {
          clearInterval(interval);
          isProcessing = true;
          chrome.storage.local.remove(PENDING_KEY);
          showFloatingNotification('🔄 检测到发布页，开始自动填充...', 'info');
          // 等待页面渲染
          setTimeout(() => fillXiaohongshuArticle(article), 2000);
        }
      }
    }, 1000);

    // 30 分钟后停止监控
    setTimeout(() => {
      clearInterval(interval);
      if (!isProcessing) {
        chrome.storage.local.remove(PENDING_KEY);
        console.log('[轻狐AI] 等待超时（30分钟），已清除待发布任务');
      }
    }, PENDING_EXPIRE_MS);
  }

  /* ========== 填充小红书发布页 ========== */

  async function fillXiaohongshuArticle(article) {
    const steps = ['等待页面加载', '上传图片', '填充标题', '填充正文', '添加话题标签', '完成'];
    let currentStep = 0;
    const progressImages = {};
    let contentEditor = null;

    const actionButtons = {
      1: {
        label: '🚀 执行',
        loadingText: '⏳ 执行中...',
        doneText: '✅ 已完成',
        failText: '❌ 失败',
        doneNotification: '✅ 图片上传完成',
        failNotification: '❌ 图片上传失败',
        onClick: async () => {
          const images = article.gallery_images || [];
          if (images.length > 0) {
            progressImages.gallery = images.map((url, i) => ({ url, name: `图集图片${i + 1}.jpg` }));
            updateProgressPanel({ steps, currentStep, images: progressImages, actionButtons });
            showFloatingNotification(`🔄 正在上传 ${images.length} 张图片...`, 'info');
            await uploadImagesXHS(images);
            showFloatingNotification('✅ 图片上传完成', 'success');
            await delay(2000);
          } else if (article.cover_image) {
            progressImages.cover = { url: article.cover_image, name: '封面图片.jpg' };
            updateProgressPanel({ steps, currentStep, images: progressImages, actionButtons });
            showFloatingNotification('🔄 正在上传封面图...', 'info');
            await uploadImagesXHS([article.cover_image]);
            await delay(2000);
          } else {
            showFloatingNotification('⚠️ 文章没有图片，小红书至少需要1张图片', 'warning');
          }
        },
      },
      4: {
        label: '🚀 执行',
        loadingText: '⏳ 执行中...',
        doneText: '✅ 已完成',
        failText: '❌ 失败',
        doneNotification: '✅ 标签已添加',
        failNotification: '❌ 标签添加失败',
        onClick: async () => {
          if (!contentEditor) {
            showFloatingNotification('⚠️ 正文编辑器未就绪，请稍后重试', 'warning');
            return;
          }
          if (article.tags) {
            const tags = String(article.tags)
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
              .slice(0, 10);

            showFloatingNotification(`🔄 正在添加 ${tags.length} 个标签...`, 'info');
            for (const tag of tags) {
              await inputXHSTag(contentEditor, tag);
            }
            showFloatingNotification('✅ 标签已添加', 'success');
          }
        },
      },
    };

    try {
      showProgressPanel({
        title: '轻狐AI 发布助手',
        steps,
        currentStep,
        images: {},
        actionButtons,
      });

      showFloatingNotification('🔄 正在准备小红书发布页...', 'info');

      // 1. 等待页面加载完成（图片上传区域出现）
      currentStep = 0;
      updateProgressPanel({ steps, currentStep, actionButtons });
      await waitForAnyElement(
        [
          '.publish-container',
          '.creator-container',
          '[class*="publish"]',
          '[class*="upload"]',
          'input[type="file"]',
        ],
        15000
      );

      // 显示所有操作按钮
      currentStep = 1;
      updateProgressPanel({ steps, currentStep, actionButtons });
      showFloatingNotification('📋 请点击「执行」按钮上传图片', 'info');

      // 2. 填充标题（自动）
      currentStep = 2;
      updateProgressPanel({ steps, currentStep, actionButtons });
      const titleInput = await waitForAnyElement(
        [
          '[class*="title"] input',
          '[class*="title"] textarea',
          '#title',
          'input[placeholder*="标题"]',
          'input[placeholder*="title"]',
        ],
        10000
      );
      const titleText = (article.title || '未命名笔记').substring(0, 20);
      setNativeValue(titleInput, titleText);
      showFloatingNotification('✅ 标题已填充', 'success');

      // 3. 填充正文（自动）
      currentStep = 3;
      updateProgressPanel({ steps, currentStep, actionButtons });
      contentEditor = await waitForAnyElement(
        [
          '[class*="content"] [contenteditable="true"]',
          '[class*="desc"] [contenteditable="true"]',
          '#content',
          '[contenteditable="true"]',
        ],
        10000
      );

      const contentText = article.content_text || markdownToText(article.content || '');
      const truncatedContent = contentText.substring(0, 1000);
      contentEditor.focus();
      contentEditor.innerText = truncatedContent;
      contentEditor.dispatchEvent(new Event('input', { bubbles: true }));

      showFloatingNotification('✅ 正文已填充', 'success');

      // 等待执行按钮完成（步骤1: 上传图片, 步骤4: 添加话题标签）
      await waitForActionsDone([1, 4]);

      // 6. 完成
      updateProgressPanel({ steps, currentStep: 5, images: progressImages, actionButtons });
      notifyFillComplete(PLATFORM, true);
    } catch (e) {
      console.error('[轻狐AI] 小红书填充失败:', e);
      updateProgressPanel({ 
        steps, 
        currentStep: steps.length, 
        images: progressImages,
        actionButtons,
      });
      notifyFillComplete(PLATFORM, false, e.message);
    }
  }

  /* ========== 图片上传 ========== */

  /**
   * 上传图片到小红书
   */
  async function uploadImagesXHS(imageUrls) {
    // 查找图片上传的 file input
    const fileInput = await waitForAnyElement(
      [
        'input[type="file"][accept*="image"]',
        '[class*="upload"] input[type="file"]',
        'input[type="file"]',
      ],
      10000
    );

    // 批量下载并上传
    const files = [];
    const errors = [];
    for (let i = 0; i < imageUrls.length; i++) {
      try {
        console.log(`[轻狐AI] 下载图片 ${i + 1}/${imageUrls.length}:`, imageUrls[i]);
        const file = await fetchImageAsFile(
          imageUrls[i],
          `xhs_image_${i + 1}.jpg`
        );
        files.push(file);
        console.log(`[轻狐AI] 图片 ${i + 1} 下载成功 (${file.size} bytes)`);
      } catch (e) {
        console.warn(`[轻狐AI] 图片 ${i + 1} 下载失败:`, imageUrls[i], e.message);
        errors.push(`图${i + 1}: ${e.message}`);
      }
    }

    if (files.length > 0) {
      setFileInput(fileInput, files);
      if (errors.length > 0) {
        showFloatingNotification(
          `⚠️ ${files.length}/${imageUrls.length} 张图片上传成功，${errors.length} 张失败`,
          'warning'
        );
      }
    } else {
      const errorDetail = errors.length > 0 ? errors.join('; ') : '未知原因';
      throw new Error(`所有图片下载失败（${errorDetail}）`);
    }
  }

  /* ========== 话题标签输入 ========== */

  /**
   * 输入小红书话题标签
   * 小红书需要通过 # 触发话题选择器
   */
  async function inputXHSTag(editor, tag) {
    // 确保 tag 不以 # 开头（我们会手动添加）
    const cleanTag = tag.replace(/^#/, '').trim();
    if (!cleanTag) return;

    // 在编辑器末尾添加 # + 标签名
    editor.focus();

    // 将光标移到末尾
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);

    // 输入 #
    document.execCommand('insertText', false, `#${cleanTag}`);

    await delay(800);

    // 等待话题建议下拉出现并点击第一个
    try {
      const suggestion = await waitForAnyElement(
        [
          '[class*="topic"] [class*="item"]',
          '[class*="mention"] [class*="item"]',
          '[class*="hashtag"] [class*="item"]',
          '[class*="suggestion"] [class*="item"]',
        ],
        3000
      );
      suggestion.click();
      await delay(500);
    } catch (e) {
      // 如果没有出现建议，直接输入空格确认
      document.execCommand('insertText', false, ' ');
    }

    await delay(300);
  }

})();
