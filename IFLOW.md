# LeeCommonWxMDFormatHtml 项目概述

这是一个在线工具集合项目，主要提供Markdown格式化、微信公众号排版、数据转换和小游戏等功能。项目基于纯前端技术实现，无需后端支持，可直接在浏览器中运行。

## 项目结构

```
LeeCommonWxMDFormatHtml/
├── css/                      # CSS样式文件
│   ├── font-awesome.min.css  # 字体图标库
│   ├── github.min.css        # GitHub风格Markdown样式
│   └── md-formatter.css      # Markdown格式化样式
├── js/                       # JavaScript脚本文件
│   ├── highlight.min.js      # 代码高亮库
│   ├── marked.min.js         # Markdown解析库
│   └── tailwind.min.js       # Tailwind CSS框架
├── image/                    # 图片资源
│   ├── gzh/                  # 公众号相关图片
│   └── tx/                   # 头像图片
├── markdown/                 # Markdown相关工具
├── wxformat/                 # 微信排版工具
│   ├── image-artic/          # 图片排版工具
│   └── image-word/           # 图文排版工具
├── data-converter/           # 数据转换工具
├── games/                    # 小游戏
├── english-games/            # 英语学习游戏
├── gupiao-games/             # 股票分析工具
├── utils/                    # 实用工具
├── htmltag/                  # HTML标签工具
└── index.html                # 主页入口
```

## 核心功能模块

### 1. 微信排版工具 (wxformat/)

#### 图片排版工具
- **URL双排图**: 使用URL链接的双列图片排版
- **URL三排图**: 使用URL链接的三列图片排版
- **Base64双排图**: 使用Base64编码的双列图片排版
- **Base64三排图**: 使用Base64编码的三列图片排版

#### 图文排版工具
- **图片+艺术字**: 图片与艺术字结合的排版
- **文字框+图片**: 文字框与图片组合的排版
- **朋友圈+图片**: 朋友圈风格与图片的排版
- **图书+图片**: 图书风格与图片的排版

### 2. Markdown工具 (markdown/)

- **Markdown排版预览**: 实时预览Markdown排版效果
- **文本转Markdown**: 将普通文本转换为Markdown格式
- **Markdown预览**: 基础的Markdown渲染预览
- **MD换行格式化**: 优化Markdown换行格式
- **自定义样式**: 自定义Markdown渲染HTML样式

### 3. 数据转换工具 (data-converter/)

- **CSV转JSON**: 将CSV数据转换为JSON格式，支持自定义列名
- **JSON转CSV**: 将JSON数组数据转换为CSV格式，自动识别所有字段
- **HTML-URL提取**: 从HTML标签中提取URL链接

### 4. 实用工具 (utils/)

- **图片预览器**: 拖拽图片预览工具
- **文本预览器**: 拖拽文件预览工具

### 5. 娱乐工具

- **小游戏**: CS:GO练枪小游戏
- **英语游戏**: 英语学习相关游戏
- **股票分析**: 股票数据分析工具

## 技术栈

- **前端框架**: 纯HTML5 + CSS3 + JavaScript (ES6+)
- **UI框架**: Tailwind CSS
- **Markdown解析**: Marked.js
- **代码高亮**: Highlight.js
- **图标库**: Font Awesome
- **样式主题**: GitHub Markdown CSS

## 开发和运行

### 本地运行
1. 克隆项目到本地
2. 使用任意HTTP服务器运行项目，例如：
   ```bash
   # 使用Python内置服务器
   python -m http.server 8000
   
   # 使用Node.js http-server
   npx http-server
   
   # 使用PHP内置服务器
   php -S localhost:8000
   ```
3. 访问 `http://localhost:8000` 查看主页

### 项目特点
- **纯前端实现**: 无需后端服务器，可直接在浏览器中运行
- **响应式设计**: 适配各种屏幕尺寸，包括移动设备
- **模块化结构**: 各功能模块独立，便于维护和扩展
- **用户友好**: 简洁直观的界面设计，操作简单

## 文件说明

### 主页 (index.html)
项目的主入口文件，提供所有工具的分类导航和搜索功能。采用响应式网格布局，支持按类别筛选和关键词搜索。

### Markdown工具
所有Markdown相关工具都使用Marked.js进行解析，并支持自定义CSS样式。特别优化了微信公众号的排版需求。

### 微信排版工具
专门针对微信公众号文章排版需求设计，支持多种排版样式，包括图片排版和图文混排。

### 数据转换工具
提供常见数据格式之间的转换功能，支持CSV和JSON格式的双向转换。

## 扩展指南

### 添加新工具
1. 在相应目录下创建HTML文件
2. 遵循现有的文件结构和命名规范
3. 在index.html中添加工具卡片
4. 确保响应式设计和样式一致性

### 样式定制
- 修改CSS变量以调整主题色彩
- 更新工具卡片样式以保持视觉一致性
- 确保移动设备上的显示效果

## 注意事项

- 所有工具均为客户端实现，不会上传用户数据到服务器
- 图片处理工具支持本地文件拖拽和URL输入两种方式
- Markdown工具支持实时预览和样式自定义
- 数据转换工具处理大文件时可能存在性能限制