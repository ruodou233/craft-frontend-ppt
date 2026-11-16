# 翻页底座 `talk-stage.js`

搭骨架、查接口、迁移旧稿时读。底座只管翻页、缩放、深链接、打印、备注和演讲者窗，自己不做任何动画，观众屏上也不画任何控件（页码和章节条交给 `route.js`）。

## 骨架

```html
<head>
  <script src="runtime/talk-stage.js"></script>        <!-- 同步加载，在 <talk-stage> 之前 -->
  <style>
    talk-stage{background:#0c0b08}                     /* 留黑边的颜色 */
    talk-stage > section{width:1920px;height:1080px;position:relative;overflow:hidden}
  </style>
</head>
<body>
  <talk-stage width="1920" height="1080" duration="30">
    <section data-label="封面">…</section>
    <section data-label="备用页" data-deck-skip>…</section>
  </talk-stage>
  <script type="application/json" id="speaker-notes">["封面的备注", "备用页的备注"]</script>
  <script src="runtime/fx-core.js"></script>
  <script src="runtime/deck-tools.js"></script>
  <script src="fx/S14-盖章.js"></script>
</body>
```

- 页 = `<talk-stage>` 的直接子元素 `section`（不带 `slot` 属性）。带 `slot` 的 section 不显示、不计页，可以当隐形锚点。
- `duration` 是演讲预算（分钟），演讲者窗和 `T` 计时胶囊超时变红。
- 整个文件夹双击就能打开，也能放到任意静态服务器；不需要构建。

## 观众和讲者看到的

| 操作 | 行为 |
|---|---|
| → / PageDown / 空格 | 下一步（页内有 `data-beat` 先逐拍点亮），跳过 `data-deck-skip` 页 |
| ← / PageUp | 上一步 |
| Home / End | 第一张 / 最后一张非跳过页 |
| 触摸左滑 / 右滑 | 同 → / ← |
| P | 打开演讲者窗：当前页、下一页、备注、总用时、本页用时、每页用时表（可导出 CSV） |
| F | 全屏 |
| Esc / T（deck-tools） | 页面总览 / 排练计时胶囊 |
| `#N` | 深链接到第 N 页（从 1 起），翻页时地址栏同步，不产生历史记录 |
| 打印 → 存 PDF | 一页一张纸，跳过页不打印，节拍全亮，特效落到终态 |

↑↓、Enter、鼠标单击、滚轮都不翻页：单击要留给页内交互。

## JS 接口

```js
const stage = document.querySelector('talk-stage');
stage.goTo(5);            // 跳到第 6 页（从 0 起；可以跳到跳过页）。同步完成，返回最终序号
stage.next(); stage.prev();
stage.index; stage.total; stage.slides;     // _slides 是兼容别名
stage.notes = ['…'];      // 改写备注，演讲者窗立刻更新；_notes 是兼容别名
stage.openPresenter();    // 需要在用户手势里调用

stage.addEventListener('slidechange', (e) => {
  const { slide, previousSlide, index, previousIndex, total, reason } = e.detail;
  // reason: init | api | keyboard | touch | hash | mutation | remote
});
document.addEventListener('talkgeometrychange', (e) => { /* e.detail: scale, offsetX, offsetY, width, height */ });
```

- 当前页带 `data-deck-active` 属性（每次切页都在旧页移除、新页重新加上，所以 `section[data-deck-active] .x{animation:…}` 每次进页都会重播）。
- `slidechange` 在属性和地址栏更新之后同步派发；冷开带 `#N` 时第一个事件就是那一页。回调里再 `goTo` 会排在当前派发之后。
- 缩放用 transform 作用在页的外层：`section.getBoundingClientRect()` 就是屏幕上的真实矩形。给 `<talk-stage>` 写 `--fx-bass-scale` 变量可以叠加一个乘数（低音呼吸用）。
- 底座在 DOMContentLoaded 时才定页数和读深链接，所以 `route.js` 这类在解析期删页的脚本不会把 `#40` 截短。

## 演讲者窗

按 P 开一个同源空白小窗，由观众窗写入界面，两边用 `BroadcastChannel` 通信。演讲者窗不重新加载演讲页，所以音乐、摄像头、特效只在观众窗跑一份；预览是去掉脚本和媒体的静态快照，特效画的内容不在预览里。

- 在演讲者窗里按翻页键（翻页笔）同样能翻页，节拍照常生效。
- 打开演讲者窗后第一次真实翻页自动开始计时，也可以手动开始、暂停、重置。计时记录在观众窗里：演讲者窗关掉重开不丢，观众窗刷新清零。
- 观众窗刷新时演讲者窗显示「观众窗已断开」，加载完自动重连。
- 弹窗被拦截时观众屏右下角提示 3 秒。
- 已在 Chrome 实测 `file://` 和 `http://`；Safari、Firefox 未测。

## 从 Claude Design 导出的旧稿迁移

接口名沿用了 Claude Design 演讲组件的约定，旧特效和旧页面 CSS 基本不用改。只改这几处：

| 改什么 | 旧 | 新 |
|---|---|---|
| 脚本 | `<script src="deck-stage.js">` | `<script src="talk-stage.js">` |
| 元素名 | `<deck-stage …>` | `<talk-stage …>` |
| 选择器和 CSS | `querySelector('deck-stage')`、`deck-stage > section` | `talk-stage`、`talk-stage > section` |
| 几何事件 | `deckgeometrychange` | `talkgeometrychange` |
| 演示模式脚本 | 向宿主发 `postMessage` 的那一行 | 删掉（新底座没有宿主协议） |

保留不变：`slidechange`、`detail.slide`、`detail.previousSlide`、`data-deck-active`、`data-deck-skip`、`goTo()`、`_slides`、`_notes`、`#speaker-notes`、`--fx-bass-scale`、`#N` 深链接。缩略图栏、右键菜单、拖拽排序这类编辑器功能不提供；总览用 `deck-tools.js` 的 Esc。

## 自测

`runtime/test/stage-test.html` 是一张 8 页测试稿，`runtime/test/stage-test-2.cjs` 跑规格里的 62 项检查（翻页、跳过页、深链接、事件时序、缩放、触摸、减少动效、打印、备注、演讲者窗）。需要一份 Playwright 和本机 Chrome：

```bash
NODE_PATH=/path/to/node_modules node runtime/test/stage-test-2.cjs both   # file:// 和 http:// 各跑一遍
```
