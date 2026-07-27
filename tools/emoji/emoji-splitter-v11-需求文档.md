# 表情包拆解工具 V11 需求文档

> 基线：`emoji-splitter-v10.html`（内部标题仍为 V9，本次一并修正为 V11）
> 产出目标：在 v10 基础上完成下列 6 项需求，落地为 `emoji-splitter-v11.html`
> 文档含：现状分析 / 需求细化 / 修改思路（含关键代码片段）/ 测试思路

---

## 0. 现状速览（v10 实际有什么）

| 模块 | 现状 | 关键代码位置 |
|---|---|---|
| 初始化拆分 | `initSplit()` 清空后调 `processImage()`，默认勾选去白边/去白线/清斑点 | `initSplit` L1894、控件 L449-482 |
| 清理斑点 | `despeckleCanvas` **仅调用 1 次**，内部无循环 | `processCell` L2101-2104、`despeckleCanvas` L2038 |
| 去白边/白线 | 内部已有 passes 迭代（`edgeWidth`/`lineWidth` 次） | `cleanWhiteEdges` L1962、`cleanWhiteLines` L2002 |
| 智能避让主体 | `smartAvoid` 默认勾选，含密度分析与安全分割线 | 控件 L423、`analyzeContentSafeLines` L1214、`processImageFrom` L1102 |
| 预览视口 | `initViewport` 只设尺寸，**未叠加网格定位框** | `initViewport` L1138、`drawPreview` |
| 文字拖拽 | **已实现**：点击文字区域进入文字拖拽，存 `textPosX/Y` | `setupPreviewDrag` L3431、`textBounds` L3340 |
| 文字缩放/旋转 | 字段已存 `textScale/textRotation`，但 **`getEffectiveStyles` 漏读 → 不生效** | `createDefaultCustom` L980、`getEffectiveStyles` L3411 |
| 第二行文字 | 不支持，`emoji` 仅一个 `text` 字段 | L1930 |
| 文字样式 | 仅字号/字重/描边/阴影/圆角背景条，**无气泡/贴纸** | styleCard L495-513 |
| 提示窗口 | 不存在 | — |
| 常用链接 | 不存在 | — |

> ⚠️ 重点：第 3 项里"文字不能拖动/缩放旋转不灵活"并非全无代码，而是**部分已实现、部分未接通**。实施前先用 Chrome headless 实测确认真实表现（见第 5 节测试思路），避免重复造轮子。

---

## 1. 需求一：初始化拆分时，去白边 / 清斑点默认各重复 2 次

### 1.1 需求细化
- 点「初始化拆分」时，**去白边、去白线、清斑点**三项各自**整体重复执行 2 次**（默认值），清理更干净。
- 这是**默认行为**，用户无需进入编辑面板手动点；同时保留一个可调次数的入口（默认 2，可改 1~5），供进阶用户调整。
- 勾选状态保持现状（默认勾选），只是执行次数从 1 → 2。

### 1.2 修改思路
1. `state.despeckle` 增加 `passes` 字段，默认 2：
```js
despeckle: {enabled:true, size:10, passes:2},   // 新增 passes
```
2. `processCell` 中把单次调用改为 `passes` 次循环（白边/白线同理加外层 repeat，与内部 passes 区分语义）：
```js
// 去白边：外层整体重复 repeat 次（内部已有边缘迭代）
if(state.cleanWhiteEdge && finalCanvas.width>2 && finalCanvas.height>2){
  const repeat = state.cleanEdgeRepeat || 2;
  for(let r=0; r<repeat; r++){
    cleanWhiteEdges(finalCanvas, state.cleanEdgeColor||'#ffffff', state.cleanEdgeWidth||3);
  }
}
if(state.cleanWhiteLine && finalCanvas.width>2 && finalCanvas.height>2){
  const repeat = state.cleanLineRepeat || 2;
  for(let r=0; r<repeat; r++){
    cleanWhiteLines(finalCanvas, state.cleanLineColor||'#ffffff', state.cleanLineWidth||3);
  }
}
// 清斑点：内部无循环，外层 passes 次
if(state.despeckle && state.despeckle.enabled && finalCanvas.width>2 && finalCanvas.height>2){
  const passes = state.despeckle.passes || 2;
  for(let p=0; p<passes; p++){
    despeckleCanvas(finalCanvas, state.despeckle.size);
  }
}
```
3. `initSplit()` 无需改动——它走 `processImage()` → `processCell()`，自动生效。这正是"默认不用点编辑"的落点。
4. 控件区（L473-482 附近）可选加一个"清理次数"小输入，默认 2：
```html
<div class="form-row" style="margin-left:20px">
  <label style="min-width:36px">重复</label>
  <input type="range" id="v10DespecklePasses" value="2" min="1" max="5" style="height:4px">
  <span class="value-tag" id="v10DespecklePassesVal">2</span>
</div>
```

