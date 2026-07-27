/**
 * 轻狐AI Chrome 插件 — 抖音 Content Script
 * 运行在 creator.douyin.com 域名下
 *
 * 职责：接收 background 的填充指令，自动填充抖音文章发布页
 * 抖音文章发布流程：填标题 → 填正文（富文本）→ 上传封面 → 添加话题
 *
 * 特殊处理：
 * 1. publishUrl 直接指向文章发布页（media_type=article），无需切换 tab
 * 2. 支持「未登录 → 登录后自动恢复」流程：
 *    - Service Worker 在打开页面前存储 pending article
 *    - 如果页面重定向到登录页，content script 检测到不在发布页，
 *      存储 article 并监控 URL 变化
 *    - 用户登录后页面跳回发布页，content script 自动开始填充
 */

(function () {
  'use strict';

  const PLATFORM = 'douyin';
  const PENDING_KEY = 'pending_douyin';
  const PUBLISH_URL_PATTERN = '/content/post/article';
  const PENDING_EXPIRE_MS = 30 * 60 * 1000; // 30 分钟过期

  // 防止重复执行
  let isProcessing = false;
  let fillInProgress = false;

  /* ========== 跳转保护 ========== */

  function enableNavigationProtection() {
    fillInProgress = true;
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);
    console.log('[轻狐AI] 已开启页面跳转保护');
  }

  function disableNavigationProtection() {
    fillInProgress = false;
    window.removeEventListener('beforeunload', handleBeforeUnload);
    window.removeEventListener('popstate', handlePopState);
    console.log('[轻狐AI] 已关闭页面跳转保护');
  }

  function handleBeforeUnload(e) {
    if (fillInProgress) {
      e.preventDefault();
      e.returnValue = '内容正在填充中，确定要离开吗？';
      console.warn('[轻狐AI] 检测到页面跳转尝试，已拦截（填充未完成）');
      return e.returnValue;
    }
  }

  function handlePopState(e) {
    if (fillInProgress) {
      console.warn('[轻狐AI] 检测到历史导航，尝试阻止');
      history.pushState(null, '', location.href);
    }
  }

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
      await delay(3000);
      fillDouyinArticle(pending.article);
    } else {
      // 不在发布页（可能登录页）— 等待用户导航
      showFloatingNotification('⏳ 请先登录抖音，登录后将自动继续发布', 'info');
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
      fillDouyinArticle(article);
    } else {
      // 不在发布页（登录重定向）— 存储 article 并等待
      chrome.storage.local.set({
        [PENDING_KEY]: { article, timestamp: Date.now() },
      });
      showFloatingNotification('⏳ 请先登录抖音，登录后将自动继续发布', 'info');
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
          setTimeout(() => fillDouyinArticle(article), 3000);
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

  /* ========== 填充抖音文章发布页 ========== */

  async function fillDouyinArticle(article) {
    const steps = ['页面加载', '复制标题', '复制正文', '添加话题标签'];
    let currentStep = 0;
    const progressImages = {};

    const titleText = (article.title || '未命名文章').substring(0, 30);
    const htmlContent = article.content_html || markdownToHtml(article.content || '');
    const plainText = stripHtml(htmlContent);
    const clipboardData = {
      1: { text: titleText, html: null, label: '📋 复制标题' },
      2: { text: plainText, html: htmlContent, label: '📋 复制正文' },
    };

    const actionButtons = {
      3: {
        label: '🚀 执行',
        loadingText: '⏳ 执行中...',
        doneText: '✅ 已完成',
        failText: '❌ 失败',
        doneNotification: '✅ 话题已添加',
        failNotification: '❌ 话题添加失败',
        onClick: async () => {
          if (article.tags) {
            await addTags(article.tags);
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

      // 开启跳转保护
      enableNavigationProtection();

      // 1. 等待页面加载完成（编辑器区域出现）
      currentStep = 0;
      updateProgressPanel({ steps, currentStep, clipboardData, actionButtons });
      await waitForAnyElement(
        [
          '[class*="article"]',
          '[class*="editor"]',
          '[contenteditable="true"]',
          '[class*="title"] input',
          '[class*="title"] textarea',
        ],
        15000
      );
      await delay(500);

      // 显示所有操作按钮
      currentStep = 1;
      updateProgressPanel({ steps, currentStep, clipboardData, actionButtons });
      showFloatingNotification('📋 请复制标题和正文后粘贴到编辑器中', 'info');

      // 正文填充完成，显示图片下载按钮（不自动上传）
      if (article.cover_image) {
        progressImages.headCover = { url: article.cover_image, name: '文章头图.jpg' };
        progressImages.cover = { url: article.cover_image, name: '封面图片.jpg' };
        updateProgressPanel({ steps, currentStep, images: progressImages, clipboardData, actionButtons });
        _setPanelImageManualMode(article.cover_image, article.cover_image);
        _showImageDownloadButtons(article.cover_image);
      }

      // 等待用户完成所有操作
      await Promise.all([
        waitForStepsDone([1, 2]),
        waitForActionsDone([3]),
      ]);

      // 完成
      updateProgressPanel({ steps, currentStep: 4, images: progressImages, clipboardData, actionButtons });
      notifyFillComplete(PLATFORM, true);
    } catch (e) {
      console.error('[轻狐AI] 抖音文章填充失败:', e);
      updateProgressPanel({ 
        steps, 
        currentStep: steps.length, 
        images: progressImages,
        clipboardData,
        actionButtons,
      });
      notifyFillComplete(PLATFORM, false, e.message);
    } finally {
      // 关闭跳转保护
      disableNavigationProtection();
      // 重置处理标志，允许后续操作
      isProcessing = false;
    }
  }

  /* ========== 上传封面图 ========== */

  function _findElementByExactText(text, tags) {
    const tagList = tags || ['button', 'a', '[role="button"]', 'div', 'span', 'label', 'p'];
    const elements = document.querySelectorAll(tagList.join(','));
    for (const el of elements) {
      const t = (el.textContent || '').trim();
      if (t === text) {
        if (el.tagName === 'BUTTON' || el.tagName === 'A' || el.getAttribute('role') === 'button' || el.onclick || el.style.cursor === 'pointer') {
          return el;
        }
        const parentBtn = el.closest('button, a, [role="button"], [onclick], label');
        if (parentBtn) return parentBtn;
        return el;
      }
    }
    return null;
  }

  function _findElementByContainText(text, tags) {
    const tagList = tags || ['button', 'a', '[role="button"]', 'div', 'span', 'label', 'p'];
    const elements = document.querySelectorAll(tagList.join(','));
    for (const el of elements) {
      const t = (el.textContent || '').trim();
      if (t && t.length < 30 && t.includes(text)) {
        if (el.tagName === 'BUTTON' || el.tagName === 'A' || el.getAttribute('role') === 'button' || el.onclick || el.style.cursor === 'pointer') {
          return el;
        }
        const parentBtn = el.closest('button, a, [role="button"], [onclick], label');
        if (parentBtn) return parentBtn;
        return el;
      }
    }
    return null;
  }

  function _scrollToBottom() {
    window.scrollTo(0, document.body.scrollHeight);
  }

  function _downloadImage(url, filename) {
    fetchImageViaBackground(url).then(function(resp) {
      if (!resp || !resp.success) {
        showFloatingNotification('❌ 图片下载失败', 'error');
        return;
      }
      var byteChars = atob(resp.data);
      var byteNumbers = new Array(byteChars.length);
      for (var i = 0; i < byteChars.length; i++) {
        byteNumbers[i] = byteChars.charCodeAt(i);
      }
      var byteArray = new Uint8Array(byteNumbers);
      var blob = new Blob([byteArray], { type: resp.contentType || 'image/jpeg' });
      var blobUrl = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function() { URL.revokeObjectURL(blobUrl); }, 1000);
      console.log('[轻狐AI] 图片已下载:', filename);
    }).catch(function(e) {
      console.error('[轻狐AI] 下载失败:', e);
      showFloatingNotification('❌ 图片下载失败', 'error');
    });
  }

  function _makeDownloadBtn(url, filename) {
    var btn = document.createElement('button');
    btn.textContent = '📥 下载';
    btn.style.cssText = `
      display: inline-block;
      padding: 4px 12px;
      margin-left: 8px;
      background: rgba(255,255,255,0.25);
      color: #fff;
      border: 1px solid rgba(255,255,255,0.4);
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      vertical-align: middle;
    `;
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      _downloadImage(url, filename);
    });
    return btn;
  }

  function _setPanelImageManualMode(headCoverUrl, coverUrl) {
    var panel = document.getElementById('qinghu-progress-panel');
    if (!panel) return;
    var imagesDiv = panel.querySelector('#qinghu-progress-images');
    if (!imagesDiv) return;

    imagesDiv.innerHTML = '';

    var header = document.createElement('div');
    header.style.cssText = 'font-size:12px;margin-bottom:8px;font-weight:500;color:#ffe58f;';
    header.textContent = '📷 请下载图片后手动上传到对应位置：';
    imagesDiv.appendChild(header);

    var items = [
      { label: '文章头图', url: headCoverUrl, name: '文章头图.jpg' },
      { label: '封面图片', url: coverUrl, name: '封面图片.jpg' },
    ];

    items.forEach(function(item) {
      if (!item.url) return;
      var row = document.createElement('div');
      row.style.cssText = 'margin:6px 0;display:flex;align-items:center;justify-content:space-between;';
      var label = document.createElement('span');
      label.style.cssText = 'font-size:12px;opacity:0.9;';
      label.textContent = item.label;
      row.appendChild(label);
      row.appendChild(_makeDownloadBtn(item.url, item.name));
      imagesDiv.appendChild(row);
    });
  }

  function _showImageDownloadButtons(imageUrl) {
    var existing = document.getElementById('qinghu-download-floating');
    if (existing) existing.remove();

    var container = document.createElement('div');
    container.id = 'qinghu-download-floating';
    container.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 2147483646;
      background: #fff;
      color: #333;
      padding: 16px 18px;
      border-radius: 12px;
      font-size: 13px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      min-width: 220px;
      user-select: none;
    `;

    var header = document.createElement('div');
    header.style.cssText = 'font-weight:600;margin-bottom:12px;color:#666;font-size:12px;';
    header.textContent = '📷 下载图片（手动上传）';
    container.appendChild(header);

    var items = [
      { label: '📥 下载文章头图', url: imageUrl, name: '文章头图.jpg' },
      { label: '📥 下载封面图片', url: imageUrl, name: '封面图片.jpg' },
    ];

    items.forEach(function(item) {
      var btn = document.createElement('button');
      btn.textContent = item.label;
      btn.style.cssText = `
        display: block;
        width: 100%;
        padding: 10px 12px;
        margin-bottom: 8px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: #fff;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        text-align: center;
        text-decoration: none;
        font-size: 13px;
        font-weight: 500;
        box-sizing: border-box;
      `;
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        _downloadImage(item.url, item.name);
      });
      container.appendChild(btn);
    });

    var hint = document.createElement('div');
    hint.style.cssText = 'font-size:11px;color:#999;text-align:center;margin-top:4px;';
    hint.textContent = '下载后请手动上传到发布页对应位置';
    container.appendChild(hint);

    var closeBtn = document.createElement('div');
    closeBtn.style.cssText = `
      position: absolute; top: 6px; right: 10px;
      cursor: pointer; font-size: 16px; color: #999;
      line-height: 1;
    `;
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', function() {
      container.remove();
    });
    container.appendChild(closeBtn);

    document.body.appendChild(container);
    console.log('[轻狐AI] 图片下载浮动按钮已显示');
  }

  /* ========== 添加话题标签 ========== */

  async function _waitForTopicResult(timeout) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      const items = document.querySelectorAll('[class*="dropdownItem"]');
      if (items.length > 0) {
        return items;
      }
      await delay(100);
    }
    return null;
  }

  async function addTags(tagsRaw) {
    const tags = String(tagsRaw)
      .split(',')
      .map((t) => t.trim().replace(/^#/, ''))
      .filter(Boolean)
      .slice(0, 5); // 抖音文章最多5个话题

    if (tags.length === 0) return;

    showFloatingNotification(`🔄 正在添加 ${tags.length} 个话题...`, 'info');

    // 滚动到底部（话题添加区域在页面底部）
    _scrollToBottom();
    await delay(500);

    let addedCount = 0;

    try {
      // 1. 找到并点击"点击添加话题"区域，打开话题弹窗
      let topicTrigger = _findElementByExactText('点击添加话题');
      if (!topicTrigger) {
        topicTrigger = _findElementByContainText('添加话题');
      }
      if (!topicTrigger) {
        throw new Error('未找到话题添加入口');
      }
      topicTrigger.click();
      await delay(1500);

      // 2. 等待话题弹窗出现
      const modal = document.querySelector('.semi-modal, [class*="modal"]');
      if (!modal) {
        throw new Error('话题弹窗未出现');
      }
      console.log('[轻狐AI] 话题弹窗已打开');

      // 3. 找到搜索输入框
      const searchInput = document.querySelector('input[placeholder*="搜索或输入你想添加的话题"]') ||
                         document.querySelector('input[placeholder*="搜索"]') ||
                         document.querySelector('.semi-modal input');
      if (!searchInput) {
        throw new Error('未找到话题搜索框');
      }

      // 4. 逐个添加话题
      for (const tag of tags) {
        try {
          console.log(`[轻狐AI] 正在添加话题: ${tag}`);

          // 清空输入框
          searchInput.focus();
          setNativeValue(searchInput, '');
          await delay(200);

          // 输入话题关键词（用 native setter 确保 React 感知到）
          setNativeValue(searchInput, tag);
          searchInput.dispatchEvent(new Event('input', { bubbles: true }));
          searchInput.dispatchEvent(new Event('change', { bubbles: true }));

          // 按回车键触发搜索
          searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
          searchInput.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', keyCode: 13, bubbles: true }));
          searchInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', keyCode: 13, bubbles: true }));

          // 等待搜索结果（最多等3秒）
          const resultItems = await _waitForTopicResult(3000);
          if (!resultItems || resultItems.length === 0) {
            console.warn(`[轻狐AI] 未找到话题 "${tag}" 的搜索结果`);
            continue;
          }

          // 点击第一个搜索结果
          const firstItem = resultItems[0];
          const itemText = (firstItem.textContent || '').trim();
          firstItem.click();
          console.log(`[轻狐AI] 已选择话题: ${itemText}`);

          addedCount++;
          await delay(800);
        } catch (e) {
          console.warn(`[轻狐AI] 话题 "${tag}" 添加失败:`, e.message);
        }
      }

      // 5. 点击"确认添加"按钮
      let confirmBtn = null;
      const allBtns = document.querySelectorAll('.semi-modal button, .semi-modal [class*="button"]');
      for (const btn of allBtns) {
        const text = (btn.textContent || '').trim();
        if (text.includes('确认') && text.includes('添加')) {
          confirmBtn = btn;
          break;
        }
        if (text === '确认添加') {
          confirmBtn = btn;
          break;
        }
      }

      if (confirmBtn) {
        // 只有选择了话题才点击确认
        if (addedCount > 0) {
          confirmBtn.click();
          await delay(1000);
          console.log('[轻狐AI] 已点击确认添加按钮');
        }
      } else {
        console.warn('[轻狐AI] 未找到确认添加按钮');
      }

      if (addedCount > 0) {
        showFloatingNotification(`✅ 已添加 ${addedCount} 个话题`, 'success');
      } else {
        showFloatingNotification('⚠️ 话题添加失败，请手动添加', 'warning');
      }
    } catch (e) {
      console.warn('[轻狐AI] 话题添加失败:', e.message);

      // 降级方案：尝试在正文中添加 # 话题
      console.log('[轻狐AI] 尝试降级方案：在正文中添加话题');
      try {
        const editor = document.querySelector('[contenteditable="true"]');
        if (editor) {
          editor.focus();
          const selection = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(editor);
          range.collapse(false);
          selection.removeAllRanges();
          selection.addRange(range);

          for (const tag of tags.slice(0, 3)) {
            document.execCommand('insertText', false, ` #${tag}`);
            addedCount++;
            await delay(400);
          }

          if (addedCount > 0) {
            showFloatingNotification(`✅ 已在正文中添加 ${addedCount} 个话题`, 'success');
            return;
          }
        }
      } catch (e2) {
        console.warn('[轻狐AI] 降级方案也失败:', e2.message);
      }

      showFloatingNotification('⚠️ 话题添加失败，请手动添加', 'warning');
    }
  }
})();
