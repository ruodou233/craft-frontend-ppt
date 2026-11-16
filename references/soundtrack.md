# 配乐

需要背景音乐时读。音乐不是装饰：它决定观众进入每段内容时的情绪底色，也给特效提供一路实时信号。

## 先写 cue sheet

读完讲稿，按主张、情绪、能量发生实质变化的位置分段，为每段记一行：

| 字段 | 例 |
|---|---|
| 起点页名 | `PART 01`（音乐从这页起换） |
| 对应内容 | 讲稿哪一段、大约讲几分钟 |
| 情绪与能量 | 克制的好奇 → 逐渐笃定 |
| 速度、配器、质感 | 80 BPM，钢琴 + 低频铺底，干净 |
| 留白 | 讲者说话时让出中频 |
| 和画面的关系 | 这段的主角特效需不需要跟低音动 |

用同一套声音母体保持全程连贯，按实际段落决定曲目数量，不用一首曲子无差别铺满全程。默认纯音乐，不要歌词、人声和哼唱：它们会和讲者抢耳朵。

## 拿到音乐

优先用已有授权的音频；需要生成时用有授权的音乐生成服务，提示词写明 `instrumental only` 和要排除的人声，记下来源、提示词、版本和使用权限。每首最终采用的曲子要从头到尾完整听一遍，再存进包里（`assets/audio/`）用相对路径引用。提示词、占位声、程序合成的嗡鸣都不算配乐完成；做不出来就照实说没完成。

## 接进页面

曲目写成带 id 前缀 `bgm-track` 的 `<audio>`，fx-core 会把它们全部接进同一个分析器：

```html
<audio id="bgm-track-1" src="assets/audio/01-open.mp3" loop preload="auto"></audio>
<audio id="bgm-track-2" src="assets/audio/02-stage.mp3" loop preload="none"></audio>
```

切曲按页名锚点算，不按序号（调页序不用改音乐）：

```js
const CUES = [ { from: '封面', track: 'bgm-track-1' }, { from: 'PART 01', track: 'bgm-track-2' } ];
const stage = document.querySelector('talk-stage');
function trackFor(slide) {
  const labels = [...stage.querySelectorAll(':scope > section')].map((s) => s.dataset.label);
  const at = labels.indexOf(slide.dataset.label);
  let pick = CUES[0].track;
  CUES.forEach((c) => { const i = labels.indexOf(c.from); if (i >= 0 && i <= at) pick = c.track; });
  return pick;
}
stage.addEventListener('slidechange', (e) => { /* 淡出旧曲、淡入 trackFor(e.detail.slide) */ });
```

- `slidechange` 的第一次派发就是冷开那一页（深链接 `#N` 也一样），按它选曲，不会先播错第 1 页的曲子。
- 浏览器要真实手势后才能出声：第一次点击或按键时再 `play()`。给一个 `M` 键和一个角落按钮做静音／恢复。
- 视频页（`data-fx-focus="video"`）进页时把 BGM 压到 0，翻走恢复。
- 打印前（`beforeprint`）暂停全部音乐。
- 想让演讲者窗打开时不重复出声，什么都不用做：演讲者窗是静态快照，不会再跑一份音乐。

## 让特效跟着音乐动

`api.audio.level`（整体响度）和 `api.audio.bass`（低频）都是 0–1，在 `tick` 里直接读。幅度宁小勿大，例如低音超过 0.7 才让舞台呼吸 0.6%；音乐静音时自然归零，特效不用另外判断。

`api.audio.health` 说明分析器状态：`ready` 正常；`native-file-fallback` 表示是 `file://` 打开——音乐照常播放，但浏览器不给分析数据，音浪和低音联动保持静止；用本地静态服务器（`python3 -m http.server`）打开即可恢复。`no-tracks` 是页面里没有 `bgm-track*`。

## 验证

逐首完整试听并记录；集成后从每个切曲边界页冷开，确认曲目正确；前进、后退都切对；静音、恢复、视频页压低都正常；在实际播放设备上听一遍音量，讲者声音要压得住音乐。
