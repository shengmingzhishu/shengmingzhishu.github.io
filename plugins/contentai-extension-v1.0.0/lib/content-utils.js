/**
 * 显示图片下载进度
 * @param {string} name - 图片名称（如"封面图片"、"文章头图"）
 * @param {'downloading'|'done'|'error'} status - 状态
 */
function showImageDownloadStatus(name, status) {
  const panel = document.getElementById('qinghu-progress-panel');
  if (!panel) return;
  const imagesDiv = panel.querySelector('#qinghu-progress-images');
  if (!imagesDiv) return;

  let statusHtml = '';
  if (status === 'downloading') {
    statusHtml = `<span class="qinghu-spinner" style="margin-right: 4px;"></span> 正在下载${name}...`;
  } else if (status === 'done') {
    statusHtml = `✅ ${name}下载完成`;
  } else if (status === 'error') {
    statusHtml = `❌ ${name}下载失败`;
  }
  imagesDiv.innerHTML = `<div style="font-size: 12px; display: flex; align-items: center; gap: 4px;">📷 ${statusHtml}</div>`;
}

/**
 * 轻狐AI Chrome 插件 — 共享工具函数
 * 各平台 content script 共用的通用方法
 */

/* ========== DOM 等待工具 ========== */

/**
 * 等待元素出现在 DOM 中
 * @param {string} selector - CSS 选择器
 * @param {number} timeout - 超时毫秒数，默认 10 秒
 * @returns {Promise<HTMLElement>}
 */
function waitForElement(selector, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(selector);
    if (existing) return resolve(existing);

    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) {
        observer.disconnect();
        resolve(el);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`等待元素超时: ${selector}`));
    }, timeout);
  });
}

/**
 * 等待多个选择器中任意一个出现
 * @param {string[]} selectors - 多个 CSS 选择器
 * @param {number} timeout - 超时毫秒
 * @returns {Promise<HTMLElement>}
 */
function waitForAnyElement(selectors, timeout = 10000) {
  return new Promise((resolve, reject) => {
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) return resolve(el);
    }

    const observer = new MutationObserver(() => {
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) {
          observer.disconnect();
          resolve(el);
          return;
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`等待元素超时: ${selectors.join(', ')}`));
    }, timeout);
  });
}

/**
 * 延迟
 * @param {number} ms - 毫秒
 */
function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * 等待复制按钮完成
 * @param {number|number[]} steps - 步骤索引或索引数组
 */
function waitForStepsDone(steps) {
  const indices = Array.isArray(steps) ? steps : [steps];
  return new Promise((resolve) => {
    const check = () => {
      for (const i of indices) {
        const stepEl = document.getElementById(`qinghu-step-${i}`);
        if (!stepEl) { setTimeout(check, 1000); return; }
        const btn = stepEl.querySelector('.qinghu-copy-btn');
        if (!btn || (btn.textContent !== '✅ 已粘贴' && btn.textContent !== '✅ 已复制')) {
          setTimeout(check, 1000);
          return;
        }
      }
      resolve();
    };
    check();
  });
}

/**
 * 等待操作按钮完成
 * @param {number[]} stepIndices - 步骤索引数组
 */
function waitForActionsDone(stepIndices) {
  return new Promise((resolve) => {
    const check = () => {
      for (const idx of stepIndices) {
        const stepEl = document.getElementById(`qinghu-step-${idx}`);
        if (!stepEl) { setTimeout(check, 1000); return; }
        const btn = stepEl.querySelector('.qinghu-action-btn');
        if (!btn || btn.textContent !== '✅ 已完成') {
          setTimeout(check, 1000);
          return;
        }
      }
      resolve();
    };
    check();
  });
}

/* ========== React 控件值设置 ========== */

/**
 * 设置原生 input/textarea 的值并触发 React 的 onChange
 * React 重写了 input 的 value setter，需要通过原型链找到原生 setter
 * @param {HTMLElement} element - 目标元素
 * @param {string} value - 要设置的值
 */