### 1.3 风险
- 重复 2 次会让小尺寸表情的边缘多削一点像素。需测试：主体细节（如细线条表情）是否被误伤。若误伤，把默认调回"白边 1 次 + 斑点 2 次"（斑点最安全，白边最易误伤）。

---

## 2. 需求二：预览视口叠加"定位框"

### 2.1 需求细化
- 在第 2 步预览窗口（拆分前对齐网格的视口）上，叠加**正方形网格边框**，直观提示"每个格子会被裁成什么样"。
- 拖拽底图移动 / 滚轮缩放时，定位框**实时跟随**，方便对齐。
- 框线半透明、不遮挡内容；鼠标悬停某格可高亮该格（可选增强）。

### 2.2 修改思路
- `getViewportGridCells` 已能算出每个 cell 的 `{cx,cy,cw,ch}`，直接在 `drawPreview()` 末尾把这些 cell 描边即可。
- 不新增 DOM，直接在预览 canvas 上 `strokeRect`，性能最好、跟随天然实时：
```js
function drawPreview(){
  // ...既有绘制底图逻辑...

  // 叠加网格定位框
  const cells = state.smartAvoid
    ? getViewportGridCells(vw, vh, state.rows, state.cols, state.padding)  // 删 smartAvoid 后此分支移除
    : getViewportGridCells(vw, vh, state.rows, state.cols, state.padding);
  ctx.save();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(0,120,212,0.55)';
  ctx.setLineDash([6,4]);
  cells.forEach(c=>{
    ctx.strokeRect(c.cx, c.cy, c.cw, c.ch);
  });
  // 格子序号（可选）
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(0,120,212,0.7)';
  ctx.font = '10px sans-serif';
  cells.forEach((c,i)=>{
    ctx.fillText(String(i+1), c.cx+3, c.cy+11);
  });
  ctx.restore();
}
```
- 顶部 `zoom-hint` 文案补一句："蓝框为裁剪定位框"。

### 2.3 注意
- 若 `drawPreview` 里已有网格绘制（部分版本有），则属于**增强/修正样式**而非新增；先实测确认（见测试节）。
- 现有 emoji 卡片预览的"裁剪框"（L614 提到的拖动角点）是另一套，不冲突，本次不动。

---

## 3. 需求三：文字功能专业化

这是本次最重的一项，拆 4 个子需求。

### 3.1 修复文字缩放 / 旋转不生效（先修 bug）
- `getEffectiveStyles`（L3411）补读 `textScale/textRotation`：
```js
function getEffectiveStyles(emoji,scaleRatio){
  const s={...state.styles};
  s.fontSize=Math.round(state.styles.fontSize*scaleRatio);
  const c2=emoji.custom;
  if(c2.textEnabled){
    if(c2.textPosition)s.position=c2.textPosition;
    if(c2.fontSize&&c2.fontSize>0)s.fontSize=Math.round(c2.fontSize*scaleRatio);
    if(c2.textColor)s.textColor=c2.textColor;
    if(c2.strokeColor)s.strokeColor=c2.strokeColor;
    if(c2.strokeWidth!=null)s.strokeWidth=c2.strokeWidth;
  }
  if(c2.textPosX!=null)s.textDragX=c2.textPosX;
  if(c2.textPosY!=null)s.textDragY=c2.textPosY;
  // ↓ 新增：缩放与旋转
  s.textScale = c2.textScale!=null ? c2.textScale : 1;
  s.textRotation = c2.textRotation!=null ? c2.textRotation : 0;
  return s;
}
```
- `drawTextOnCanvas` 里绘制文字前 `ctx.save()` → `translate` 到文字中心 → `rotate` → `scale` → 绘制 → `ctx.restore()`。同时 `textBounds` 命中框要按旋转后的 AABB 重新算（否则点不中）。

