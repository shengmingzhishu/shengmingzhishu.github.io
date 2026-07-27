/**
 * 轻狐AI Chrome 插件 — Background Service Worker
 * 职责：消息路由、标签页管理、图片下载代理、发布状态回传、自动更新
 */

// 导入配置（service worker 使用 importScripts）
importScripts('../config.js', '../lib/url-utils.js');

/* ========== 消息监听 ========== */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // 来自 contentai-injector 的发布请求
  if (message.action === 'PUBLISH_ARTICLE') {
    handlePublishArticle(message.article, message.platform, sender.tab?.id);
    sendResponse({ ok: true, msg: '正在打开发布页面...' });
    return;
  }

  // 来自 contentai-injector 的自动 Token 同步
  if (message.action === 'SAVE_TOKEN') {
    chrome.storage.local.set({ token: message.token, tokenUpdatedAt: Date.now() }, () => {
      console.log('[轻狐AI] 登录 Token 已自动保存');
    });
    sendResponse({ ok: true });
    return;
  }

  // 来自平台 content script 的填充完成通知
  if (message.action === 'FILL_COMPLETE') {
    notifyContentaiPage(message);
    sendResponse({ ok: true });
    return;
  }

  // 来自平台 content script 的发布完成通知
  if (message.action === 'PUBLISH_COMPLETE') {
    reportPublishComplete(message);
    notifyContentaiPage(message);
    sendResponse({ ok: true });
    return;
  }

  // 来自 content script 的图片下载请求
  if (message.action === 'FETCH_IMAGE') {
    fetchImage(message.url)
      .then((result) => sendResponse(result))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // 保持消息通道开放（异步响应）
  }

  // 来自 popup 的获取状态请求
  if (message.action === 'GET_STATUS') {
    getStatus().then(sendResponse);
    return true;
  }

  // 来自 popup 的获取发布历史
  if (message.action === 'GET_HISTORY') {
    chrome.storage.local.get('publishHistory', (data) => {
      sendResponse(data.publishHistory || []);
    });
    return true;
  }
});

/* ========== 发布流程管理 ========== */

/**
 * 处理发布请求：打开平台页面 → 等待加载 → 发送填充指令
 */
async function handlePublishArticle(article, platform, sourceTabId) {
  const config = PLATFORM_CONFIG[platform];
  if (!config) {
    console.error('不支持的平台:', platform);
    return;
  }

  try {
    // 记录发布历史
    await addToHistory({
      articleId: article.id,
      title: article.title,
      platform,
      platformName: config.name,
      status: 'started',
      timestamp: Date.now(),
    });

    // 小红书 / 抖音：存储 pending article（处理未登录 → 登录后自动恢复）
    if (platform === 'xiaohongshu' || platform === 'douyin') {
      await chrome.storage.local.set({
        [`pending_${platform}`]: { article, platform, timestamp: Date.now() },
      });
      console.log(`[轻狐AI] 已存储${platform}待发布文章（pending）`);
    }

    // 打开平台发布页
    const tab = await chrome.tabs.create({
      url: config.publishUrl,
      active: true,
    });

    // 等待页面加载完成
    await waitForTabComplete(tab.id);

    // SPA 页面需要额外等待 DOM 渲染
    await delay(3000);

    // 向平台 content script 发送填充指令
    chrome.tabs.sendMessage(tab.id, {
      action: 'FILL_CONTENT',
      article,
      platform,
    }).catch((e) => {
      console.error(`[轻狐AI] 发送填充指令失败（${config.name}）:`, e);
      if (platform === 'xiaohongshu' || platform === 'douyin') {
        // 可能重定向到登录页，content script 会通过 pending article 自动恢复
        console.log(`[轻狐AI] ${config.name} 可能需要登录，等待用户登录后自动继续`);
      } else {
        notifyContentaiPage({
          action: 'FILL_COMPLETE',
          platform,
          success: false,
          error: `无法与 ${config.name} 页面通信，请确保已安装最新插件版本`,
        });
      }
    });

    console.log(`[轻狐AI] 已向 ${config.name} 发送填充指令`);
  } catch (e) {
    console.error('[轻狐AI] 发布流程出错:', e);
    notifyContentaiPage({
      action: 'FILL_COMPLETE',
      platform,
      success: false,
      error: e.message,
    });
  }
}

/**
 * 等待标签页加载完成
 */