function setNativeValue(element, value) {
  const prototype = Object.getPrototypeOf(element);
  const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;

  if (prototypeValueSetter) {
    prototypeValueSetter.call(element, value);
  } else {
    element.value = value;
  }

  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

/* ========== 内容转换工具 ========== */

/**
 * Markdown 转换为 HTML
 * 简易实现，覆盖标题、段落、列表、加粗、斜体、链接、图片、引用、代码块
 * @param {string} markdown - Markdown 文本
 * @returns {string} HTML
 */
function markdownToHtml(markdown) {
  if (!markdown) return '';

  // 如果已经是 HTML，直接返回
  const trimmed = markdown.trim();
  if (trimmed.startsWith('<') && (trimmed.includes('</') || trimmed.includes('/>'))) {
    return markdown;
  }

  let html = markdown;

  // 代码块
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');

  // 标题
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // 引用
  html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');

  // 加粗和斜体
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // 行内代码
  html = html.replace(/`(.+?)`/g, '<code>$1</code>');

  // 图片（带注释的用 figure/figcaption 包裹，让编辑器能识别并显示为图片下方注释）
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, url) => {
    if (alt && alt.trim()) {
      return `<figure><img src="${url}" alt="${alt}" /><figcaption>${alt}</figcaption></figure>`;
    }
    return `<img src="${url}" />`;
  });

  // 链接
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // 无序列表
  html = html.replace(/^[\-\*] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>');
  html = html.replace(/<\/ul>\s*<ul>/g, '');

  // 有序列表
  html = html.replace(/^\d+\. (.+)$/gm, '<li class="ol-item">$1</li>');

  // 分隔线（--- / *** / ___）
  html = html.replace(/^[-*_]{3,}\s*$/gm, '<hr>');

  // 段落（空行分隔）
  html = html
    .split('\n\n')
    .map((block) => {
      const trimmedBlock = block.trim();
      if (!trimmedBlock) return '';
      // 如果已经是块级元素，不加 p 标签
      if (/^<(h[1-6]|ul|ol|li|blockquote|pre|img|div|p|hr|figure)/.test(trimmedBlock)) {
        return trimmedBlock;
      }
      return `<p>${trimmedBlock.replace(/\n/g, '<br>')}</p>`;
    })
    .join('\n');

  return html;
}

/**
 * HTML 转换为纯文本
 * @param {string} html - HTML 文本
 * @returns {string} 纯文本
 */
function stripHtml(html) {
  if (!html) return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

/**
 * Markdown 转换为纯文本
 * @param {string} markdown - Markdown 文本
 * @returns {string} 纯文本
 */
function markdownToText(markdown) {
  if (!markdown) return '';
  // 如果是 HTML，先转纯文本
  if (markdown.trim().startsWith('<')) {
    return stripHtml(markdown);
  }
  let text = markdown;
  // 移除 Markdown 标记
  text = text.replace(/^#{1,6}\s+/gm, '');
  text = text.replace(/\*\*(.+?)\*\*/g, '$1');
  text = text.replace(/\*(.+?)\*/g, '$1');
  text = text.replace(/`(.+?)`/g, '$1');
  text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '$1');
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1');
  text = text.replace(/^[\-\*]\s+/gm, '');
  text = text.replace(/^\d+\.\s+/gm, '');
  return text;
}

/* ========== 图片处理工具 ========== */

/**
 * 通过 background service worker 下载图片（避免跨域）
 * Service Worker 在 host_permissions 域名内可绕过 CORS
 * @param {string} url - 图片 URL
 * @param {number} [retries=1] - 重试次数（SW 可能处于休眠状态，首次请求会唤醒它）
 * @returns {Promise<{success: boolean, data: string, contentType: string}>}
 */
function fetchImageViaBackground(url, retries) {
  if (retries === undefined) retries = 1;

  return new Promise((resolve) => {
    // 超时保护（30秒）
    const timeoutId = setTimeout(() => {
      console.warn('[轻狐AI] 图片下载超时:', url);
      resolve({ success: false, error: '下载超时（30s）' });
    }, 30000);

    chrome.runtime.sendMessage({ action: 'FETCH_IMAGE', url }, (response) => {
      clearTimeout(timeoutId);

      if (chrome.runtime.lastError) {
        const errMsg = chrome.runtime.lastError.message;
        console.warn('[轻狐AI] Service Worker 通信失败:', errMsg);

        // SW 可能处于休眠状态，重试一次
        if (retries > 0) {
          console.log('[轻狐AI] 1.5s 后重试图片下载...');
          setTimeout(() => {
            fetchImageViaBackground(url, retries - 1).then(resolve);
          }, 1500);
          return;
        }

        resolve({ success: false, error: 'Service Worker 通信失败: ' + errMsg });
        return;
      }

      // SW 返回失败 — 如果是网络错误，也重试一次
      if (!response || !response.success) {
        const errDetail = (response && response.error) || '无响应';
        console.warn('[轻狐AI] 图片下载失败:', url, errDetail);

        if (retries > 0 && (errDetail.includes('Failed to fetch') || errDetail.includes('超时') || errDetail.includes('network'))) {
          console.log('[轻狐AI] 1.5s 后重试图片下载...');
          setTimeout(() => {
            fetchImageViaBackground(url, retries - 1).then(resolve);
          }, 1500);
          return;
        }

        resolve(response || { success: false, error: '无响应' });
        return;
      }

      resolve(response);
    });
  });
}

/**
 * 下载图片并转换为 File 对象
 * @param {string} url - 图片 URL
 * @param {string} filename - 文件名
 * @returns {Promise<File>}
 */
async function fetchImageAsFile(url, filename) {
  const response = await fetchImageViaBackground(url);
  if (!response.success) {
    throw new Error(`图片下载失败: ${url} - ${response.error}`);
  }

  // 将 base64 数据转换为 Blob
  const byteChars = atob(response.data);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteNumbers[i] = byteChars.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: response.contentType || 'image/jpeg' });

  const name = filename || `image_${Date.now()}.jpg`;
  return new File([blob], name, { type: blob.type });
}