### 3.2 第二个文字输入框
- `emoji` 数据结构加 `text2`，`custom` 加对应的 `text2PosX/PosY/Scale/Rotation/enabled`：
```js
function createDefaultCustom(){
  return {
    // ...既有字段...
    textScale:1, textRotation:0,
    // 第二文字
    text2:'', text2Enabled:false, text2PosX:0, text2PosY:0,
    text2Scale:1, text2Rotation:0,
  };
}
```
- 文字编辑面板（L2204 附近）在第一个输入框下方加第二个：
```html
<input type="text" value="${escapeHtml(emoji.text)}" placeholder="文字1..." oninput="updateEmojiText(${i},this.value)">
<input type="text" value="${escapeHtml(emoji.text2||'')}" placeholder="文字2（可独立摆放）..." oninput="updateEmojiText2(${i},this.value)">
```
- 渲染时 `drawTextOnCanvas` 调用两次，各自用独立的 position/scale/rotation/scale。
- 拖拽命中：`textBounds` 改为数组 `[bounds1, bounds2]`，`setupPreviewDrag` 按从上到下优先级判断点中哪一个。

### 3.3 文字样式：气泡 / 边框 / 贴纸效果（"文字贴"）
新增 `textStyleType` 枚举，提供成熟预设，默认指定一种：
```js
state.styles.textStyleType = 'stroke'; // 默认描边
// 可选值：plain | stroke | shadow | bubble | ribbon | sticker
```
每种类型一个绘制函数，统一接口 `drawTextStyled(ctx, text, x, y, styles)`：
```js
const TEXT_STYLES = {
  plain:   (ctx,t,x,y,s)=>{ ctx.fillStyle=s.textColor; ctx.fillText(t,x,y); },
  stroke:  (ctx,t,x,y,s)=>{ ctx.lineJoin='round'; ctx.lineWidth=s.strokeWidth;
                            ctx.strokeStyle=s.strokeColor; ctx.strokeText(t,x,y);
                            ctx.fillStyle=s.textColor; ctx.fillText(t,x,y); },
  shadow:  (ctx,t,x,y,s)=>{ ctx.shadowColor=s.shadowColor; ctx.shadowBlur=s.shadowBlur;
                            ctx.fillStyle=s.textColor; ctx.fillText(t,x,y); ctx.shadowBlur=0; },
  bubble:  (ctx,t,x,y,s)=>{ /* 测宽 → 圆角气泡底 → 居中文字，尾巴朝下 */ },
  ribbon:  (ctx,t,x,y,s)=>{ /* 丝带横条 + 两端折角 */ },
  sticker: (ctx,t,x,y,s)=>{ /* 白底圆角 + 描边文字 + 轻投影，类贴纸 */ },
};
```
- styleCard 增加样式选择器（图标按钮组）：
```html
<div class="form-row">
  <label>文字样式</label>
  <div class="btn-group" style="flex:1;flex-wrap:wrap">
    <span class="seg-btn" data-tst="plain">纯色</span>
    <span class="seg-btn active" data-tst="stroke">描边</span>
    <span class="seg-btn" data-tst="shadow">阴影</span>
    <span class="seg-btn" data-tst="bubble">气泡</span>
    <span class="seg-btn" data-tst="ribbon">丝带</span>
    <span class="seg-btn" data-tst="sticker">贴纸</span>
  </div>
</div>
```
- 每种样式暴露其专属参数（气泡=尾尖方向、贴纸=底色+圆角），非该样式时相关参数折叠隐藏。
- 默认 `stroke`（最通用）；用户指定后存全局，单表情可覆盖。