function waitForTabComplete(tabId) {
  return new Promise((resolve) => {
    const listener = (id, info) => {
      if (id === tabId && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);

    // 超时保底（30秒）
    setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }, 30000);
  });
}

/* ========== 图片下载代理 ========== */

/**
 * 下载图片并返回 base64 数据（避免 content script 的跨域问题）
 * Service Worker 在 host_permissions 域名内可绕过 CORS
 */
async function fetchImage(url) {
  try {
    // 1. 规范化 URL（// → https://，/path → 绝对URL）
    const normalizedUrl = normalizeImageUrl(url);

    // 2. data: URL 直接提取 base64
    if (normalizedUrl.startsWith('data:')) {
      const match = normalizedUrl.match(/^data:(image\/[\w+]+);base64,(.+)$/);
      if (match) {
        return { success: true, data: match[2], contentType: match[1] };
      }
      // 不带 base64 的 data URL
      return { success: false, error: '不支持的非 base64 data URL' };
    }

    console.log('[轻狐AI] 开始下载图片:', normalizedUrl);

    // 3. fetch 图片（host_permissions 内的域名可绕过 CORS）
    const response = await fetch(normalizedUrl, {
      mode: 'cors',
      credentials: 'omit',  // 图片下载不需要 cookie，避免 CORS 凭证问题
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    const blob = await response.blob();
    const contentType = blob.type || 'image/jpeg';

    if (blob.size === 0) {
      throw new Error('图片内容为空（可能被 CORS 拦截）');
    }

    // 4. 转换为 base64（分块处理，避免大图片导致栈溢出）
    const arrayBuffer = await blob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const chunks = [];
    const chunkSize = 0x8000; // 32KB 每块
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      chunks.push(String.fromCharCode.apply(null, uint8Array.subarray(i, i + chunkSize)));
    }
    const base64 = btoa(chunks.join(''));

    console.log('[轻狐AI] 图片下载成功:', normalizedUrl.substring(0, 80), `(${blob.size} bytes)`);

    return {
      success: true,
      data: base64,
      contentType,
    };
  } catch (e) {
    console.error('[轻狐AI] 图片下载失败:', url, '→', normalizeImageUrl(url), e);
    return { success: false, error: e.message };
  }
}

/* ========== 发布状态回传 ========== */

/**
 * 回调轻狐AI API，更新文章发布状态
 */
async function reportPublishComplete({ articleId, platform, url }) {
  const { token } = await chrome.storage.local.get('token');

  try {
    const response = await fetch(`${DEFAULT_API_BASE}/api/extension/publish-complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token || ''}`,
      },
      body: JSON.stringify({
        article_id: articleId,
        platform,
        publish_url: url || '',
      }),
    });

    const data = await response.json();
    console.log('[轻狐AI] 发布状态回传成功:', data);

    // 更新发布历史
    await updateHistoryStatus(articleId, 'success', url);
  } catch (e) {
    console.error('[轻狐AI] 发布状态回传失败:', e);
    await updateHistoryStatus(articleId, 'failed', '');
  }
}

/* ========== 通知轻狐AI 页面 ========== */

/**
 * 向轻狐AI 页面发送消息（填充完成、发布完成等）
 */
function notifyContentaiPage(message) {
  const patterns = CONTENTAI_URL_PATTERNS.map((p) => `${p}/*`);

  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((tab) => {
      if (!tab.url) return;
      const isContentai = patterns.some((p) => {
        // 将 glob 转为简单匹配
        const prefix = p.replace('/*', '');
        return tab.url.startsWith(prefix);
      });
      if (isContentai) {
        chrome.tabs.sendMessage(tab.id, message).catch(() => {
          // content script 可能未注入，忽略错误
        });
      }
    });
  });
}

/* ========== 发布历史管理 ========== */

async function addToHistory(entry) {
  const { publishHistory = [] } = await chrome.storage.local.get('publishHistory');
  publishHistory.unshift(entry);
  // 最多保留 50 条
  if (publishHistory.length > 50) publishHistory.length = 50;
  await chrome.storage.local.set({ publishHistory });
}

async function updateHistoryStatus(articleId, status, url) {
  const { publishHistory = [] } = await chrome.storage.local.get('publishHistory');
  const entry = publishHistory.find((h) => h.articleId === articleId && h.status === 'started');
  if (entry) {
    entry.status = status;
    entry.publishUrl = url;
    entry.completedAt = Date.now();
    await chrome.storage.local.set({ publishHistory });
  }
}

/* ========== 状态查询 ========== */

