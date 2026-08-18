/**
 * 文档管理器 · 核心逻辑
 * ---------------------------------------------------------------
 * 职责：
 *   1) 分块管理（增/删/复制/拖拽排序）
 *   2) Markdown ↔ 树形结构 双向解析与渲染
 *   3) 节点操作（增/删/编辑/颜色标记/拖拽排序）
 *   4) 撤销栈
 *   5) 预置模板
 *   6) 导出
 * ===============================================================
 */

;(function () {
  'use strict';

  /* ============================================================
   * 工具函数
   * ============================================================ */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
  const uid = () => 'blk_' + Math.random().toString(36).slice(2, 10);

  /* ============================================================
   * 光标导航辅助（行尾优先，配合 md-editor 方向键）
   * ---------------------------------------------------------------
   * 设计目标（见 docs/design/doc-manager.md §2.1）：
   *   ↑/↓ 光标跳到相邻行【行尾】，方便直接续填内容；
   *   → 在行尾时跳下一行行尾（串联式顺行填写）；← 行首跳上一行行尾。
   * 均返回目标行的行尾偏移（不含换行符）。
   * ============================================================ */
  /** 光标所在行索引（0-based） */
  function caretLineIndex(value, pos) {
    let line = 0, from = 0;
    for (;;) {
      const nl = value.indexOf('\n', from);
      if (nl === -1 || pos <= nl) return line;
      line++; from = nl + 1;
    }
  }
  /** 目标行行尾偏移（不含换行符） */
  function lineEndOffset(value, lineIdx) {
    const lines = value.split('\n');
    if (lineIdx < 0) lineIdx = 0;
    if (lineIdx >= lines.length) lineIdx = lines.length - 1;
    let off = 0;
    for (let i = 0; i < lineIdx; i++) off += lines[i].length + 1;
    return off + lines[lineIdx].length;
  }

  /* ============================================================
   * 预置模板
   * 每个模板都是 Markdown 文本，用缩进表达层级
   * ============================================================ */
  const TEMPLATES = {
    blank: { title: '空白分块', text: '' },

    // 模板规范（见 docs/design/doc-manager.md §2.2）：
    //   一行 = 一个填写点，行尾统一 `: ` 便于直接续填；
    //   相关字段用 ` / ` 合并为一行；有默认建议用 `(默认: xxx)` 声明。
    'project-design': {
      title: '项目设计',
      text:
`# 项目名称: 
  ## 背景 / 目标用户 / 核心价值: 
  ## 功能模块 (模块名: 功能描述, 可多行): 
  ## 技术选型 / 框架 / 数据库 / 部署: 
  ## 接口 / 路由 / 鉴权: 
  ## 里程碑 (M1: 交付内容, 默认: 按周迭代): `
    },

    'issue-fix': {
      title: '问题修复计划',
      text:
`# 问题修复计划: 
  ## 问题标题 / 编号: 
  ## 现象 / 触发条件 / 影响范围: 
  ## 根因 / 日志报错 / 代码位置: 
  ## 复现步骤 (默认: 步骤一 → 步骤二): 
  ## 期望结果 / 验收标准: 
  ## 修改方案 (文件路径: 修改说明, 可多行): 
  ## 回归范围 / 遗留风险: `
    },

    'new-feature': {
      title: '新功能追加设计',
      text:
`# 新功能名称: 
  ## 目标 / 解决什么问题 / 成功指标: 
  ## 影响范围 (模块: 影响点, 可多行): 
  ## 设计方案 (UI / 数据流 / 接口): 
  ## 注意事项 (兼容性 / 性能 / 安全): 
  ## 测试要求 (单测 / 集成 / 回归): 
  ## 开发流程 (分析 → 设计 → 编码 → 验证, 默认: 全流程): `
    },

    'task-breakdown': {
      title: '项目任务分解',
      text:
`# 项目名称: 
  ## 阶段一: 阶段名: 
    ### 任务 1.1 (任务描述): 
      - 负责人 / 预估工时 / 优先级 / 依赖: 
    ### 任务 1.2 (任务描述): 
      - 负责人 / 预估工时: 
  ## 阶段二: 阶段名: 
    ### 任务 2.1 (任务描述): 
      - 负责人 / 预估工时: `
    },

    'change-request': {
      title: '旧功能变更记录',
      text:
`# 变更标题: 
  ## 触发来源 (需求/缺陷/优化, 默认: 需求) / 变更动机: 
  ## 当前行为 / 存在的问题: 
  ## 期望行为: 
  ## 影响范围 (模块: 影响描述, 可多行): 
  ## 变更方案 (文件/位置: 修改说明, 可多行): 
  ## 风险评估 (兼容性 / 回滚方案): 
  ## 测试要点 (验证场景一 / 场景二): `
    }
  };

  /* ============================================================
   * Markdown 解析器（基于缩进）
   * ---------------------------------------------------------------
   * 规则：
   *   - 行首缩进（2空格 = 1级）决定层级
   *   - 以 # 开头为标题节点，- 或 * 开头为列表节点，其他为文本节点
   *   - 空行被忽略
   *   - 每个节点存储：text, level, type, color, children
   * ============================================================ */
  function parseMd(text) {
    if (!text || !text.trim()) return [];
    const lines = text.split('\n');
    const root = []; // 顶层节点列表

    // 将行转为节点对象
    const nodes = [];
    for (const raw of lines) {
      if (!raw.trim()) continue;
      const indent = raw.search(/\S/); // 缩进空格数
      const content = raw.trim();
      let type = 'text';
      if (/^#{1,6}\s/.test(content)) type = 'heading';
      else if (/^[-*]\s/.test(content)) type = 'list';

      nodes.push({ text: content, level: Math.floor(indent / 2), type, color: null, children: [] });
    }

    if (nodes.length === 0) return root;

    // 用栈构建树
    const stack = []; // { node, level }
    for (const n of nodes) {
      const item = { ...n, children: [] };
      // 弹出栈中层级 >= 当前层级的
      while (stack.length && stack[stack.length - 1].level >= item.level) {
        stack.pop();
      }
      if (stack.length === 0) {
        root.push(item);
      } else {
        stack[stack.length - 1].node.children.push(item);
      }
      stack.push({ node: item, level: item.level });
    }
    return root;
  }

  /**
   * 树 → Markdown 文本（序列化）
   */
  function serializeTree(nodes, indent = 0) {
    const lines = [];
    for (const n of nodes) {
      const prefix = '  '.repeat(indent);
      lines.push(prefix + n.text);
      if (n.children && n.children.length) {
        lines.push(...serializeTree(n.children, indent + 1));
      }
    }
    return lines.join('\n');
  }

  /**
   * 收集树中所有节点的扁平列表（用于索引定位）
   */
  function flattenTree(nodes, parentPath = '') {
    const result = [];
    nodes.forEach((n, i) => {
      const path = parentPath ? parentPath + '.' + i : '' + i;
      result.push({ node: n, path, index: i });
      if (n.children) {
        result.push(...flattenTree(n.children, path));
      }
    });
    return result;
  }

  /* ============================================================
   * 状态管理
   * ============================================================ */
  const state = {
    blocks: [], // { id, title, color, text, tree, collapsed }
    undoStack: [],
    redoStack: [],
    blockCounter: 0
  };

  function pushUndo(snapshot) {
    state.undoStack.push(JSON.stringify(snapshot));
    if (state.undoStack.length > 50) state.undoStack.shift();
    state.redoStack = [];
  }

  function takeSnapshot() {
    return state.blocks.map(b => ({
      id: b.id, title: b.title, color: b.color,
      text: b.text, collapsed: b.collapsed
    }));
  }

  function restoreSnapshot(json) {
    const snap = JSON.parse(json);
    state.blocks = snap.map(b => ({
      ...b, tree: parseMd(b.text)
    }));
    renderAllBlocks();
  }

  function undo() {
    if (state.undoStack.length === 0) return;
    state.redoStack.push(JSON.stringify(takeSnapshot()));
    restoreSnapshot(state.undoStack.pop());
  }

  /* ============================================================
   * 分块 CRUD
   * ============================================================ */
  function addBlock(templateKey = 'blank') {
    const tmpl = TEMPLATES[templateKey] || TEMPLATES.blank;
    pushUndo(takeSnapshot());
    const block = {
      id: uid(),
      title: tmpl.title,
      color: null,
      text: tmpl.text,
      tree: parseMd(tmpl.text),
      collapsed: false
    };
    state.blocks.push(block);
    renderBlock(block);
    updateEmptyState();
    // 滚动到新分块
    const el = $(`[data-block-id="${block.id}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function deleteBlock(blockId) {
    pushUndo(takeSnapshot());
    state.blocks = state.blocks.filter(b => b.id !== blockId);
    const el = $(`[data-block-id="${blockId}"]`);
    if (el) el.remove();
    updateEmptyState();
  }

  function duplicateBlock(blockId) {
    const src = state.blocks.find(b => b.id === blockId);
    if (!src) return;
    pushUndo(takeSnapshot());
    const idx = state.blocks.indexOf(src);
    const dup = {
      id: uid(),
      title: src.title + '（副本）',
      color: src.color,
      text: src.text,
      tree: parseMd(src.text),
      collapsed: false
    };
    state.blocks.splice(idx + 1, 0, dup);
    const el = $(`[data-block-id="${blockId}"]`);
    if (el) {
      const newEl = renderBlock(dup);
      el.after(newEl);
    }
    updateEmptyState();
  }

  /* ============================================================
   * 渲染
   * ============================================================ */
  function renderAllBlocks() {
    const container = $('#blocksContainer');
    container.innerHTML = '';
    state.blocks.forEach(b => renderBlock(b));
    updateEmptyState();
  }

  function renderBlock(block) {
    const container = $('#blocksContainer');
    const tmpl = $('#tmplBlock');
    const clone = tmpl.content.cloneNode(true);
    const el = clone.querySelector('.doc-block');
    el.dataset.blockId = block.id;

    // 标题
    clone.querySelector('.block-title-input').value = block.title;

    // 颜色
    if (block.color) {
      el.classList.add('block-colored-' + block.color);
      const dot = clone.querySelector(`.color-dot[data-color="none"]`);
      const activeDot = clone.querySelector(`.color-dot[style*="${blockColorHex(block.color)}"]`);
      if (activeDot) activeDot.classList.add('active');
    }

    // 折叠状态
    if (block.collapsed) {
      clone.querySelector('.block-body').classList.add('collapsed');
    }

    // 左侧文本
    clone.querySelector('.md-editor').value = block.text;

    container.appendChild(el);

    // 渲染右侧树
    renderTree(block);

    // 绑定事件
    bindBlockEvents(block, el);
    return el;
  }

  function blockColorHex(name) {
    const map = { blue: '#4d6bfe', green: '#10b981', orange: '#f59e0b', red: '#ef4444', purple: '#8b5cf6' };
    return map[name] || '';
  }

  function renderTree(block) {
    const blockEl = $(`[data-block-id="${block.id}"]`);
    if (!blockEl) return;
    const treeContainer = blockEl.querySelector('.tree-view');
    treeContainer.innerHTML = '';
    if (block.tree.length === 0) {
      treeContainer.innerHTML = '<div class="empty-state" style="padding:20px"><span class="empty-state-text">左侧输入文本后实时渲染</span></div>';
      return;
    }
    block.tree.forEach((node, i) => {
      treeContainer.appendChild(renderTreeNode(node, block, [i]));
    });
  }

  function renderTreeNode(node, block, path) {
    const el = document.createElement('div');
    el.className = 'tree-node' + (path.length === 1 ? ' tree-root' : '');
    el.dataset.path = path.join('.');

    const hasChildren = node.children && node.children.length > 0;

    // 内容行
    const content = document.createElement('div');
    content.className = 'tree-node-content';
    content.dataset.path = path.join('.');

    // 展开/折叠
    const toggle = document.createElement('button');
    toggle.className = 'tree-toggle' + (!hasChildren ? ' leaf' : '');
    toggle.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>';
    if (hasChildren) {
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const childrenEl = el.querySelector('.tree-children');
        if (childrenEl) {
          childrenEl.classList.toggle('collapsed');
          toggle.classList.toggle('collapsed');
        }
      });
    }
    content.appendChild(toggle);

    // 序号
    const indexEl = document.createElement('span');
    indexEl.className = 'tree-index';
    indexEl.textContent = path[path.length - 1] + 1;
    content.appendChild(indexEl);

    // 颜色标记
    const colorBar = document.createElement('span');
    colorBar.className = 'tree-color-bar' + (node.color ? ' show' : '');
    if (node.color) colorBar.style.background = node.color;
    content.appendChild(colorBar);

    // 文本
    const textEl = document.createElement('span');
    textEl.className = 'tree-text';
    // 解析类型样式
    if (node.type === 'heading') {
      const m = node.text.match(/^(#{1,6})\s/);
      if (m) {
        textEl.classList.add('heading-' + m[1].length);
        textEl.textContent = node.text.replace(/^#{1,6}\s/, '');
      } else {
        textEl.textContent = node.text;
      }
    } else if (node.type === 'list') {
      textEl.classList.add('list-item');
      textEl.textContent = node.text.replace(/^[-*]\s/, '');
    } else {
      textEl.textContent = node.text;
    }
    content.appendChild(textEl);

    // 右键菜单
    content.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showContextMenu(e.clientX, e.clientY, block, path);
    });

    // 单击选中
    content.addEventListener('click', (e) => {
      e.stopPropagation();
      $$('.tree-node-content.selected', blockEl(block)).forEach(c => c.classList.remove('selected'));
      content.classList.add('selected');
    });

    // 拖拽
    content.setAttribute('draggable', 'true');
    content.addEventListener('dragstart', (e) => {
      e.stopPropagation();
      e.dataTransfer.setData('text/plain', JSON.stringify({ blockId: block.id, path: path.join('.') }));
      e.dataTransfer.effectAllowed = 'move';
      content.classList.add('dragging');
      setTimeout(() => content.style.opacity = '0.4', 0);
    });
    content.addEventListener('dragend', () => {
      content.style.opacity = '';
      content.classList.remove('dragging');
    });
    content.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      content.classList.add('drag-over-node');
    });
    content.addEventListener('dragleave', () => {
      content.classList.remove('drag-over-node');
    });
    content.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      content.classList.remove('drag-over-node');
      try {
        const data = JSON.parse(e.dataTransfer.getData('text/plain'));
        if (data.blockId === block.id && data.path !== path.join('.')) {
          moveNode(block, data.path.split('.').map(Number), path);
        }
      } catch (_) {}
    });

    el.appendChild(content);

    // 子节点
    if (hasChildren) {
      const childrenWrap = document.createElement('div');
      childrenWrap.className = 'tree-children';
      node.children.forEach((child, ci) => {
        childrenWrap.appendChild(renderTreeNode(child, block, [...path, ci]));
      });
      el.appendChild(childrenWrap);
    }

    return el;
  }

  function blockEl(block) {
    return $(`[data-block-id="${block.id}"]`);
  }

  /* ============================================================
   * 节点操作
   * ============================================================ */

  /** 根据 path 获取节点引用 */
  function getNodeByPath(nodes, pathArr) {
    let current = nodes;
    let parent = null;
    let node = null;
    for (let i = 0; i < pathArr.length; i++) {
      node = current[pathArr[i]];
      if (!node) return null;
      if (i < pathArr.length - 1) {
        parent = current;
        current = node.children || [];
      }
    }
    return { node, parent, siblings: current };
  }

  /** 添加子节点 */
  function addChildNode(block, parentPath) {
    pushUndo(takeSnapshot());
    const { node: parent } = getNodeByPath(block.tree, parentPath);
    if (!parent) return;
    if (!parent.children) parent.children = [];
    parent.children.push({ text: '新子节点', level: parentPath.length, type: 'text', color: null, children: [] });
    syncBlock(block);
  }

  /** 添加同级节点 */
  function addSiblingNode(block, path) {
    pushUndo(takeSnapshot());
    const { node, siblings } = getNodeByPath(block.tree, path);
    if (!node) return;
    const idx = path[path.length - 1];
    siblings.splice(idx + 1, 0, { text: '新同级节点', level: path.length - 1, type: 'text', color: null, children: [] });
    syncBlock(block);
  }

  /** 删除节点 */
  function deleteNode(block, path) {
    pushUndo(takeSnapshot());
    const { siblings } = getNodeByPath(block.tree, path);
    if (!siblings) return;
    const idx = path[path.length - 1];
    siblings.splice(idx, 1);
    syncBlock(block);
  }

  /** 编辑节点文本 */
  function editNode(block, path) {
    const { node } = getNodeByPath(block.tree, path);
    if (!node) return;
    const pathStr = path.join('.');
    const blockE = blockEl(block);
    if (!blockE) return;
    const contentEl = blockE.querySelector(`[data-path="${pathStr}"]`);
    if (!contentEl) return;
    const textSpan = contentEl.querySelector('.tree-text');
    if (!textSpan) return;

    // 替换为 input
    const input = document.createElement('input');
    input.className = 'tree-inline-edit';
    input.value = node.text;
    textSpan.replaceWith(input);
    input.focus();
    input.select();

    const finish = () => {
      pushUndo(takeSnapshot());
      node.text = input.value || '空节点';
      // 重新判断类型
      if (/^#{1,6}\s/.test(node.text)) node.type = 'heading';
      else if (/^[-*]\s/.test(node.text)) node.type = 'list';
      else node.type = 'text';
      syncBlock(block);
    };
    input.addEventListener('blur', finish);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
      if (e.key === 'Escape') { input.value = node.text; input.blur(); }
    });
  }

  /** 标记节点颜色 */
  function colorNode(block, path, color) {
    pushUndo(takeSnapshot());
    const { node } = getNodeByPath(block.tree, path);
    if (!node) return;
    node.color = color;
    syncBlock(block);
  }

  /** 移动节点（拖拽） */
  function moveNode(block, fromPath, toPath) {
    pushUndo(takeSnapshot());
    const from = getNodeByPath(block.tree, fromPath);
    if (!from.node) return;
    const nodeCopy = JSON.parse(JSON.stringify(from.node));
    from.siblings.splice(fromPath[fromPath.length - 1], 1);

    // 插入到目标位置（作为目标的同级，排在目标之后）
    const to = getNodeByPath(block.tree, toPath);
    if (!to.siblings) return;
    const insertIdx = toPath[toPath.length - 1] + 1;
    to.siblings.splice(insertIdx, 0, nodeCopy);

    // 重新计算层级
    recalcLevels(block.tree, 0);
    syncBlock(block);
  }

  function recalcLevels(nodes, level) {
    for (const n of nodes) {
      n.level = level;
      if (n.children) recalcLevels(n.children, level + 1);
    }
  }

  /** 同步：树 → 文本 → 重新渲染 */
  function syncBlock(block) {
    block.text = serializeTree(block.tree);
    block.tree = parseMd(block.text);
    const el = blockEl(block);
    if (!el) return;
    el.querySelector('.md-editor').value = block.text;
    renderTree(block);
  }

  /** 同步：文本 → 树 → 重新渲染 */
  function syncFromText(block) {
    block.tree = parseMd(block.text);
    renderTree(block);
  }

  /* ============================================================
   * 右键菜单
   * ============================================================ */
  let contextTarget = null; // { block, path }

  function showContextMenu(x, y, block, path) {
    contextTarget = { block, path };
    const menu = $('#nodeContextMenu');
    menu.style.display = 'block';
    // 确保不超出视口
    const w = menu.offsetWidth, h = menu.offsetHeight;
    menu.style.left = (x + w > window.innerWidth ? x - w : x) + 'px';
    menu.style.top = (y + h > window.innerHeight ? y - h : y) + 'px';
  }

  function hideContextMenu() {
    $('#nodeContextMenu').style.display = 'none';
    $('#colorSubmenu').style.display = 'none';
    contextTarget = null;
  }

  /* ============================================================
   * 事件绑定
   * ============================================================ */
  function bindBlockEvents(block, el) {
    // 标题修改
    const titleInput = el.querySelector('.block-title-input');
    titleInput.addEventListener('input', () => {
      block.title = titleInput.value;
    });

    // Markdown 文本修改
    const editor = el.querySelector('.md-editor');
    let debounceTimer;
    editor.addEventListener('input', () => {
      block.text = editor.value;
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => syncFromText(block), 300);
    });
    // Tab 键支持 + 方向键行尾导航（见 docs/design/doc-manager.md §2.1）
    editor.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        editor.value = editor.value.substring(0, start) + '  ' + editor.value.substring(end);
        editor.selectionStart = editor.selectionEnd = start + 2;
        editor.dispatchEvent(new Event('input'));
        return;
      }
      // 方向键：仅拦截无组合键、无选区、非 IME 组合输入的情况
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || e.isComposing) return;
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      const selStart = editor.selectionStart, selEnd = editor.selectionEnd;
      if (selStart !== selEnd) return; // 有选区时保留默认行为
      const value = editor.value;
      const cur = caretLineIndex(value, selStart);
      const lineCount = value.split('\n').length;
      let target = null;
      if (e.key === 'ArrowUp') {
        if (cur > 0) target = cur - 1;
      } else if (e.key === 'ArrowDown') {
        if (cur < lineCount - 1) target = cur + 1;
      } else if (e.key === 'ArrowRight') {
        // 已在本行行尾 → 跳下一行行尾（串联式顺行填写）
        if (selStart >= lineEndOffset(value, cur) && cur < lineCount - 1) target = cur + 1;
      } else if (e.key === 'ArrowLeft') {
        // 已在本行行首 → 跳上一行行尾
        const lineStart = lineEndOffset(value, cur) - value.split('\n')[cur].length;
        if (selStart <= lineStart && cur > 0) target = cur - 1;
      }
      if (target !== null) {
        e.preventDefault();
        const pos = lineEndOffset(value, target);
        editor.selectionStart = editor.selectionEnd = pos;
      }
    });

    // 分块颜色选择
    el.querySelectorAll('.color-dot').forEach(dot => {
      dot.addEventListener('click', (e) => {
        e.stopPropagation();
        const colorName = dot.dataset.color;
        // 移除旧颜色
        el.className = el.className.replace(/block-colored-\w+/g, '').trim();
        el.querySelectorAll('.color-dot').forEach(d => d.classList.remove('active'));
        if (colorName && colorName !== 'none') {
          el.classList.add('block-colored-' + colorName);
          block.color = colorName;
          dot.classList.add('active');
        } else {
          block.color = null;
          dot.classList.add('active');
        }
      });
    });

    // 折叠分块
    el.querySelector('[data-action="collapse"]').addEventListener('click', () => {
      block.collapsed = !block.collapsed;
      el.querySelector('.block-body').classList.toggle('collapsed');
    });

    // 删除分块
    el.querySelector('[data-action="delete"]').addEventListener('click', () => {
      if (confirm('确认删除此分块？')) deleteBlock(block.id);
    });

    // 复制分块
    el.querySelector('[data-action="duplicate"]').addEventListener('click', () => {
      duplicateBlock(block.id);
    });

    // 全部展开/收起
    el.querySelector('[data-action="expand-all"]').addEventListener('click', () => {
      el.querySelectorAll('.tree-children').forEach(c => c.classList.remove('collapsed'));
      el.querySelectorAll('.tree-toggle').forEach(t => t.classList.remove('collapsed'));
    });
    el.querySelector('[data-action="collapse-all"]').addEventListener('click', () => {
      el.querySelectorAll('.tree-children').forEach(c => c.classList.add('collapsed'));
      el.querySelectorAll('.tree-toggle:not(.leaf)').forEach(t => t.classList.add('collapsed'));
    });

    // 分块拖拽排序
    el.setAttribute('draggable', 'true');
    el.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('block-id', block.id);
      e.dataTransfer.effectAllowed = 'move';
      el.classList.add('dragging');
      setTimeout(() => el.style.opacity = '0.5', 0);
    });
    el.addEventListener('dragend', () => {
      el.style.opacity = '';
      el.classList.remove('dragging');
    });
    el.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (e.dataTransfer.types.includes('block-id')) {
        el.classList.add('drag-over');
      }
    });
    el.addEventListener('dragleave', () => {
      el.classList.remove('drag-over');
    });
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      el.classList.remove('drag-over');
      const draggedId = e.dataTransfer.getData('block-id');
      if (draggedId && draggedId !== block.id) {
        pushUndo(takeSnapshot());
        const fromIdx = state.blocks.findIndex(b => b.id === draggedId);
        const toIdx = state.blocks.findIndex(b => b.id === block.id);
        const [moved] = state.blocks.splice(fromIdx, 1);
        state.blocks.splice(toIdx, 0, moved);
        renderAllBlocks();
      }
    });
  }

  function updateEmptyState() {
    const container = $('#blocksContainer');
    const existing = container.querySelector('.empty-state');
    if (state.blocks.length === 0) {
      if (!existing) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">📄</div>
            <div class="empty-state-text">暂无文档分块</div>
            <div class="empty-state-hint">点击上方「添加分块」按钮开始创建结构化设计文档</div>
          </div>`;
      }
    } else if (existing) {
      existing.remove();
    }
  }

  /* ============================================================
   * 导出
   * ============================================================ */
  function exportAll() {
    const lines = [];
    for (const block of state.blocks) {
      lines.push('# ' + block.title);
      if (block.color) lines.push('<!-- color:' + block.color + ' -->');
      lines.push('');
      lines.push(block.text);
      lines.push('');
      lines.push('---');
      lines.push('');
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '设计文档_' + new Date().toISOString().slice(0, 10) + '.md';
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ============================================================
   * 初始化
   * ============================================================ */
  function init() {
    try {
    // 添加分块下拉
    const btnAdd = $('#btnAddBlock');
    const menu = $('#templateMenu');
    btnAdd.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.classList.toggle('show');
    });

    menu.querySelectorAll('.dropdown-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        addBlock(item.dataset.template);
        menu.classList.remove('show');
      });
    });

    // 点击其他地方关闭下拉
    document.addEventListener('click', () => {
      menu.classList.remove('show');
      hideContextMenu();
    });

    // 撤销
    $('#btnUndo').addEventListener('click', undo);
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.target.closest('.md-editor')) {
        e.preventDefault();
        undo();
      }
    });

    // 导出
    $('#btnExport').addEventListener('click', exportAll);

    // 右键菜单操作
    $('#nodeContextMenu').addEventListener('click', (e) => {
      const item = e.target.closest('.ctx-item');
      if (!item || !contextTarget) return;
      e.stopPropagation();
      const action = item.dataset.action;
      const { block, path } = contextTarget;

      if (action === 'add-child') addChildNode(block, path);
      else if (action === 'add-sibling') addSiblingNode(block, path);
      else if (action === 'edit') editNode(block, path);
      else if (action === 'delete') deleteNode(block, path);
      else if (action === 'color') {
        const submenu = $('#colorSubmenu');
        const rect = item.getBoundingClientRect();
        submenu.style.display = 'flex';
        submenu.style.left = rect.right + 'px';
        submenu.style.top = rect.top + 'px';
      }
      hideContextMenu();
    });

    // 颜色子菜单
    $('#colorSubmenu').addEventListener('click', (e) => {
      const opt = e.target.closest('.color-option');
      if (!opt || !contextTarget) return;
      e.stopPropagation();
      const color = opt.dataset.nodeColor;
      colorNode(contextTarget.block, contextTarget.path, color === 'none' ? null : color);
      $('#colorSubmenu').style.display = 'none';
    });

    // 初始空状态
    updateEmptyState();
    } catch (err) {
      console.error('DocManager init error:', err);
      const container = document.getElementById('blocksContainer');
      if (container) {
        container.innerHTML = '<div style="padding:40px;color:red;font-size:14px;">⚠️ 初始化失败: ' + err.message + '</div>';
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