/**
 * 将 File 对象注入到 input[type=file] 并触发上传
 * 支持 React 合成事件系统：先尝试直接调用 React onChange 回调，
 * 再触发原生 change/input 事件作为降级
 * @param {HTMLInputElement} input - file input 元素
 * @param {File|File[]} files - 一个或多个文件
 */
function setFileInput(input, files) {
  const dt = new DataTransfer();
  if (Array.isArray(files)) {
    files.forEach((f) => dt.items.add(f));
  } else {
    dt.items.add(files);
  }
  input.files = dt.files;

  // 1. 尝试直接调用 React onChange 回调（解决 React 合成事件不响应的问题）
  //    React 的 onChange 内部读取 e.target.files，所以必须先设置 input.files
  try {
    const propsKey = Object.keys(input).find((k) => k.startsWith('__reactProps$'));
    if (propsKey && input[propsKey] && typeof input[propsKey].onChange === 'function') {
      const syntheticEvent = {
        type: 'change',
        target: input,
        currentTarget: input,
        nativeEvent: new Event('change', { bubbles: true }),
        preventDefault: () => {},
        stopPropagation: () => {},
        isDefaultPrevented: () => false,
        isPropagationStopped: () => false,
        persist: () => {},
      };
      input[propsKey].onChange(syntheticEvent);
      console.log('[轻狐AI] 已通过 React onChange 回调触发文件上传');
      return;
    }
  } catch (e) {
    console.warn('[轻狐AI] React onChange 调用失败，降级到原生事件:', e.message);
  }

  // 2. 降级：触发原生 change/input 事件
  input.dispatchEvent(new Event('change', { bubbles: true }));
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * 批量下载图片并注入到 file input
 * @param {HTMLInputElement} input - file input 元素
 * @param {string[]} urls - 图片 URL 列表
 * @returns {Promise<number>} 成功上传的图片数量
 */
async function uploadImagesBatch(input, urls) {
  const files = [];
  const errors = [];
  for (let i = 0; i < urls.length; i++) {
    try {
      console.log(`[轻狐AI] 下载图片 ${i + 1}/${urls.length}:`, urls[i]);
      const file = await fetchImageAsFile(urls[i], `image_${i + 1}.jpg`);
      files.push(file);
      console.log(`[轻狐AI] 图片 ${i + 1} 下载成功 (${file.size} bytes)`);
    } catch (e) {
      console.warn(`[轻狐AI] 图片 ${i + 1} 下载失败:`, e.message);
      errors.push(`图${i + 1}: ${e.message}`);
    }
  }
  if (files.length > 0) {
    setFileInput(input, files);
  } else if (errors.length > 0) {
    console.error('[轻狐AI] 所有图片下载失败:', errors.join('; '));
  }
  return files.length;
}

/**
 * 复制文本到剪贴板（支持 HTML 格式）
 * @param {string} text - 纯文本
 * @param {string} [html] - HTML 格式内容（可选）
 */
async function copyToClipboard(text, html) {
  try {
    if (html && navigator.clipboard.write) {
      const blobHtml = new Blob([html], { type: 'text/html' });
      const blobText = new Blob([text], { type: 'text/plain' });
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': blobHtml,
          'text/plain': blobText,
        }),
      ]);
    } else {
      await navigator.clipboard.writeText(text || '');
    }
  } catch (e) {
    const textarea = document.createElement('textarea');
    textarea.value = text || '';
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }
}

/**
 * 创建图片复制按钮（复用逻辑）
 * @param {Object} img - { url, name }
 * @returns {HTMLButtonElement}
 */