async function getStatus() {
  const { token, tokenUpdatedAt } = await chrome.storage.local.get(['token', 'tokenUpdatedAt']);

  // 检测是否有轻狐AI 标签页打开
  const patterns = CONTENTAI_URL_PATTERNS.map((p) => `${p}/*`);
  const tabs = await chrome.tabs.query({});
  const hasContentaiTab = tabs.some((tab) =>
    tab.url && patterns.some((p) => tab.url.startsWith(p.replace('/*', '')))
  );

  return {
    connected: hasContentaiTab,
    apiBase: DEFAULT_API_BASE,
    hasToken: !!token,
    tokenUpdatedAt: tokenUpdatedAt || 0,
  };
}

/* ========== 工具函数 ========== */

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// 安装/更新事件
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[轻狐AI] 插件已安装');
    // Token 会在用户打开轻狐AI 页面后自动获取，无需手动配置
    chrome.storage.local.set({
      publishHistory: [],
    });
  }
  if (details.reason === 'update') {
    console.log(`[轻狐AI] 插件已更新: ${details.previousVersion} → ${EXTENSION_VERSION}`);
    // 清除旧的更新通知标记
    chrome.storage.local.remove('updateNotifiedVersion');
  }
  // 无论安装还是更新，都设置定时检查更新
  setupUpdateAlarm();
});

/* ========== 自动更新机制 ========== */

/**
 * 设置更新检查定时器
 */
function setupUpdateAlarm() {
  chrome.alarms.create('checkExtensionUpdate', {
    periodInMinutes: 360, // 每 6 小时检查一次
  });
  console.log('[轻狐AI] 更新检查定时器已设置（每6小时）');
}

// 监听定时器触发
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkExtensionUpdate') {
    checkForUpdates();
  }
});

/**
 * 检查插件更新：向后端查询最新版本，与当前版本比较
 */
async function checkForUpdates() {
  try {
    const response = await fetch(`${DEFAULT_API_BASE}/api/extension/version`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });
    if (!response.ok) {
      console.warn('[轻狐AI] 更新检查请求失败:', response.status);
      return;
    }
    const data = await response.json();
    if (!data.ok || !data.latest_version) {
      console.warn('[轻狐AI] 更新检查返回格式异常');
      return;
    }

    const latestVersion = data.latest_version;
    const currentVersion = EXTENSION_VERSION;

    // 比较版本号
    if (compareVersions(latestVersion, currentVersion) > 0) {
      // 检测到新版本
      const { updateNotifiedVersion } = await chrome.storage.local.get('updateNotifiedVersion');
      if (updateNotifiedVersion === latestVersion) {
        // 已经通知过这个版本，不再重复通知
        return;
      }

      // 保存已通知版本
      await chrome.storage.local.set({ updateNotifiedVersion: latestVersion });

      // 发送通知
      const notice = {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon128.png'),
        title: '轻狐AI 插件更新可用',
        message: `新版本 ${latestVersion} 已发布，当前版本 ${currentVersion}。请前往 ${DEFAULT_API_BASE} 下载更新。`,
        buttons: [{ title: '下载更新' }],
        priority: 2,
        requireInteraction: true,
      };

      chrome.notifications.create('extensionUpdateNotification', notice, (notificationId) => {
        console.log('[轻狐AI] 更新通知已发送:', notificationId);
      });
    }
  } catch (e) {
    console.warn('[轻狐AI] 更新检查异常:', e.message);
  }
}

// 通知按钮点击事件
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (notificationId === 'extensionUpdateNotification' && buttonIndex === 0) {
    chrome.tabs.create({ url: `${DEFAULT_API_BASE}/api/extension/download`, active: true });
  }
});

// 通知点击事件（不点击按钮直接点击通知）
chrome.notifications.onClicked.addListener((notificationId) => {
  if (notificationId === 'extensionUpdateNotification') {
    chrome.tabs.create({ url: `${DEFAULT_API_BASE}/`, active: true });
  }
});

/**
 * 比较两个语义化版本号
 * @param {string} v1
 * @param {string} v2
 * @returns {number} 正数=v1>v2, 负数=v1<v2, 0=相等
 */
function compareVersions(v1, v2) {
  const parts1 = (v1 || '0.0.0').split('.').map(Number);
  const parts2 = (v2 || '0.0.0').split('.').map(Number);
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const a = parts1[i] || 0;
    const b = parts2[i] || 0;
    if (a !== b) return a - b;
  }
  return 0;
}
