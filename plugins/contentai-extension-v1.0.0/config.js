/**
 * 轻狐AI Chrome 插件 — 平台配置
 * 各平台的发布页 URL 和 DOM 选择器配置
 */

// eslint-disable-next-line no-unused-vars
const PLATFORM_CONFIG = {
  wechat: {
    name: '微信公众号',
    icon: '📘',
    publishUrl: 'https://mp.weixin.qq.com/cgi-bin/appmsg?begin=0&count=10&type=10&action=list',
    // 公众号编辑器是 SPA，需要等待特定元素
    waitForSelector: '.weui-desktop-card__bd, .main_bd',
    // 新建图文按钮
    newArticleSelector: '.weui-desktop-card__opr a.js-btn-new, .js-btn-new',
    // 标题输入框
    titleSelector: '#title',
    // 正文编辑器（UEditor）
    editorSelector: '#ueditor_0 .edui-body-container, .edui-body-container',
    // 封面上传区域
    coverSelector: '.js-cover-area, .appmsg-cover',
  },

  xiaohongshu: {
    name: '小红书',
    icon: '📕',
    publishUrl: 'https://creator.xiaohongshu.com/publish/publish?from=tab_switch&target=image',
    waitForSelector: '.publish-container, .creator-container, [class*="publish"], [class*="upload"]',
    // 上传图文 tab（第二个 tab）
    uploadTabSelector: '[class*="tab"]:nth-child(2), [class*="upload-type"]:nth-child(2)',
    // 标题输入
    titleSelector: '[class*="title"] input, [class*="title"] textarea, #title, input[placeholder*="标题"]',
    // 正文编辑器
    contentSelector: '[class*="content"] [contenteditable="true"], [class*="desc"] [contenteditable="true"], #content',
    // 图片上传
    imageUploadSelector: 'input[type="file"][accept*="image"]',
  },

  douyin: {
    name: '抖音',
    icon: '🎵',
    // 文章发布页（非图文上传模式）
    publishUrl: 'https://creator.douyin.com/creator-micro/content/post/article?enter_from=publish_page&media_type=article&type=new',
    waitForSelector: '[class*="article"], [class*="editor"], [contenteditable="true"], [class*="title"] input',
    // 标题
    titleSelector: 'input[placeholder*="标题"], [class*="title"] input, [class*="title"] textarea, #title',
    // 正文（抖音文章使用富文本编辑器）
    contentSelector: '[class*="editor"] [contenteditable="true"], [class*="article"] [contenteditable="true"], [contenteditable="true"]',
    // 封面上传
    coverSelector: 'input[type="file"][accept*="image"]',
    // 话题/标签
    tagSelector: 'input[placeholder*="话题"], input[placeholder*="标签"], [class*="tag"] input, [class*="topic"] input',
  },

  bilibili: {
    name: 'B站专栏',
    icon: '📺',
    publishUrl: 'https://member.bilibili.com/york/read-editor',
    waitForSelector: '.text-editor, [class*="editor"], [class*="article-edit"]',
    // 标题
    titleSelector: 'input[placeholder*="标题"], [class*="title"] input, #title',
    // 正文（富文本编辑器）
    contentSelector: '.ql-editor, [contenteditable="true"], [class*="editor"] [contenteditable]',
    // 封面上传
    coverSelector: 'input[type="file"][accept*="image"]',
    // 标签输入
    tagSelector: 'input[placeholder*="标签"], [class*="tag"] input',
  },

  toutiao: {
    name: '今日头条',
    icon: '📰',
    publishUrl: 'https://mp.toutiao.com/profile_v4/graphic/publish',
    waitForSelector: '[class*="editor"], [contenteditable="true"], .ProseMirror',
    // 标题输入框
    titleSelector: 'input[placeholder*="标题"], textarea[placeholder*="标题"], [class*="title"] input, #title',
    // 正文编辑器（头条使用 ProseMirror）
    contentSelector: '.ProseMirror, [contenteditable="true"], [class*="editor"] [contenteditable]',
    // 封面上传
    coverSelector: 'input[type="file"][accept*="image"]',
  },

  zhihu: {
    name: '知乎',
    icon: '💡',
    publishUrl: 'https://zhuanlan.zhihu.com/write',
    waitForSelector: '.ProseMirror, .public-DraftEditor-content, [contenteditable="true"]',
    // 标题（知乎使用 textarea）
    titleSelector: 'textarea[placeholder*="标题"], textarea[placeholder*="请输入标题"], .WriteIndex-titleInput textarea, input[placeholder*="标题"]',
    // 正文（知乎使用 Draft.js / ProseMirror）
    contentSelector: '.public-DraftEditor-content, .ProseMirror, [contenteditable="true"]',
    // 封面上传
    coverSelector: 'input[type="file"]',
    // 话题输入
    tagSelector: 'input[placeholder*="搜索话题"], input[placeholder*="话题"], input[placeholder*="tag"], [class*="tag"] input, .TopicSelector-item',
  },

  aliyun: {
    name: '阿里云社区',
    icon: '☁️',
    publishUrl: 'https://developer.aliyun.com/article/new',
    waitForSelector: 'textarea.textarea, textarea#article-editor, .mditor, input[placeholder="请填写标题"]',
    // 标题
    titleSelector: 'input[placeholder="请填写标题"], input[placeholder*="标题"], [class*="title"] input, #title',
    // 正文（阿里云使用 Mditor Markdown 编辑器）
    contentSelector: 'textarea.textarea, textarea#article-editor, .mditor textarea',
    // 封面上传
    coverSelector: 'input[type="file"][accept*="image"]',
    // 标签
    tagSelector: 'input[placeholder*="标签"], [class*="tag"] input',
  },

  csdn: {
    name: 'CSDN',
    icon: '💻',
    publishUrl: 'https://editor.csdn.net/md',
    waitForSelector: '.editor__inner, .CodeMirror, [class*="editor"], [contenteditable="true"]',
    // 标题
    titleSelector: 'input[placeholder*="标题"], .article-bar input, [class*="title"] input, #title',
    // 正文（CSDN 使用 Markdown 编辑器，CodeMirror）
    contentSelector: '.editor__inner, .CodeMirror-code, [contenteditable="true"], .ace_editor',
    // 封面上传
    coverSelector: 'input[type="file"][accept*="image"]',
    // 标签
    tagSelector: 'input[placeholder*="标签"], [class*="tag"] input',
  },

  baijiahao: {
    name: '百家号',
    icon: '🎯',
    publishUrl: 'https://baijiahao.baidu.com/builder/rc/edit?type=news&is_from_cms=1',
    waitForSelector: '[class*="editor"], [contenteditable="true"], .ql-editor',
    // 标题
    titleSelector: 'input[placeholder*="标题"], [class*="title"] input, #title',
    // 正文（百家号使用富文本编辑器）
    contentSelector: '.ql-editor, [contenteditable="true"], [class*="editor"] [contenteditable]',
    // 封面上传
    coverSelector: 'input[type="file"][accept*="image"]',
    // 标签
    tagSelector: 'input[placeholder*="标签"], [class*="tag"] input',
  },
};

// 轻狐AI API 地址（硬编码，无需用户配置）
const DEFAULT_API_BASE = 'https://contentai.hnzant.com';

// localStorage 中存储登录 token 的 key（轻狐AI 前端使用）
const CONTENTAI_TOKEN_KEY = 'contentai-token';

// 轻狐AI 页面匹配（用于检测是否在轻狐AI 页面）
const CONTENTAI_URL_PATTERNS = [
  'https://contentai.hnzant.com',
  'http://localhost:8000',
  'http://localhost:8765',
  'http://localhost:5500',
  'http://localhost:3000',
  'http://wwork.hnzant.com',
];

// 插件版本号（与 manifest.json 同步）
const EXTENSION_VERSION = '1.0.0';

// 更新检查间隔（毫秒，默认 6 小时）
const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
