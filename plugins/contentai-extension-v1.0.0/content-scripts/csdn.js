/**
 * 轻狐AI Chrome 插件 — CSDN Content Script
 * 运行在 editor.csdn.net 域名下
 *
 * 职责：接收 background 的填充指令，自动填充 CSDN Markdown 编辑器
 * CSDN 发布流程：填标题 → 填正文（Markdown）
 */

(function () {
  'use strict';

  const PLATFORM = 'csdn';
  let isProcessing = false;

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'FILL_CONTENT' && message.platform === PLATFORM) {
      sendResponse({ ok: true });
      if (isProcessing) return;
      isProcessing = true;
      fillCsdnArticle(message.article);
    }
  });

  /**
   * 填充 CSDN 文章
   */
  async function fillCsdnArticle(article) {
    const steps = ['等待编辑器加载', '粘贴标题', '上传图片到图床', '粘贴正文', '完成'];
    let currentStep = 0;
    const progressImages = {};

    const htmlContent = article.content_html || markdownToHtml(article.content || '');
    const contentText = article.content || '';
    const clipboardData = {
      1: { text: (article.title || '未命名文章').substring(0, 100), label: '📋 复制标题' },
      3: { text: contentText, html: htmlContent, label: '📋 粘贴正文' },
    };

    const actionButtons = {
      2: {
        label: '🚀 执行',
        loadingText: '⏳ 执行中...',
        doneText: '✅ 已完成',
        failText: '❌ 失败',
        onClick: async () => {
          let markdownContent = contentText;
          const imageUrls = extractMarkdownImages(markdownContent);
          const externalImageUrls = imageUrls.filter((u) => !isCsdnImageUrl(u));
          if (externalImageUrls.length > 0) {
            const urlMap = await uploadImagesToCsdn(externalImageUrls);
            markdownContent = replaceImageUrls(markdownContent, urlMap);
          }
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

      showFloatingNotification('🔄 正在准备 CSDN 编辑器...', 'info');

      // 1. 等待编辑器加载
      currentStep = 0;
      updateProgressPanel({ steps, currentStep, images: progressImages, clipboardData, actionButtons });
      await waitForAnyElement(
        [
          '.editor__inner',
          '.CodeMirror',
          '[class*="editor"]',
          '[contenteditable="true"]',
          'input[placeholder*="标题"]',
        ],
        15000
      );

      // 显示所有操作按钮
      currentStep = 1;
      updateProgressPanel({ steps, currentStep, images: progressImages, clipboardData, actionButtons });
      showFloatingNotification('📋 请复制标题和正文后粘贴到编辑器中', 'info');

      // 等待步骤完成
      await waitForStepsDone(1);
      await waitForStepsDone(3);
      await waitForActionsDone([2]);

      // 完成
      updateProgressPanel({ steps, currentStep: 4, images: progressImages, clipboardData, actionButtons });
      notifyFillComplete(PLATFORM, true);
    } catch (e) {
      console.error('[轻狐AI] CSDN 填充失败:', e);
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

  /* ========== 图片上传工具 ========== */

  /**
   * 从 Markdown 文本中提取所有图片 URL
   * @param {string} markdown
   * @returns {string[]}
   */
  function extractMarkdownImages(markdown) {
    const urls = [];
    const regex = /!\[[^\]]*\]\(([^)]+)\)/g;
    let match;
    while ((match = regex.exec(markdown)) !== null) {
      const url = match[1].trim();
      if (url && url.startsWith('http') && !urls.includes(url)) {
        urls.push(url);
      }
    }
    return urls;
  }

  /**
   * 判断是否为 CSDN 图床 URL
   * @param {string} url
   * @returns {boolean}
   */
  function isCsdnImageUrl(url) {
    return /csdnimg\.cn|csdn\.net\/img/i.test(url);
  }

  /**
   * 替换 Markdown 中的图片 URL
   * @param {string} markdown
   * @param {Object<string, string>} urlMap - 旧URL -> 新URL 的映射
   * @returns {string}
   */
  function replaceImageUrls(markdown, urlMap) {
    let result = markdown;
    for (const [oldUrl, newUrl] of Object.entries(urlMap)) {
      if (oldUrl && newUrl) {
        result = result.split(oldUrl).join(newUrl);
      }
    }
    return result;
  }

  /**
   * 批量上传图片到 CSDN 图床
   * 通过模拟粘贴图片的方式，利用 CSDN 编辑器自身的上传机制
   * @param {string[]} urls - 图片 URL 列表
   * @returns {Promise<Object<string, string>>} 旧URL -> CSDN图床URL 的映射
   */
  async function uploadImagesToCsdn(urls) {
    const urlMap = {};
    const editor = document.querySelector('.editor__inner[contenteditable="true"]');

    if (!editor) {
      throw new Error('未找到 CSDN Markdown 编辑器');
    }

    const originalContent = editor.textContent;

    try {
      clearCleditEditor(editor);
      await delay(200);

      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        try {
          console.log(`[轻狐AI] 上传图片 ${i + 1}/${urls.length}:`, url);

          const file = await fetchImageAsFile(url, `image_${i + 1}.jpg`);
          console.log(`[轻狐AI] 图片 ${i + 1} 下载成功 (${file.size} bytes)`);

          const csdnUrl = await pasteImageAndGetUrl(editor, file);
          if (csdnUrl) {
            urlMap[url] = csdnUrl;
            console.log(`[轻狐AI] 图片 ${i + 1} 上传成功:`, csdnUrl);
          } else {
            console.warn(`[轻狐AI] 图片 ${i + 1} 上传失败，未获取到 CSDN URL`);
          }

          clearCleditEditor(editor);
          await delay(300);
        } catch (e) {
          console.warn(`[轻狐AI] 图片 ${i + 1} 上传失败:`, e.message);
        }
      }
    } finally {
    }

    return urlMap;
  }

  /**
   * 清空 cledit 编辑器内容
   * @param {HTMLElement} editor
   */
  function clearCleditEditor(editor) {
    try {
      editor.innerHTML = '<div class="cledit-section"><span class="lf"><br></span></div>';
      editor.dispatchEvent(new Event('input', { bubbles: true }));
      editor.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (e) {
      console.warn('[轻狐AI] 清空编辑器失败:', e);
    }
  }

  /**
   * 粘贴图片到编辑器并获取上传后的 CSDN URL
   * @param {HTMLElement} editor
   * @param {File} file
   * @returns {Promise<string|null>}
   */
  async function pasteImageAndGetUrl(editor, file) {
    return new Promise((resolve, reject) => {
      const timeoutMs = 15000;
      const startTime = Date.now();

      editor.focus();

      const dt = new DataTransfer();
      dt.items.add(file);

      const pasteEvent = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData: dt,
      });

      editor.dispatchEvent(pasteEvent);

      const checkInterval = setInterval(() => {
        if (Date.now() - startTime > timeoutMs) {
          clearInterval(checkInterval);
          reject(new Error('图片上传超时（15s）'));
          return;
        }

        const text = editor.textContent || '';
        const urlMatch = text.match(/https?:\/\/[^)\s]+\.(?:jpe?g|png|gif|webp)(?:\?[^)\s]*)?/i);

        if (urlMatch && isCsdnImageUrl(urlMatch[0])) {
          clearInterval(checkInterval);
          resolve(urlMatch[0]);
        }
      }, 500);
    });
  }
})();
