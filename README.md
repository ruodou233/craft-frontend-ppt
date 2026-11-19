# 网页演讲｜Web Talks in the Browser

Turn a script into a talk you give from the browser: one slide at a time, one coded effect per slide, music-reactive motion, an offline presenter window and rehearsal timing. Zero dependencies, works from `file://`.

让网页成为舞台，让视觉、动效与声音替你的内容开口。这个 skill 只做一件事：把讲稿做成在浏览器里讲的演讲。从讲稿出发写逐页画面表，用自带的翻页底座搭骨架，一页一个编程特效，配乐按页名切换，按 P 打开演讲者窗排练，最后打成一个双击就能讲的文件夹。

## 可以做些什么

- **从讲稿做一场网页演讲**：“这是我下周的讲稿，帮我做成能在浏览器里放的演讲。”先给你逐页画面表，确认后再做页面和特效。
- **给关键页加一个会动的论点**：“这一页讲概率选词，能不能让观众看着句子被带偏？”一页一个特效，删掉脚本页面照样完整。
- **排练和计时**：按 P 开演讲者窗，看当前页、下一页、备注和每页用时，排练完导出 CSV 看哪几页超时。
- **改上一场的包、换场合再讲**：复制上一个包再改，页名、动画用到的字、音乐锚点都不会被改坏。
- **迁移 Claude Design 导出的演讲**：把 `deck-stage` 换成本仓的 `talk-stage`，旧特效基本不用动，单独打开也有演讲者窗。

打开 `examples/demo/index.html` 看一个 8 页的样例（双击即可）：拆字、盖章、概率打字机、数字滚动，按 → 翻页，按 P 开演讲者窗。

## 仓库里有什么

| 路径 | 内容 |
|---|---|
| `SKILL.md` | 给 Agent 读的流程：讲稿 → 逐页画面表 → 骨架 → 特效 → 配乐与视频页 → 排练 → 打包 |
| `runtime/talk-stage.js` | 翻页底座（约 800 行，零依赖）：等比缩放、键盘／触摸／翻页笔、跳过页、`#N` 深链接、打印讲义、离线演讲者窗与排练计时 |
| `runtime/fx-core.js` | 特效运行时：逐帧循环、舞台坐标、音乐能量、画布分层、页生命周期、页内节拍、减少动效、自动降质 |
| `runtime/deck-tools.js` | Esc 页面总览、T 排练计时胶囊 |
| `runtime/route.js` / `route.css` | 章节条和页码、按路线删页 |
| `runtime/bgm.js` | 配乐：按页名切曲、M 静音、视频页压低音乐、打印暂停 |
| `references/` | 底座接口与迁移、特效契约、改稿规则、配乐 |
| `examples/demo/` | 8 页样例 |
| `runtime/test/` | 底座的 62 项自动验收（Playwright + 本机 Chrome） |

## v2：只做网页演讲

v1 是一个「什么前端都管」的 skill：落地页、作品集、视觉文章、仪表盘审查都做，没有附带任何运行时代码。这几个月我真正反复在做的是网页演讲，四次现场交付下来，翻页、特效、配乐、排练、改稿踩过的坑都沉淀在了 v2 里。普通网页的审美方向交给 Anthropic 的 frontend-design 就好。

v1 的完整内容保留在 git 历史的 `v1-legacy` 标签里。

## 安装

本 skill 兼容 Claude Code / Codex / 其他支持 `SKILL.md` 的平台：把本仓库整体放进对应平台的 skills 目录（如 `~/.claude/skills/craft-frontend-ppt/`），或按平台的 skill 安装方式引入。

## 致谢

- **Claude Design**：翻页底座的接口思路（`slidechange`、`data-deck-active`、`goTo`、演讲者备注格式）来自它的演讲组件。本仓的 `talk-stage.js` 是按行为规格独立重写的，不含其代码。
- **[op7418/guizang-ppt-skill](https://github.com/op7418/guizang-ppt-skill)**：离线双窗口演讲者模式和记录每页实际用时的思路。它是 AGPL 许可，本仓未使用其代码。
- **[zarazhangrui/frontend-slides](https://github.com/zarazhangrui/frontend-slides)**：先做几张样张让人挑风格的思路。

## 许可

本项目以 **Apache-2.0** 许可发布（见 `LICENSE`），第三方说明见 `THIRD_PARTY_NOTICES.md`。

## 反馈与作者

这个 skill 我长期维护。如果你有修改方案、发现问题、或者改出了更好的版本，欢迎通过以下任一渠道找到我：

- GitHub：本仓库提 issue 或 PR
- 小红书：错误乱码
- 微信公众号：能工智人错误乱码
- B站：若逗道人

## 作者的其他开源 Skill

<!-- 本表由 AgentOps 私有 catalog（skills.yml）生成，勿手工编辑 -->
| Skill | 一句话介绍 |
|---|---|
| [domain-explorer](https://github.com/ruodou233/domain-explorer) | 速通新领域：四线并行调研，产出交互式知识地图<br>Get up to speed on a new topic through its history, competing approaches, expert debates, and practical experience. |
| [de-ai-taste](https://github.com/ruodou233/de-ai-taste) | AI 写的中文一眼就能看出来？逐条找出 AI 味、给出具体修改建议，让文章、讲稿和文案读起来像你写的。<br>Review AI-written Chinese and suggest edits to remove formulaic phrasing while preserving the author's voice. |
| [improve-product-plan](https://github.com/ruodou233/improve-product-plan) | 把模糊的产品想法梳理成可开发、可验收的 SPEC.md<br>Plan product requirements and MVP scope, then produce a development spec with milestones and acceptance criteria. |
| [wisdom-roundtable](https://github.com/ruodou233/wisdom-roundtable) | 智慧圆桌：11 位思想家并行独立分析你的决策<br>Explore ideas and decisions through multiple mental models, then compare their assumptions, blind spots, agreements, and disagreements. |
| [agent-orchestration](https://github.com/ruodou233/agent-orchestration) | 复杂任务跑到半夜，你不可能一直盯着。让 Agent 分工跑长任务和批量工作，你只管第二天早上收结果。<br>Coordinate AI agents for long-running tasks, parallel work, and overnight workflows. |

其他开源 skill 见 [GitHub 主页](https://github.com/ruodou233)。
