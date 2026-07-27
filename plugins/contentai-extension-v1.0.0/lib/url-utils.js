/**
 * 轻狐AI Chrome 插件 — URL 规范化工具
 * 在 service-worker 和 content script 中共享
 *
 * 此函数将所有 URL 规范化为绝对 https:// URL
 */
function normalizeImageUrl(url) {
  if (!url || typeof url !== 'string') return '';

  const s = url.trim();
  if (!s) return '';

  // data: URL — 直接返回，无需 fetch
  if (s.startsWith('data:')) return s;

  // 协议相对链接 //example.com/... → https://example.com/...
  if (s.startsWith('//')) return 'https:' + s;

  // 相对路径 /static/... → 绝对 URL
  if (s.startsWith('/')) return DEFAULT_API_BASE + s;

  // http:// → https://（升级协议）
  if (s.startsWith('http://')) {
    // 已知支持 TLS 的域名直接升级
    if (s.indexOf('wwork.hnzant.com') !== -1 || s.indexOf('myqcloud.com') !== -1 || s.indexOf('contentai.hnzant.com') !== -1) {
      return 'https://' + s.substring('http://'.length);
    }
    return s; // 其他域名保持 http（可能不支持 TLS）
  }

  return s;
}