### 3.4 文字拖拽体验确认与增强
- 实测确认现有拖拽是否真生效（memory 提醒：别只看代码）。
- 优化点：① 旋转后 `textBounds` 用旋转 AABB 重算；② 拖拽时显示半透明虚线框指示当前文字框；③ 提供"复位文字位置"按钮（已有 `resetTextPos` L2475，确认可用）。

---

## 4. 需求四：提示窗口（含义词典 + AI 提示词生成）

### 4.1 需求细化
- 页面**右上角**常驻一个「💡 提示」浮动按钮，点击打开弹窗。
- 弹窗两个 Tab：
  - **Tab A 含义词典**：左侧竖排分类列表（日常 / 心情 / 旅游 / 创业 / 节假日 / 休闲 / 搞怪 / 无厘头 / 吐槽 / 打工 / 上班 / 修仙 / 提升 / 锻炼 / 游戏健身 / 运动 …）；右侧点击某分类后，该分类下含义词以**小方框**均匀排布，**点一个即复制**到剪贴板。常用词（早安 / 晚安）**置顶常驻**，其余可随机洗牌。
  - **Tab B AI 提示词生成**：按模板随机生成一条可直接喂给 AI 的提示词，点一下生成一条，可复制。模板示例：「生成一张 5×5 表情包网格图，共 25 格，白底，Q 版简笔风格；每格一个独立表情，表情：<随机表情>，动作：<随机动作>，情绪：<随机情绪>；要求每格独立可裁切、留白均匀。」
- 词典数据用户后续会持续补充，用独立 JS 对象/独立 json 便于扩展。

### 4.2 修改思路
- 新增弹窗 HTML（fixed 定位，默认隐藏）：
```html
<button class="hint-fab" onclick="openHintPanel()">💡</button>

<div class="hint-modal" id="hintModal" style="display:none">
  <div class="hint-modal-head">
    <span class="hint-tab active" data-tab="dict">📖 含义词典</span>
    <span class="hint-tab" data-tab="prompt">✨ AI 提示词</span>
    <span class="hint-close" onclick="closeHintPanel()">✕</span>
  </div>

  <!-- Tab A -->
  <div class="hint-pane" id="hintDictPane">
    <div class="hint-cats" id="hintCats"></div>          <!-- 左侧分类 -->
    <div class="hint-words" id="hintWords"></div>         <!-- 右侧词方框 -->
  </div>

  <!-- Tab B -->
  <div class="hint-pane" id="hintPromptPane" style="display:none">
    <textarea id="hintPromptOut" readonly></textarea>
    <button class="btn btn-primary" onclick="genAIPrompt()">🎲 随机生成</button>
    <button class="btn btn-outline" onclick="copyPrompt()">📋 复制</button>
  </div>

  <!-- 常用链接入口（需求五） -->
  <div class="hint-links">
    <a href="https://www.doubao.com" target="_blank">豆包官方</a>
    <a href="https://claude.ai" target="_blank">Claude</a>
    <!-- 用户后续补充 -->
  </div>
</div>
```
- 词典数据结构（独立常量，便于扩展）：
```js
const HINT_DICT = {
  '日常':   ['早安','晚安','吃饭了吗','摸鱼中', /*...*/],
  '心情':   ['开心','emo了','破防','躺平', /*...*/],
  '打工':   ['打工人','周一综合症','下班啦','卷不动了'],
  '修仙':   ['筑基','渡劫','飞升','闭关'],
  // ...用户持续补充
};
const HINT_PIN = ['早安','晚安']; // 置顶常驻
```
- 点击词复制：
```js
function renderHintWords(cat){
  const words = [...HINT_PIN, ...(HINT_DICT[cat]||[])];
  $('hintWords').innerHTML = words.map(w=>
    `<span class="hint-chip" onclick="copyText('${w}')">${w}</span>`
  ).join('');
}
function copyText(t){
  navigator.clipboard.writeText(t).then(()=>showToast('已复制：'+t));
}
```
- AI 提示词随机生成：
```js
const PROMPT_POOL = {
  emoji:  ['微笑','大笑','哭泣','生气','惊讶','发呆','奸笑','委屈'],
  action: ['举手','拍桌','捂脸','叉腰','摊手','比心','鼓掌','打哈欠'],
  mood:   ['开心','无奈','兴奋','崩溃','惬意','斗志昂扬'],
  style:  ['Q版简笔','手绘水彩','像素风','扁平卡通风'],
};
function genAIPrompt(){
  const pick = a=>a[Math.floor(Math.random()*a.length)];
  const n = 5; // 默认 5×5
  const p = `生成一张 ${n}×${n} 表情包网格图，共 ${n*n} 格，白底，${pick(PROMPT_POOL.style)}风格；`
          + `每格一个独立表情，表情：${pick(PROMPT_POOL.emoji)}，动作：${pick(PROMPT_POOL.action)}，`
          + `情绪：${pick(PROMPT_POOL.mood)}；要求每格独立可裁切、留白均匀、对齐网格。`;
  $('hintPromptOut').value = p;
}
```
- 样式：分类竖排、词方框 `flex-wrap` 均匀排布、点击有反馈态。