function _createImageCopyButton(img) {
  const btn = document.createElement('button');
  btn.textContent = '📋 复制图片';
  btn.style.cssText = `
    padding: 2px 10px;
    font-size: 11px;
    border: 1px solid rgba(255,255,255,0.5);
    border-radius: 4px;
    background: rgba(255,255,255,0.15);
    color: white;
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
  `;
  btn.addEventListener('click', async (e) => {
    e.stopPropagation();
    btn.textContent = '📋 ...';
    btn.disabled = true;
    try {
      const resp = await fetchImageViaBackground(img.url);
      if (resp && resp.success) {
        const byteArray = Uint8Array.from(atob(resp.data), c => c.charCodeAt(0));
        const blob = new Blob([byteArray], { type: resp.contentType || 'image/jpeg' });
        await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      } else {
        await copyToClipboard(img.url, `<img src="${img.url}" alt="${img.name || ''}" />`);
      }
    } catch (e) {
      console.warn('[轻狐AI] 图片复制失败，降级为复制URL:', e.message);
      await copyToClipboard(img.url, `<img src="${img.url}" alt="${img.name || ''}" />`);
    }
    btn.textContent = '✅ 已复制';
    showFloatingNotification('✅ 图片已复制，请在编辑器按 Ctrl+V 粘贴', 'success');
    setTimeout(() => {
      btn.textContent = '📋 复制图片';
      btn.disabled = false;
    }, 3000);
  });
  return btn;
}

/* ========== 进度面板组件 ========== */

let _progressPanelState = {
  options: null,
  isMinimized: false,
};

/**
 * 将当前步骤标记为完成（✅），高亮下一步
 */
function _markStepDone(stepEl, idx) {
  const iconSpan = stepEl.querySelector('span:first-child');
  if (iconSpan) {
    iconSpan.innerHTML = '✅';
    iconSpan.style.opacity = '1';
  }
}

function _highlightNextStep(idx) {
  const nextEl = document.getElementById('qinghu-step-' + (idx + 1));
  if (nextEl) {
    nextEl.style.opacity = '1';
    const iconSpan = nextEl.querySelector('span:first-child');
    if (iconSpan && iconSpan.textContent.trim() === '⏳') {
      iconSpan.style.opacity = '1';
    }
  }
}

/**
 * 显示持续进度面板（带品牌信息、图片下载、加载动画）
 * @param {Object} options - 配置选项
 */
