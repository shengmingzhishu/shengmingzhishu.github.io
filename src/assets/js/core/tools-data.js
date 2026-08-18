/* ============================================================
 * 墨韵工具集 · 工具清单数据（tools-data.js）
 * ------------------------------------------------------------
 * 主页渲染的唯一数据源；新增/下线工具只改本文件。
 * 校验约束（test/unit/ut-02 维护）：
 *   - tools[].cat 必须存在于 categories（all 除外）
 *   - tools[].link 必须指向仓库内真实存在的文件
 *   - tools[].id 全局唯一；icon 必须是 ICONS 中已定义的键
 * 兼容：浏览器全局 TOOLS_DATA / Node module.exports 双导出。
 * ============================================================ */
(function (global) {
  'use strict';

  /** 分类筛选 chips（主页展示顺序） */
  var categories = [
    { key: 'all',      label: '全部' },
    { key: 'creation', label: '创作' },
    { key: 'layout',   label: '排版' },
    { key: 'image',    label: '图片' },
    { key: 'doc',      label: '文档' },
    { key: 'fun',      label: '趣味' }
  ];

  /** 工具分组（网格区块顺序） */
  var groups = [
    { key: 'creation', title: '创意写作' },
    { key: 'layout',   title: '排版工具' },
    { key: 'image',    title: '图片工具' },
    { key: 'doc',      title: '文档与技能' },
    { key: 'fun',      title: '趣味工具' }
  ];

  /** 内联 SVG 图标（stroke 1.5，currentColor，参考 frontend-page-style skill） */
  var ICONS = {
    pen:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>',
    smile:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>',
    layout:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>',
    image:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>',
    columns:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="3" x2="12" y2="21"/></svg>',
    doc:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
    compress: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>',
    fortune:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4"/><path d="M17.66 6.34l-2.83 2.83"/><path d="M20 12h-4"/><path d="M17.66 17.66l-2.83-2.83"/><path d="M12 20v-4"/><path d="M6.34 17.66l2.83-2.83"/><path d="M4 12h4"/><path d="M6.34 6.34l2.83 2.83"/></svg>',
    book:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>'
  };

  /** 工具清单：{id, cat, name, desc, icon, link} */
  var tools = [
    { id: 'ai-article',  cat: 'creation', name: 'AI 文章智能写作', desc: '输入主题，AI 分析关键词并生成优质公众号文章', icon: 'pen',      link: 'src/tools/article/article-v3.html' },
    { id: 'emoji-maker', cat: 'creation', name: '表情包制作',       desc: '网格图拆分、逐个删除，只留下最满意的表情', icon: 'smile',    link: 'src/tools/emoji/emoji-splitter-v11.html' },
    { id: 'wx-editor',   cat: 'layout',   name: '公众号编辑器',     desc: '公众号图文编辑排版，多平台一键发布',       icon: 'layout',   link: 'src/tools/wechat/editor-v2.html' },
    { id: 'xhs-poster',  cat: 'layout',   name: '小红书海报生成',   desc: 'Markdown 转小红书风格图片，多模板可切换',   icon: 'image',    link: 'src/tools/xiaohongshu/poster-v6.html' },
    { id: 'img-text',    cat: 'layout',   name: '图文 VIP 排版',    desc: '统一风格，图片链接双列排版',               icon: 'columns',  link: 'src/tools/image-layout/image-text-layout-v11.html' },
    { id: 'vip-tuwen',   cat: 'doc',      name: '图文 VIP 工具',    desc: '文本转 MD · MD 预览 · 文章图片 URL 提取',   icon: 'doc',      link: 'src/tools/tuwen/vip_tuwen.html' },
    { id: 'doc-manager', cat: 'doc',      name: '文档管理器',        desc: '结构化设计文档，缩进层级 + 树形预览 + 撤销导出', icon: 'doc', link: 'src/tools/doc-manager.html' },
    { id: 'img-compress',cat: 'image',    name: '批量图片压缩',     desc: '多图上传统一裁切缩放，批量导出压缩包',     icon: 'compress', link: 'src/tools/compress/compress.html' },
    { id: 'skills-doc',  cat: 'doc',      name: 'Skills 技能文档',  desc: 'AI 写作工作流与多平台发布技能完整文档',     icon: 'book',     link: 'src/tools/skills/skill.html' },
    { id: 'fortune',     cat: 'fun',      name: '上上签',           desc: '随机抽签小工具，给你一个好彩头',           icon: 'fortune',  link: 'src/tools/fun/fortune.html' }
  ];

  var TOOLS_DATA = { categories: categories, groups: groups, tools: tools, ICONS: ICONS };

  global.TOOLS_DATA = TOOLS_DATA;
  if (typeof module !== 'undefined' && module.exports) module.exports = TOOLS_DATA;
})(typeof window !== 'undefined' ? window : globalThis);
