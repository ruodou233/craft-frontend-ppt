# 特效契约（fx-core）

写或改 `fx/*.js` 前读这一份。它从四次真实交付里沉淀出来：演讲当天在一台 Chrome 上稳定跑完全程，比代码漂亮重要得多。所以特效按「一次性演出代码」写：不要构建步骤、不要 npm、不要类继承、不要配置文件，一个特效一个文件，能跑、不冲突、翻页正确启停就算完成。

## 一个文件只做一件事：`FX.register`

```js
FX.register({
  name: 'S14-stamp',
  match: (label) => label === 'PART 01',   // 按页名认页；全局特效写 'global'
  mount(slide, api) {},      // 第一次进这页时调用一次：建 DOM、建 canvas
  activate(slide, api) {},   // 每次翻到这页
  deactivate(slide, api) {}, // 每次翻走：停掉自己的一切活动
  finalize(slide, api) {},   // 可选：直接落到最终画面（减少动效、打印、快进都用它）
  tick(dt, api) {},          // 只在本页激活期间每帧调用；全局特效一直调用
});
```

脚本放在讲稿末尾、`fx-core.js` 之后，按页数顺序引入就行。`match` 拿的是 `data-label`，所以页名就是特效的接口（见 `handoff-rules.md`）。

`api` 里已经有的东西，特效不要自己再搞一份——多一个监听就多一个翻页时忘了拆的地方：

| 字段 | 用途 |
|---|---|
| `api.canvas(slide, 'under'\|'over'\|'top', {dprAware})` | 建好尺寸的 1920×1080 画布；`slide` 传 `null` 得到全屏画布 |
| `api.mouse` | 平滑后的 0–1 鼠标坐标，外加 `stageX/stageY`、`inside` |
| `api.toStagePoint(clientX, clientY)` | 把屏幕坐标换回舞台坐标（留黑边、缩放都算好了） |
| `api.audio` | `{ level, bass, health }`，0–1 的背景音乐实时能量，见 `soundtrack.md` |
| `api.quality` | 1 或 0.5；掉帧时自动降，粒子数乘它 |
| `api.motion` | `{ mode, reduced, low }` |
| `api.seeded(name)` | 可复现的随机数，同一页每次进来画面一样 |
| `api.requestFinal()` | 让当前页所有特效立刻落到终态 |
| `api.slide` / `api.stage` / `api.generation` | 当前页、舞台元素、切页代次（异步回调里用它判断是否已翻走） |

## 五条铁律

1. **不加全局监听。** 不自己 `addEventListener` 鼠标、键盘、resize；不开第二个 `requestAnimationFrame`，逐帧逻辑都写进 `tick`。页内点击类交互可以加，但 `deactivate` 里必须移除。理由：翻页键被多个脚本抢，节拍和拦截都会乱；多余的 rAF 翻走后还在烧 CPU。
2. **翻页正确启停。** `deactivate` 之后零开销：没有定时器、没有动画、画布清空。翻进翻出 10 次不累积 DOM、不越跑越快。异步回调（图片加载、`setTimeout`）回来时先确认 `slide.hasAttribute('data-deck-active')` 或 `api.generation` 没变。
3. **删掉脚本，页面仍然完整。** HTML 里写的就是最终内容：数字写终值、标题写全文、图写进 `<img>`。特效只负责「怎么出现」，不负责「有没有」。这样脚本出错、被删、在别的电脑上跑不动时，这一页照样能讲。
4. **减少动效时有静态终态。** 系统开了减少动效（或排练时 `FX.setMotion('reduced')`），fx-core 不再调 `activate`/`tick`，改调 `finalize`，节拍全部直接可见。所以有意义的终态画面要写进 `finalize`；只是氛围的特效可以什么都不画。打印时 fx-core 也会对每页调 `finalize`。
5. **不动别人的东西。** 不改别的文件、别的特效的 DOM、全局 CSS 变量；不往 `section` 的 inline `transform` 里写（缩放归底座）；要位移页内元素用 `style.translate`。层级只用 `api.canvas` 给的三层：under=0、内容=auto、over=30、top=60。

## 页内节拍 `data-beat`

给页内元素加 `data-beat="1"`、`data-beat="2"`……，按 → 会先逐个点亮（加 `.beat-on`），全亮了才翻页；按 ← 先逐个熄灭。特效想跟节拍联动，就在 `tick` 里看目标元素有没有 `.beat-on`（`S21`、`S5` 都这么做）。

节拍在 `window` 捕获阶段处理，所以要拦截翻页键的特效（例如「视频没放完先别翻」）也要挂在捕获阶段，并先确认本页仍是当前页。

## 一页一个主角

每页只许一个主角特效，其余是安静的辅助。全局特效（视差、拆字、音浪、低音呼吸）是所有页的底色，要克制：低音呼吸只给舞台写 `--fx-bass-scale` 这个乘数，幅度 1.000→1.006 就够。canvas 主角上场的页，把 CSS 氛围粒子调到半密度。

## 自查清单（每个特效交付前）

- 控制台零报错；翻进翻出 10 次正确启停、无累积。
- 翻走后 Performance 面板里看不到它的帧活动。
- 打开减少动效再进这页：画面完整、可读。
- 打印预览里这一页是终态。
- 删掉这个脚本：页面依然完整。
- 颜色只用讲稿已有的变量；不遮挡正文，不挡翻页。

## 这份仓库里的范例

`examples/demo/fx/` 里的四个文件都来自真实演讲，只改了页名：

- `G8-拆字.js`：全局逐字入场，不开 rAF、不设定时器，纯 CSS transition；离开时把原 DOM 原样恢复，再进来能重播。
- `S14-盖章.js`：章节页印章砸落 + 墨屑，全部在 `tick` 里算，`finalize` 给出盖好的终态。
- `S21-概率打字机.js`：按节拍启动的状态机，`deactivate` 清掉注入的整张卡片。
- `S5-数字滚动.js`：HTML 写终值，节拍点亮后在 `tick` 里从 0 滚上去；翻走、打印、减少动效都落回终值。