function showProgressPanel(options = {}) {
  const existing = document.getElementById('qinghu-progress-panel');
  if (existing) existing.remove();
  const existingIcon = document.getElementById('qinghu-progress-icon');
  if (existingIcon) existingIcon.remove();

  _progressPanelState.options = options;
  _progressPanelState.isMinimized = false;

  const { title = '轻狐AI 发布助手', steps = [], currentStep = 0, images = {} } = options;

  const panel = document.createElement('div');
  panel.id = 'qinghu-progress-panel';
  panel.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 2147483647;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 16px 20px;
    border-radius: 12px;
    font-size: 14px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    box-shadow: 0 8px 24px rgba(102,126,234,0.4);
    min-width: 280px;
    max-width: 400px;
    animation: qinghu-slide-in 0.3s ease-out;
    user-select: none;
  `;

  const style = document.createElement('style');
  style.textContent = `
    @keyframes qinghu-slide-in {
      from { opacity: 0; transform: translateX(20px); }
      to { opacity: 1; transform: translateX(0); }
    }
    @keyframes qinghu-spin {
    }
    .qinghu-spinner {
      display: inline-block;
      width: 8px;
      height: 8px;
      background: #fff;
      border-radius: 50%;
    }
  `;
  panel.appendChild(style);

  const headerDiv = document.createElement('div');
  headerDiv.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
    padding-bottom: 10px;
    border-bottom: 1px solid rgba(255,255,255,0.2);
  `;
  headerDiv.innerHTML = `
    <div style="font-weight: 600; font-size: 15px;">
      <span style="margin-right: 6px;">🦊</span>${title}
    </div>
    <span id="qinghu-panel-minimize" 
          style="cursor: pointer; font-size: 16px; padding: 2px 6px; border-radius: 4px;"
          title="最小化">
      −
    </span>
  `;
  panel.appendChild(headerDiv);

  if (steps.length > 0) {
    const stepsDiv = document.createElement('div');
    stepsDiv.id = 'qinghu-progress-steps';
    stepsDiv.style.cssText = `margin-bottom: 12px;`;
    
    steps.forEach((step, idx) => {
      const stepEl = document.createElement('div');
      stepEl.id = `qinghu-step-${idx}`;
      const hasClipboard = options.clipboardData && options.clipboardData[idx];
      const hasActionButton = options.actionButtons && options.actionButtons[idx];
      const hasInteraction = hasClipboard || hasActionButton;
      stepEl.style.cssText = `
        display: flex;
        align-items: center;
        padding: 6px 0;
        opacity: ${(idx <= currentStep || hasInteraction) ? 1 : 0.5};
        font-size: 13px;
        transition: opacity 0.3s;
      `;
      let textHtml = `<span style="flex:none">${step}</span>`;
      let iconHtml;
      if (idx < currentStep) {
        iconHtml = '<span style="width:20px;flex-shrink:0;margin-right:8px;text-align:center;">✅</span>';
      } else if (idx === currentStep) {
        iconHtml = '<span style="width:20px;flex-shrink:0;margin-right:8px;text-align:center;"><span class="qinghu-spinner"></span></span>';
      } else {
        iconHtml = '<span style="width:20px;flex-shrink:0;margin-right:8px;text-align:center;opacity:0.5;">⏳</span>';
      }
      stepEl.innerHTML = iconHtml + textHtml;

      if (hasClipboard) {
        const copyBtn = document.createElement('button');
        const clipboardLabel = (options.clipboardData[idx] && options.clipboardData[idx].label) || '📋 粘贴';
        copyBtn.textContent = clipboardLabel;
        copyBtn.style.cssText = `
          margin-left: 8px;
          padding: 2px 10px;
          font-size: 12px;
          border: 1px solid rgba(255,255,255,0.5);
          border-radius: 4px;
          background: rgba(255,255,255,0.15);
          color: white;
          cursor: pointer;
          white-space: nowrap;
          flex-shrink: 0;
        `;
        copyBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          copyBtn.textContent = '📋 ...';
          copyBtn.disabled = true;
          const data = options.clipboardData[idx];
          await copyToClipboard(data.text, data.html);
          if (options.onStepCopy) {
            await options.onStepCopy(idx, data.text, data.html);
          }
          copyBtn.textContent = '✅ 已粘贴';
          showFloatingNotification('✅ 内容已粘贴到编辑器', 'success');
          // 无论是否有 onStepCopy，都高亮下一步
          _markStepDone(stepEl, idx);
          _highlightNextStep(idx);
        });
        stepEl.style.flexWrap = 'wrap';
        stepEl.appendChild(copyBtn);
      }

      if (hasActionButton) {
        const actionBtn = document.createElement('button');
        actionBtn.className = 'qinghu-action-btn';
        const actionConfig = options.actionButtons[idx];
        actionBtn.textContent = actionConfig.label || '操作';
        actionBtn.style.cssText = `
          margin-left: 8px;
          padding: 2px 12px;
          font-size: 12px;
          border: 1px solid rgba(255,255,255,0.5);
          border-radius: 4px;
          background: rgba(255,255,255,0.15);
          color: white;
          cursor: pointer;
          white-space: nowrap;
          flex-shrink: 0;
        `;
        actionBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          actionBtn.textContent = actionConfig.loadingText || '🚀 操作中...';
          actionBtn.disabled = true;
          try {
            await actionConfig.onClick();
            actionBtn.textContent = actionConfig.doneText || '✅ 已完成';
            if (actionConfig.doneNotification) {
              showFloatingNotification(actionConfig.doneNotification, 'success');
            }
          } catch (e) {
            console.warn('[轻狐AI] 操作失败:', e);
            actionBtn.textContent = actionConfig.failText || '❌ 失败';
            actionBtn.disabled = false;
            showFloatingNotification(actionConfig.failNotification || '❌ 操作失败', 'error');
          }
        });
        stepEl.style.flexWrap = 'wrap';
        stepEl.appendChild(actionBtn);
      }

      stepsDiv.appendChild(stepEl);
    });
    panel.appendChild(stepsDiv);
  }

  const imagesDiv = document.createElement('div');
  imagesDiv.id = 'qinghu-progress-images';
  imagesDiv.style.cssText = `
    background: rgba(255,255,255,0.1);
    border-radius: 8px;
    padding: 10px;
    margin-top: 8px;
  `;

  const imageEntries = Object.entries(images);
  if (imageEntries.length > 0 && imageEntries.some(([_, img]) => img && img.url)) {
    const showCopy = options.imageClipboardData;
    imagesDiv.innerHTML = `<div style="font-size: 12px; margin-bottom: 8px; opacity: 0.9; font-weight: 500;">📷 图片${showCopy ? '（点击复制后粘贴到编辑器）' : '（自动上传失败时可手动上传）'}：</div>`;
    
    imageEntries.forEach(([key, img]) => {
      if (img && img.url) {
        const rowDiv = document.createElement('div');
        rowDiv.style.cssText = `margin: 6px 0; display: flex; align-items: center; justify-content: space-between;`;
        
        const nameSpan = document.createElement('span');
        nameSpan.style.cssText = `font-size: 12px; opacity: 0.9; display: flex; align-items: center;`;
        nameSpan.innerHTML = `<span style="margin-right: 4px;">📥</span>${img.name || (key === 'cover' ? '封面图片' : key === 'headImage' ? '文章头图' : key)}`;
        rowDiv.appendChild(nameSpan);

        if (showCopy) {
          rowDiv.appendChild(_createImageCopyButton(img));
        } else {
          const linkA = document.createElement('a');
          linkA.href = img.url;
          linkA.download = img.name || 'image.jpg';
          linkA.target = '_blank';
          linkA.style.cssText = `color: white; text-decoration: underline; font-size: 11px; white-space: nowrap;`;
          linkA.textContent = '📥 下载';
          rowDiv.appendChild(linkA);
        }

        imagesDiv.appendChild(rowDiv);
      }
    });
  }
  panel.appendChild(imagesDiv);

  const footerDiv = document.createElement('div');
  footerDiv.style.cssText = `
    margin-top: 12px;
    padding-top: 10px;
    border-top: 1px solid rgba(255,255,255,0.2);
    text-align: center;
  `;
  footerDiv.innerHTML = `
    <a href="https://contentai.hnzant.com" target="_blank"
       style="color: rgba(255,255,255,0.8); font-size: 11px; text-decoration: none;">
      🌐 contentai.hnzant.com
    </a>
  `;
  panel.appendChild(footerDiv);

  document.body.appendChild(panel);

  const minimizeBtn = panel.querySelector('#qinghu-panel-minimize');
  if (minimizeBtn) {
    minimizeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      minimizeProgressPanel();
    });
  }

  return panel;
}

