/**
 * 轻狐AI Chrome 插件 — Popup 逻辑
 * API 地址硬编码，Token 自动从轻狐AI 登录会话获取
 */

(function () {
  'use strict';

  const PLATFORM_URLS = {
    wechat: 'https://mp.weixin.qq.com/cgi-bin/appmsg?begin=0&count=10&type=10&action=list',
    xiaohongshu: 'https://creator.xiaohongshu.com/publish/publish',
    douyin: 'https://creator.douyin.com/creator-micro/content/post/article?enter_from=publish_page&media_type=article&type=new',
    bilibili: 'https://member.bilibili.com/york/read-editor',
    toutiao: 'https://mp.toutiao.com/profile_v4/graphic/publish',
    zhihu: 'https://zhuanlan.zhihu.com/write',
    aliyun: 'https://developer.aliyun.com/article/new',
    csdn: 'https://editor.csdn.net/md',
    baijiahao: 'https://baijiahao.baidu.com/builder/rc/edit?type=news&is_from_cms=1',
  };

  const PLATFORM_NAMES = {
    wechat: '微信公众号',
    xiaohongshu: '小红书',
    douyin: '抖音',
    bilibili: 'B站专栏',
    toutiao: '今日头条',
    zhihu: '知乎',
    aliyun: '阿里云社区',
    csdn: 'CSDN',
    baijiahao: '百家号',
  };

  /* ========== 初始化 ========== */
  document.addEventListener('DOMContentLoaded', async () => {
    // 显示当前版本号
    const manifest = chrome.runtime.getManifest();
    const verEls = document.querySelectorAll('.footer-version');
    verEls.forEach(el => { el.textContent = 'v' + (manifest.version || '1.0.0'); });

    await checkStatus();
    await loadHistory();
    await checkUpdate();
    bindEvents();
    // 定时刷新状态（token 可能在后台更新）
    setInterval(checkStatus, 3000);
  });

  /* ========== 检查连接状态 & Token ========== */
  async function checkStatus() {
    const dot = document.getElementById('statusDot');
    const text = document.getElementById('statusText');
    const detail = document.getElementById('statusDetail');
    const tokenDot = document.getElementById('tokenDot');
    const tokenStatusText = document.getElementById('tokenStatusText');
    const authHint = document.getElementById('authHint');

    try {
      chrome.runtime.sendMessage({ action: 'GET_STATUS' }, (response) => {
        if (chrome.runtime.lastError || !response) {
          dot.className = 'status-dot disconnected';
          text.textContent = '插件未正常工作';
          detail.textContent = '';
          tokenDot.className = 'token-dot offline';
          tokenStatusText.textContent = '未知';
          return;
        }

        // 连接状态
        if (response.connected) {
          dot.className = 'status-dot connected';
          text.textContent = '✅ 已连接轻狐AI';
          detail.textContent = '检测到轻狐AI 页面已打开';
        } else {
          dot.className = 'status-dot disconnected';
          text.textContent = '⚠️ 未检测到轻狐AI 页面';
          detail.textContent = '请先打开轻狐AI 并登录';
        }

        // Token 状态
        if (response.hasToken) {
          tokenDot.className = 'token-dot online';
          const updateTime = response.tokenUpdatedAt
            ? new Date(response.tokenUpdatedAt).toLocaleTimeString('zh-CN')
            : '';
          tokenStatusText.textContent = `已登录${updateTime ? ' · ' + updateTime : ''}`;
          authHint.textContent = '登录凭证已自动获取，可直接使用插件发布';
          authHint.className = 'auth-hint auth-hint-ok';
        } else {
          tokenDot.className = 'token-dot offline';
          tokenStatusText.textContent = '未登录';
          authHint.textContent = '打开轻狐AI 并登录后，插件将自动获取登录凭证';
          authHint.className = 'auth-hint';
        }
      });
    } catch (e) {
      dot.className = 'status-dot disconnected';
      text.textContent = '状态检查失败';
    }
  }

  /* ========== 加载发布历史 ========== */
  async function loadHistory() {
    const list = document.getElementById('historyList');

    chrome.runtime.sendMessage({ action: 'GET_HISTORY' }, (history) => {
      if (chrome.runtime.lastError || !history || history.length === 0) {
        list.innerHTML = '<div class="history-empty">暂无发布记录</div>';
        return;
      }

      list.innerHTML = history.slice(0, 10).map((h) => {
        const statusClass = h.status === 'success' ? 'success' : h.status === 'started' ? 'started' : 'failed';
        const timeStr = formatTime(h.timestamp);
        const platformName = h.platformName || PLATFORM_NAMES[h.platform] || h.platform;
        return `
          <div class="history-item">
            <span class="history-status ${statusClass}"></span>
            <span class="history-title" title="${escapeHtml(h.title || '')}">${escapeHtml(h.title || '未命名')}</span>
            <span class="history-platform">${platformName}</span>
            <span class="history-time">${timeStr}</span>
          </div>
        `;
      }).join('');
    });
  }

  /* ========== 绑定事件 ========== */
  function bindEvents() {
    // 快捷发布按钮
    document.querySelectorAll('.platform-item').forEach((item) => {
      item.addEventListener('click', () => {
        const platform = item.dataset.platform;
        const url = PLATFORM_URLS[platform];
        if (url) {
          chrome.tabs.create({ url, active: true });
        }
      });
    });
  }

  /* ========== 自动更新状态检查 ========== */
  async function checkUpdate() {
    const section = document.getElementById('updateSection');
    const dot = document.getElementById('updateDot');
    const text = document.getElementById('updateText');
    const link = document.getElementById('updateLink');
    if (!section) return;

    // 从 background 获取版本信息
    chrome.runtime.sendMessage({ action: 'GET_STATUS' }, async (response) => {
      if (chrome.runtime.lastError || !response) {
        section.style.display = 'none';
        return;
      }

      try {
        const resp = await fetch(`${response.apiBase || 'https://contentai.hnzant.com'}/api/extension/version`);
        const data = await resp.json();
        if (!data.ok || !data.latest_version) {
          section.style.display = 'none';
          return;
        }

        const currentVer = chrome.runtime.getManifest().version || '1.0.0';
        const latestVer = data.latest_version;

        if (compareVersions(latestVer, currentVer) > 0) {
          section.style.display = 'block';
          dot.style.background = '#f59e0b';
          text.textContent = `新版本 ${latestVer} 可用`;
          link.style.display = 'inline';
          link.href = data.download_url || `${response.apiBase}/api/extension/download`;
          link.textContent = '更新';
        } else {
          section.style.display = 'block';
          dot.style.background = '#10b981';
          text.textContent = `已是最新版本 ${currentVer}`;
        }
      } catch (e) {
        section.style.display = 'none';
      }
    });
  }

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

  /* ========== 工具函数 ========== */
  function formatTime(timestamp) {
    if (!timestamp) return '';
    const now = Date.now();
    const diff = now - timestamp;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    return new Date(timestamp).toLocaleDateString('zh-CN');
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
})();
