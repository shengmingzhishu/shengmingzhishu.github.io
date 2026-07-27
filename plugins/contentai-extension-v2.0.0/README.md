# 轻狐AI Chrome 浏览器插件 — 安装与使用指南

## 一、安装步骤

### 1. 加载插件
1. 打开 Chrome 浏览器，地址栏输入 `chrome://extensions/`
2. 开启右上角的「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择 `contentai/chrome-extension/` 目录

### 2. 登录轻狐AI（自动配置）
1. 打开轻狐AI 网站并扫码登录
2. 插件会**自动获取**登录 Token，无需任何手动配置
3. 点击浏览器右上角的插件图标 🦊，确认显示「● 已登录」即可

> Token 在登录后自动同步，全程无需手动填写。

### 3. 使用发布功能
1. 打开轻狐AI 网站，进入文章列表
2. 如果插件已正确加载，每篇文章会出现紫色的「插件发布」按钮
3. 点击「插件发布」，插件会自动打开对应平台的编辑器
4. 内容（标题、正文、图片、标签）会自动填充到平台编辑器
5. 检查内容无误后，在平台页面点击自己的「发布」按钮

---

## 二、目录结构

```
chrome-extension/
├── manifest.json                      # Manifest V3 配置文件
├── config.js                          # 平台配置 & API 地址
├── background/
│   └── service-worker.js              # 后台服务（消息路由、标签管理、图片下载）
├── content-scripts/
│   ├── contentai-injector.js          # 轻狐AI 页面注入（监听发布请求）
│   ├── wechat.js                      # 微信公众号自动填充
│   ├── xiaohongshu.js                 # 小红书自动填充
│   ├── douyin.js                      # 抖音自动填充
│   ├── bilibili.js                    # B站专栏自动填充
│   ├── toutiao.js                     # 今日头条自动填充
│   ├── zhihu.js                       # 知乎自动填充
│   ├── aliyun.js                      # 阿里云社区自动填充
│   ├── csdn.js                        # CSDN自动填充
│   └── baijiahao.js                   # 百家号自动填充
├── popup/
│   ├── popup.html                     # 弹窗 UI
│   ├── popup.js                       # 弹窗逻辑
│   └── popup.css                      # 弹窗样式
├── lib/
│   └── content-utils.js               # 共享工具函数
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## 三、支持的平台

| 平台 | 发布页 URL | 自动填充内容 |
|------|-----------|-------------|
| 微信公众号 | mp.weixin.qq.com | 标题、正文（HTML）、封面图 |
| 小红书 | creator.xiaohongshu.com | 图片、标题、正文、话题标签 |
| 抖音 | creator.douyin.com | 图片、标题+描述、话题标签 |
| B站专栏 | member.bilibili.com | 标题、正文（HTML）、封面图、标签 |
| 今日头条 | mp.toutiao.com | 标题、正文（HTML）、封面图 |
| 知乎 | zhuanlan.zhihu.com | 标题、正文（HTML）、封面图、话题 |
| 阿里云社区 | developer.aliyun.com | 标题、正文（HTML）、封面图、标签 |
| CSDN | editor.csdn.net | 标题、正文（Markdown/HTML）、封面图、标签 |
| 百家号 | baijiahao.baidu.com | 标题、正文（HTML）、封面图、标签 |

---

## 四、后端 API

插件使用以下 API 端点（已添加到 `app/routers/extension_router.py`）：

| 端点 | 方法 | 功能 |
|------|------|------|
| `/api/extension/status` | GET | 插件状态检查 |
| `/api/extension/platforms` | GET | 可用平台列表 |
| `/api/extension/article/{id}/publish-data` | GET | 获取文章发布数据 |
| `/api/extension/publish-complete` | POST | 回传发布完成状态 |

---

## 五、通信机制

```
文章列表 → window.postMessage → contentai-injector.js
    → chrome.runtime.sendMessage → service-worker.js
    → chrome.tabs.create → 平台页面
    → chrome.tabs.sendMessage → 平台 content script
    → 自动填充内容
    → chrome.runtime.sendMessage → service-worker.js
    → 回传轻狐AI API
```

---

## 六、注意事项

1. **首次使用前**：需要先在 Chrome 中加载插件，并确保轻狐AI 网页已刷新
2. **图片上传**：图片通过 background service worker 下载后注入到平台的 file input，需要轻狐AI 图片 URL 可公开访问
3. **平台登录**：使用前需确保已在浏览器中登录对应平台（微信公众号、小红书等）
4. **SPA 等待**：各平台编辑器是 SPA，插件会等待 3 秒让页面渲染完成后再填充
5. **手动确认**：插件仅自动填充内容，不代替用户点击「发布」按钮，需用户手动确认发布
6. **DOM 选择器**：各平台的 DOM 结构可能随版本更新而变化，如填充失败需检查并更新选择器