/**
 * 更新进度面板
 */
function updateProgressPanel(options = {}) {
  if (_progressPanelState.isMinimized) {
    _progressPanelState.options = { ..._progressPanelState.options, ...options };
    updateMinimizedIcon(options);
    return;
  }

  const panel = document.getElementById('qinghu-progress-panel');
  if (!panel) return showProgressPanel(options);

  const { steps, currentStep, images, clipboardData } = options;

  if (steps && currentStep !== undefined) {
    const stepsDiv = panel.querySelector('#qinghu-progress-steps');
    if (stepsDiv) {
      steps.forEach((step, idx) => {
        const stepEl = panel.querySelector(`#qinghu-step-${idx}`);
        if (stepEl) {
          const hasClipboard = clipboardData && clipboardData[idx];
          const hasActionButton = options.actionButtons && options.actionButtons[idx];
          const hasInteraction = hasClipboard || hasActionButton;
          stepEl.style.opacity = (idx <= currentStep || hasInteraction) ? 1 : 0.5;
          
          let iconHtml = '';
          let textHtml = `<span style="flex:none">${step}</span>`;
          if (idx < currentStep) {
            iconHtml = '<span style="width:20px;flex-shrink:0;margin-right:8px;text-align:center;">✅</span>';
          } else if (idx === currentStep) {
            iconHtml = '<span style="width:20px;flex-shrink:0;margin-right:8px;text-align:center;"><span class="qinghu-spinner"></span></span>';
          } else {
            iconHtml = '<span style="width:20px;flex-shrink:0;margin-right:8px;text-align:center;opacity:0.5;">⏳</span>';
          }
          stepEl.innerHTML = iconHtml + textHtml;

          const existingBtn = stepEl.querySelector('.qinghu-copy-btn');
          if (existingBtn) existingBtn.remove();

          if (hasClipboard) {
            const copyBtn = document.createElement('button');
            copyBtn.className = 'qinghu-copy-btn';
            const clipboardLabel = (clipboardData[idx] && clipboardData[idx].label) || '📋 粘贴';
            copyBtn.textContent = clipboardLabel;
            copyBtn.style.cssText = `
              margin-left: 8px;
              padding: 2px 10px;
              font-size: 12px;
              border: 1px solid rgba(255,255,255,0.5);
              border-radius: 4px;
              background: rgba(255,255,255,0.15);
              color: white;
              cursor: pointer;
              white-space: nowrap;
              flex-shrink: 0;
            `;
            copyBtn.addEventListener('click', async (e) => {
              e.stopPropagation();
              copyBtn.textContent = '📋 ...';
              copyBtn.disabled = true;
              const data = clipboardData[idx];
              await copyToClipboard(data.text, data.html);
              if (options.onStepCopy) {
                await options.onStepCopy(idx, data.text, data.html);
              }
              copyBtn.textContent = '✅ 已粘贴';
              showFloatingNotification('✅ 内容已粘贴到编辑器', 'success');
              _markStepDone(stepEl, idx);
              _highlightNextStep(idx);
            });
            stepEl.style.flexWrap = 'wrap';
            stepEl.appendChild(copyBtn);
          }

          if (hasActionButton) {
            const existingActionBtn = stepEl.querySelector('.qinghu-action-btn');
            if (existingActionBtn) existingActionBtn.remove();

            const actionBtn = document.createElement('button');
            actionBtn.className = 'qinghu-action-btn';
            const actionConfig = options.actionButtons[idx];
            actionBtn.textContent = actionConfig.label || '操作';
            actionBtn.style.cssText = `
              margin-left: 8px;
              padding: 2px 12px;
              font-size: 12px;
              border: 1px solid rgba(255,255,255,0.5);
              border-radius: 4px;
              background: rgba(255,255,255,0.15);
              color: white;
              cursor: pointer;
              white-space: nowrap;
              flex-shrink: 0;
            `;
            actionBtn.addEventListener('click', async (e) => {
              e.stopPropagation();
              actionBtn.textContent = actionConfig.loadingText || '🚀 操作中...';
              actionBtn.disabled = true;
              try {
                await actionConfig.onClick();
                actionBtn.textContent = actionConfig.doneText || '✅ 已完成';
                if (actionConfig.doneNotification) {
                  showFloatingNotification(actionConfig.doneNotification, 'success');
                }
              } catch (e) {
                console.warn('[轻狐AI] 操作失败:', e);
                actionBtn.textContent = actionConfig.failText || '❌ 失败';
                actionBtn.disabled = false;
                showFloatingNotification(actionConfig.failNotification || '❌ 操作失败', 'error');
              }
            });
            stepEl.style.flexWrap = 'wrap';
            stepEl.appendChild(actionBtn);
          }
        }
      });
    }
  }

  if (images) {
    const imagesDiv = panel.querySelector('#qinghu-progress-images');
    if (imagesDiv) {
      const imageEntries = Object.entries(images);
      if (imageEntries.some(([_, img]) => img && img.url)) {
        const showCopy = options.imageClipboardData;
        imagesDiv.innerHTML = `<div style="font-size: 12px; margin-bottom: 8px; opacity: 0.9; font-weight: 500;">📷 图片${showCopy ? '（点击复制后粘贴到编辑器）' : '（自动上传失败时可手动上传）'}：</div>`;
        imageEntries.forEach(([key, img]) => {
          if (img && img.url) {
            const rowDiv = document.createElement('div');
            rowDiv.style.cssText = `margin: 6px 0; display: flex; align-items: center; justify-content: space-between;`;

            const nameSpan = document.createElement('span');
            nameSpan.style.cssText = `font-size: 12px; opacity: 0.9; display: flex; align-items: center;`;
            nameSpan.innerHTML = `<span style="margin-right: 4px;">📥</span>${img.name || (key === 'cover' ? '封面图片' : key === 'headImage' ? '文章头图' : key)}`;
            rowDiv.appendChild(nameSpan);

            if (showCopy) {
              rowDiv.appendChild(_createImageCopyButton(img));
            } else {
              const linkA = document.createElement('a');
              linkA.href = img.url;
              linkA.download = img.name || 'image.jpg';
              linkA.target = '_blank';
              linkA.style.cssText = `color: white; text-decoration: underline; font-size: 11px; white-space: nowrap;`;
              linkA.textContent = '📥 下载';
              rowDiv.appendChild(linkA);
            }

            imagesDiv.appendChild(rowDiv);
          }
        });
      }
    }
  }
}