### 4.3 注意
- `Math.random()` 在普通页面可用（非 workflow 脚本环境），无限制。
- 词典量大后考虑懒加载/搜索框，一期先全量渲染。

---

## 5. 需求五：常用链接入口

### 5.1 需求细化
- 提示窗口内固定区域放常用链接（豆包官方等），点击新标签打开。
- 链接列表做成数组常量，便于后续增删。

### 5.2 修改思路
```js
const HINT_LINKS = [
  {name:'豆包官方', url:'https://www.doubao.com'},
  {name:'Claude',  url:'https://claude.ai'},
  {name:'即梦',    url:'https://jimeng.jianying.com'},
  // 用户补充
];
function renderHintLinks(){
  $('hintLinks').innerHTML = HINT_LINKS.map(l=>
    `<a href="${l.url}" target="_blank" rel="noopener">${l.name}</a>`
  ).join('');
}
```
- 链接区放在弹窗底部，两个 Tab 共享。

---

## 6. 需求六：删除"避让主角"（smartAvoid）

### 6.1 需求细化
- 移除"🧠 智能避让主体"复选框及其全部相关逻辑，网格分割统一走均匀 `getViewportGridCells`。

### 6.2 修改思路（删除清单）
- 控件：删 L423-426 的 `smartAvoid` checkbox。
- state：删 `smartAvoid: true`（L926）。
- 监听：删 L1173 的 `smartAvoid` change 监听。
- 拆分分支：`processImageFrom` L1102-1107 简化为直接 `getViewportGridCells(...)`。
- 函数：删 `analyzeContentSafeLines`（L1214+）、`getSmartAdjustedCells` 及相关绘制。
- `drawPreview` 里若引用 `state.smartAvoid`，删对应分支。

> 注：本项是用户明确要删的功能（非"修重复"场景），可安全删除底层实现；与 memory「dedupe ≠ delete」不冲突。

---

## 7. 测试思路（Chrome headless 实测）

> 遵循既有反馈：用户报 bug / 验收时，**用 Chrome headless 读真实 DOM 与 canvas 像素**，不只靠代码审查。

### 7.1 通用测试脚本骨架
```bash
# 用 puppeteer / playwright headless 打开 v11，注入操作，读 DOM & 截图
node tests/emoji-v11.test.js
```
```js
// tests/emoji-v11.test.js（puppeteer 示意）
const puppeteer = require('puppeteer');
(async()=>{
  const browser = await puppeteer.launch({headless:'new', args:['--no-sandbox']});
  const page = await browser.newPage();
  await page.goto('file:///D:/workspace-AiGithub/LeeCommonWxMDFormatHtml/tools/emoji/emoji-splitter-v11.html');

  // 上传一张测试网格图
  const input = await page.$('#fileInput');
  await input.uploadFile('tests/fixtures/grid-3x3.png');
  await page.waitForSelector('#cutoutCard:not([style*="none"])');

  // ...各用例...
  await browser.close();
})();
```

