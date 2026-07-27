/**
 * 轻狐AI Chrome 插件 — 知乎 Content Script
 * 运行在 zhuanlan.zhihu.com 域名下
 *
 * 职责：接收 background 的填充指令，自动填充知乎专栏编辑器
 * 知乎发布流程：填标题 → 填正文 → 上传封面 → 添加话题
 */

(function () {
  'use strict';

  const PLATFORM = 'zhihu';
  let isProcessing = false;

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'FILL_CONTENT' && message.platform === PLATFORM) {
      sendResponse({ ok: true });
      if (isProcessing) return;
      isProcessing = true;
      fillZhihuArticle(message.article);
    }
  });

  /**
   * 填充知乎专栏文章
   */
  async function fillZhihuArticle(article) {
    const steps = ['等待编辑器加载', '复制标题', '复制正文', '上传封面图', '添加话题'];
    let currentStep = 0;
    const progressImages = {};

    const htmlContent = article.content_html || markdownToHtml(article.content || '');
    const plainText = stripHtml(htmlContent);
    const clipboardData = {
      1: { text: article.title || '未命名文章', label: '📋 复制标题' },
      2: { text: plainText, html: htmlContent, label: '📋 复制正文' },
    };

    const actionButtons = {
      3: {
        label: '🚀 执行',
        loadingText: '⏳ 执行中...',
        doneText: '✅ 已完成',
        failText: '❌ 失败',
        doneNotification: '✅ 封面图已上传',
        failNotification: '⚠️ 封面图上传失败',
        onClick: async () => {
          if (article.cover_image) {
            progressImages.cover = { url: article.cover_image, name: '封面图片.jpg' };
            updateProgressPanel({ steps, currentStep, images: progressImages, clipboardData, actionButtons });
            await uploadCoverZhihu(article.cover_image);
          }
        },
      },
      4: {
        label: '🚀 执行',
        loadingText: '⏳ 执行中...',
        doneText: '✅ 已完成',
        failText: '❌ 失败',
        doneNotification: '✅ 话题已添加',
        failNotification: '❌ 话题添加失败',
        onClick: async () => {
          if (article.tags) {
            const tags = String(article.tags)
              .split(',')
              .map((t) => t.trim().replace(/^#/, ''))
              .filter(Boolean)
              .slice(0, 5);
            for (const tag of tags) {
              await inputZhihuTopic(tag);
            }
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
        clipboardData,
        actionButtons,
      });

      showFloatingNotification('🔄 正在准备知乎编辑器...', 'info');

      // 1. 等待编辑器加载
      currentStep = 0;
      updateProgressPanel({ steps, currentStep, clipboardData, actionButtons });
      await waitForAnyElement(
        [
          '.ProseMirror',
          '.WriteIndex',
          '[contenteditable="true"]',
          'textarea[placeholder*="标题"]',
        ],
        15000
      );

      // 显示所有操作按钮
      currentStep = 1;
      updateProgressPanel({ steps, currentStep, clipboardData, actionButtons });
      showFloatingNotification('📋 请复制标题和正文后粘贴到编辑器中', 'info');

      // 等待用户完成所有操作（复制步骤 + 执行步骤）
      await Promise.all([
        waitForStepsDone(2),
        waitForActionsDone([3, 4]),
      ]);

      // 完成
      updateProgressPanel({ steps, currentStep: steps.length, images: progressImages, clipboardData, actionButtons });
      notifyFillComplete(PLATFORM, true);
    } catch (e) {
      console.error('[轻狐AI] 知乎填充失败:', e);
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
   * 根据文本内容查找可点击元素
   */
  function _findElementByText(texts) {
    const elements = document.querySelectorAll('button, a, [role="button"], div, span, label');
    for (const el of elements) {
      const t = el.textContent.trim();
      if (t && texts.some((txt) => t.includes(txt))) {
        if (el.tagName === 'BUTTON' || el.tagName === 'A' || el.getAttribute('role') === 'button' || el.onclick || el.style.cursor === 'pointer') {
          return el;
        }
        const parentBtn = el.closest('button, a, [role="button"], [onclick]');
        if (parentBtn) return parentBtn;
        return el;
      }
    }
    return null;
  }

  /**
   * 上传封面图到知乎
   *
   * 知乎编辑器 DOM 结构（2024 实测）：
   *   div.css-mfq34p  (文本: "添加封面添加文章封面图片上传格式支持 JPEG、JPG、PNG")
   *     label.css-1yj4uzm  (文本: "添加封面")
   *     div.css-1pysja1
   *       div
   *         label.UploadPicture-wrapper  (文本: "添加文章封面")
   *           input.UploadPicture-input  ← 封面 file input（hidden, accept=".jpeg,.jpg,.png"）
   *
   * 页面还有其他 file input（不能误操作）：
   *   - EditorSnapshotWrapper 内的 input（文件/图片上传，accept 含 pdf/md/txt 等）
   */
  async function uploadCoverZhihu(imageUrl) {
    const file = await fetchImageAsFile(imageUrl, 'cover.jpg');

    // ===== 策略1: 精确匹配知乎封面上传 input（最可靠） =====
    const coverInput = document.querySelector('input.UploadPicture-input');
    if (coverInput) {
      setFileInput(coverInput, file);
      await delay(500);
      console.log('[轻狐AI] 封面图已设置（UploadPicture-input）');
      return;
    }

    // ===== 策略2: 通过 UploadPicture-wrapper 容器查找 =====
    const wrapper = document.querySelector('label.UploadPicture-wrapper');
    if (wrapper) {
      const input = wrapper.querySelector('input[type="file"]');
      if (input) {
        setFileInput(input, file);
        await delay(500);
        console.log('[轻狐AI] 封面图已设置（UploadPicture-wrapper 内）');
        return;
      }
    }

    // ===== 策略3: 查找"添加封面"文本附近的 file input =====
    // 遍历包含"封面"文本的元素，在其祖先链中查找 file input
    const coverTextElements = document.querySelectorAll('label, div, span');
    for (const el of coverTextElements) {
      const t = el.textContent.trim();
      if (t.includes('添加封面') || t.includes('设置封面') || t.includes('更换封面')) {
        // 向上查找最近的可上传容器
        let container = el;
        for (let i = 0; i < 5; i++) {
          container = container.parentElement;
          if (!container) break;
          const input = container.querySelector('input[type="file"]');
          if (input) {
            // 排除 EditorSnapshotWrapper 内的 input（正文图片/文件上传）
            if (!container.querySelector('.EditorSnapshotWrapper') && !container.closest('.EditorSnapshotWrapper')) {
              setFileInput(input, file);
              await delay(500);
              console.log('[轻狐AI] 封面图已设置（封面文本附近）');
              return;
            }
          }
        }
      }
    }

    // ===== 策略4: 点击"添加封面"区域后查找 input =====
    const coverBtn = _findElementByText(['添加封面', '设置封面', '更换封面']);
    if (coverBtn) {
      console.log('[轻狐AI] 点击封面按钮:', coverBtn.textContent.trim());
      coverBtn.click();
      await delay(1000);

      // 点击后再次尝试策略1和2
      const inputAfterClick = document.querySelector('input.UploadPicture-input')
        || document.querySelector('label.UploadPicture-wrapper input[type="file"]');
      if (inputAfterClick) {
        setFileInput(inputAfterClick, file);
        console.log('[轻狐AI] 封面图已设置（点击后找到 UploadPicture input）');
        return;
      }
    }

    throw new Error('未找到封面上传入口');
  }

  /**
   * 确保知乎"发布设置"面板已展开
   * 知乎的话题输入在"发布设置"展开面板中，不在主编辑页面
   * @returns {boolean} 面板是否已展开
   */
  async function ensurePublishSettingsExpanded() {
    // 检查面板是否已展开（找到"文章话题"文本说明面板已展开）
    const existing = document.evaluate(
      '//label[contains(text(),"文章话题")] | //*[contains(text(),"文章话题")]',
      document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null
    ).singleNodeValue;
    if (existing) {
      console.log('[轻狐AI] 发布设置面板已展开');
      return true;
    }

    // 查找并点击"发布设置"按钮
    const settingsBtn = _findElementByText(['发布设置']);
    if (!settingsBtn) {
      console.warn('[轻狐AI] 未找到"发布设置"按钮');
      return false;
    }

    console.log('[轻狐AI] 点击"发布设置"展开面板');
    settingsBtn.click();
    await delay(1500);

    // 验证面板是否展开
    const expanded = document.evaluate(
      '//label[contains(text(),"文章话题")] | //*[contains(text(),"文章话题")]',
      document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null
    ).singleNodeValue;
    return !!expanded;
  }

  /**
   * 输入知乎话题
   *
   * 知乎编辑器话题流程（2024 实测 DOM）：
   * 1. 点击"发布设置"展开面板
   * 2. 在面板中找到"文章话题"区域
   * 3. 点击"添加话题"按钮（button 文本为"添加话题"）
   * 4. 搜索 input 变为可见（aria-label="搜索话题", placeholder="搜索话题..."）
   * 5. 输入话题关键词，从建议列表中选择第一项
   */
  async function inputZhihuTopic(tag) {
    // 1. 确保"发布设置"面板已展开
    const expanded = await ensurePublishSettingsExpanded();
    if (!expanded) {
      console.warn('[轻狐AI] 无法展开发布设置面板，跳过话题填充');
      return;
    }

    // 2. 查找并点击"添加话题"按钮
    //    注意：要精确匹配"添加话题"按钮，不要误匹配"文章话题" label
    const addTopicBtn = document.evaluate(
      '//button[contains(text(),"添加话题")] | //*[text()="添加话题"]',
      document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null
    ).singleNodeValue;

    if (!addTopicBtn) {
      // 降级：用 _findElementByText 查找
      const btn = _findElementByText(['添加话题']);
      if (!btn) {
        console.warn('[轻狐AI] 未找到"添加话题"按钮');
        return;
      }
      console.log('[轻狐AI] 点击"添加话题"按钮');
      btn.click();
    } else {
      console.log('[轻狐AI] 点击"添加话题"按钮');
      addTopicBtn.click();
    }

    await delay(800);

    // 3. 查找话题搜索输入框
    //    知乎使用 aria-label="搜索话题" 和 placeholder="搜索话题..."
    const searchInput = document.querySelector(
      'input[aria-label="搜索话题"], input[placeholder="搜索话题..."], input[placeholder*="搜索话题"]'
    );

    if (!searchInput) {
      console.warn('[轻狐AI] 未找到话题搜索输入框');
      return;
    }

    // 4. 输入话题关键词
    console.log('[轻狐AI] 搜索话题:', tag);
    searchInput.focus();
    setNativeValue(searchInput, tag);
    await delay(1200);

    // 5. 查找并点击建议列表中的第一项
    //    知乎的建议列表是一个浮动下拉菜单，项中包含搜索关键词
    const suggestion = document.evaluate(
      `//*[contains(text(),"${tag}")]`,
      document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null
    ).singleNodeValue;

    if (suggestion) {
      // 找到包含关键词的可点击建议项
      const clickableItem = suggestion.closest('button, [role="option"], [role="listitem"], li, [class*="item"], [class*="Item"]') || suggestion;
      console.log('[轻狐AI] 选择话题建议:', clickableItem.textContent.trim());
      clickableItem.click();
    } else {
      // 没有建议列表时按回车确认
      console.log('[轻狐AI] 无建议列表，按回车确认');
      searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      searchInput.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', bubbles: true }));
      searchInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
    }
    await delay(600);
  }
})();