/**
 * 最小化进度面板到圆形图标
 */
function minimizeProgressPanel() {
  const panel = document.getElementById('qinghu-progress-panel');
  if (!panel) return;

  _progressPanelState.isMinimized = true;

  const options = _progressPanelState.options || {};
  const currentStep = options.currentStep || 0;
  const totalSteps = options.steps?.length || 0;
  const isComplete = currentStep >= totalSteps;

  panel.style.opacity = '0';
  panel.style.transform = 'translateX(20px) scale(0.9)';
  setTimeout(() => panel.remove(), 200);

  setTimeout(() => {
    showMinimizedIcon(_progressPanelState.options);
  }, 200);
}

/**
 * 显示最小化的圆形图标
 */
function showMinimizedIcon(options = {}) {
  const existingIcon = document.getElementById('qinghu-progress-icon');
  if (existingIcon) existingIcon.remove();

  const currentStep = options.currentStep || 0;
  const totalSteps = options.steps?.length || 0;
  const isComplete = currentStep >= totalSteps;

  const icon = document.createElement('div');
  icon.id = 'qinghu-progress-icon';
  icon.title = '轻狐AI 发布助手 - 点击展开';
  icon.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 2147483647;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    cursor: pointer;
    box-shadow: 0 4px 16px rgba(102,126,234,0.4);
    transition: transform 0.2s, box-shadow 0.2s;
    user-select: none;
  `;

  const iconInner = document.createElement('div');
  iconInner.style.cssText = `
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  `;

  const foxSpan = document.createElement('span');
  foxSpan.textContent = '🦊';
  foxSpan.style.cssText = `font-size: 28px;`;
  iconInner.appendChild(foxSpan);

  if (!isComplete) {
    const ringSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    ringSvg.setAttribute('viewBox', '0 0 56 56');
    ringSvg.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      animation: qinghu-spin 2s linear infinite;
    `;
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', '28');
    circle.setAttribute('cy', '28');
    circle.setAttribute('r', '24');
    circle.setAttribute('fill', 'none');
    circle.setAttribute('stroke', 'rgba(255,255,255,0.6)');
    circle.setAttribute('stroke-width', '3');
    circle.setAttribute('stroke-dasharray', '60 90');
    circle.setAttribute('stroke-linecap', 'round');
    ringSvg.appendChild(circle);
    iconInner.appendChild(ringSvg);
  } else {
    const checkSpan = document.createElement('span');
    checkSpan.textContent = '✓';
    checkSpan.style.cssText = `
      position: absolute;
      bottom: -2px;
      right: -2px;
      width: 18px;
      height: 18px;
      background: #22c55e;
      border-radius: 50%;
      font-size: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px solid white;
    `;
    iconInner.appendChild(checkSpan);
  }

  icon.appendChild(iconInner);

  icon.addEventListener('mouseenter', () => {
    icon.style.transform = 'scale(1.1)';
    icon.style.boxShadow = '0 6px 20px rgba(102,126,234,0.5)';
  });
  icon.addEventListener('mouseleave', () => {
    icon.style.transform = 'scale(1)';
    icon.style.boxShadow = '0 4px 16px rgba(102,126,234,0.4)';
  });
  icon.addEventListener('click', () => {
    expandProgressPanel();
  });

  document.body.appendChild(icon);
  return icon;
}