### 7.2 用例清单
| # | 用例 | 验证手段 | 预期 |
|---|---|---|---|
| T1 | 初始化拆分后斑点清理 2 次 | 在 `processCell` 注入计数器（`window.__despeckleCalls`），读值 | 每格调用 2 次 |
| T2 | 初始化拆分后白边清理 2 次 | 同上计数 `cleanWhiteEdges` | 每格调用 2 次 |
| T3 | 预览视口定位框可见 | 截图预览 canvas，像素分析蓝色虚线 | 存在蓝色框线 |
| T4 | 拖拽底图时定位框跟随 | `page.mouse` 拖拽后截图 | 框线随图移动 |
| T5 | 文字缩放生效 | 设 `textScale=1.5`，导出 canvas 量文字像素高度 | 比 scale=1 高 ~1.5 倍 |
| T6 | 文字旋转生效 | 设 `textRotation=45`，截图 | 文字倾斜 |
| T7 | 文字可拖拽 | `page.mouse` 在文字 bounds 内按下拖动，读 `textPosX/Y` | 数值变化、预览跟随 |
| T8 | 第二文字独立摆放 | 输入 text2，拖到不同位置，导出 | 两行文字位置不同 |
| T9 | 气泡样式渲染 | 选 `bubble`，导出截图 | 出现气泡底 + 尾巴 |
| T10 | 提示窗口打开/切 Tab/复制词 | 点击 FAB → 切 Tab → 点词，读剪贴板 | 剪贴板含该词 |
| T11 | AI 提示词生成 | 点随机生成，读 textarea | 非空、含 5×5 等关键词 |
| T12 | 常用链接 | 点豆包链接，拦截 `target=_blank` | URL 正确 |
| T13 | smartAvoid 已移除 | `page.$('#smartAvoid')` | null；拆分仍正常 |
| T14 | 默认次数可调 | 把次数改 1，重拆，计数 | 每格调用 1 次 |

### 7.3 回归
- 跑一遍既有流程（上传 → 网格 → 拆分 → 文字 → 导出），确认删除 smartAvoid、加重复次数后，原有表情卡片、橡皮擦、横幅编辑器、聊天场景报告均正常。

---

## 8. 实施顺序建议

1. **需求六（删 smartAvoid）**——先清理，减少后续干扰。
2. **需求一（清理 2 次）**——改动小、独立，先落。
3. **需求二（定位框）**——纯绘制增强。
4. **需求三.1（修缩放/旋转）**——先修 bug，再扩功能。
5. **需求三.2 / 3.3（第二文字 / 样式预设）**——文字主功能。
6. **需求四 + 五（提示窗口 + 链接）**——独立模块，最后加。
7. 每步完成后跑对应测试用例。

---

## 9. 待确认事项

1. **清理默认 2 次**：白边是否也 2 次？还是只斑点 2 次、白边保持 1 次（白边重复易误伤主体细节）？建议默认：白边 1 + 白线 1 + 斑点 2，可调。
2. **第二文字**：是否需要独立的样式（颜色/字号），还是复用第一文字样式仅位置独立？建议一期复用样式、仅位置/缩放/旋转独立。
3. **文字样式默认值**：全局默认用 `stroke`（描边）还是 `bubble`（气泡）？建议 `stroke`。
4. **提示词典初始数据**：用户会持续补充，一期是否先放占位分类 + 少量样例，等用户给完整词表再灌入？
5. **AI 提示词模板**：5×5 是否固定？是否要支持用户选 3×3 / 4×4 / 6×6？建议做成可选。
6. **版本落地**：直接改 v10，还是新建 v11？（文档假设新建 v11）