/**
 * 更新最小化图标的状态
 */
function updateMinimizedIcon(options = {}) {
  const icon = document.getElementById('qinghu-progress-icon');
  if (!icon) return;
  icon.remove();
  showMinimizedIcon({ ..._progressPanelState.options, ...options });
}

/**
 * 展开最小化的进度面板
 */
function expandProgressPanel() {
  const icon = document.getElementById('qinghu-progress-icon');
  if (icon) {
    icon.style.transform = 'scale(0)';
    icon.style.opacity = '0';
    setTimeout(() => icon.remove(), 150);
  }

  setTimeout(() => {
    _progressPanelState.isMinimized = false;
    if (_progressPanelState.options) {
      showProgressPanel(_progressPanelState.options);
    }
  }, 150);
}

/**
 * 关闭进度面板（完全移除）
 */
function closeProgressPanel() {
  const panel = document.getElementById('qinghu-progress-panel');
  if (panel) {
    panel.style.opacity = '0';
    panel.style.transform = 'translateX(20px)';
    setTimeout(() => panel.remove(), 300);
  }
  const icon = document.getElementById('qinghu-progress-icon');
  if (icon) {
    icon.style.transform = 'scale(0)';
    icon.style.opacity = '0';
    setTimeout(() => icon.remove(), 200);
  }
  _progressPanelState = { options: null, isMinimized: false };
}

/**
 * 在页面右上角显示浮动通知
 * @param {string} message - 消息内容
 * @param {'info'|'success'|'error'|'warning'} type - 通知类型
 */
function showFloatingNotification(message, type = 'info') {
  const colors = {
    info: '#3b82f6',
    success: '#22c55e',
    error: '#ef4444',
    warning: '#f59e0b',
  };

  const existing = document.getElementById('contentai-ext-notification');
  if (existing) existing.remove();

  const notif = document.createElement('div');
  notif.id = 'contentai-ext-notification';
  notif.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 2147483647;
    background: ${colors[type] || colors.info};
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 14px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    max-width: 360px;
    transition: opacity 0.3s, transform 0.3s;
  `;
  notif.textContent = message;
  document.body.appendChild(notif);

  // 淡出
  setTimeout(() => {
    notif.style.opacity = '0';
    notif.style.transform = 'translateX(20px)';
    setTimeout(() => notif.remove(), 300);
  }, 4000);
}

/**
 * 通知 background 填充完成
 * @param {string} platform - 平台标识
 * @param {boolean} success - 是否成功
 * @param {string} [errorMsg] - 错误信息
 */
function notifyFillComplete(platform, success, errorMsg) {
  chrome.runtime.sendMessage({
    action: 'FILL_COMPLETE',
    platform,
    success,
    error: errorMsg || '',
  });

  if (success) {
    showFloatingNotification('✅ 内容已自动填充，请检查后点击发布', 'success');
  } else {
    showFloatingNotification(`❌ 内容填充失败: ${errorMsg || '未知错误'}`, 'error');
  }
}
