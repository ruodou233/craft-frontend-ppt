# 来源与改写记录

本文件只记录维护来源，运行任务不加载。

## 已采用来源

| 来源 | 锁定 commit | 许可证 | 引入内容 | 改写方式 |
| --- | --- | --- | --- | --- |
| Anthropic `frontend-design`，`skills/frontend-design/SKILL.md` | `fa0fa64bdc967915dc8399e803be67759e1e62b8` | Apache-2.0 | 扎根主题的方向、用首屏主视觉陈述主旨、内容驱动结构、可选标志性元素、自我批评 | 改写为按条件启用的方向指引；删除固定两遍流程和审美黑名单 |
| Leonxlnx Taste Skill，`skills/taste-skill/SKILL.md` | `7c397f22d3af6f2b3f1925eb147d8e8801086151` | MIT | 设计判断、语域推断、先审计再改版、表达／动效／密度词汇 | 删除数值旋钮、预设映射、固定技术栈、字体与图标清单及宽泛禁令；收窄落地页偏向 |
| Paul Bakaus Impeccable，`.agents/skills/impeccable/SKILL.md` 与 `.agents/skills/impeccable/reference/craft.md` | `8967edc988ee146823bca3c51fcf51296e9dec18` | Apache-2.0 | 意图路由、既有上下文优先、生产级工艺、视觉迭代 | 删除 23 个命令的表层入口、设置文件、钩子、检测器和重复规则；只记录一次 Impeccable 对 Anthropic 的沿袭关系 |
| Vercel Web Interface Guidelines，`command.md` | `4e799d45c17aec1498c269287a83b9dba22b966b` | MIT | 语义化、无障碍、响应式、状态、内容和性能检查 | 将规则分为必需、条件和建议；不再把风格偏好当成普遍要求 |
| Emil Kowalski Design Engineering，`skills/emil-design-eng/SKILL.md` | `6bf24434f7730ad169077756cf9c7cd7bd675fc6` | MIT | 动画用途、频率、缓动、原点、中断和感知性能 | 将僵硬的频率与时长命令改为情境化决策；只在相关时加载动效参考 |

上游主仓：

- https://github.com/anthropics/skills
- https://github.com/Leonxlnx/taste-skill
- https://github.com/pbakaus/impeccable
- https://github.com/vercel-labs/web-interface-guidelines
- https://github.com/emilkowalski/skill

## 仅作参考的案例

| 案例 | 访问日期 | 参考内容 | 采用边界 |
| --- | --- | --- | --- |
| Son Daven，https://sondaven.com/en；项目说明见 https://webflow.com/made-in-webflow/website/sondaven-dev | 2026-07-19，2026-08-02 复核 | 页面与运行时脚本（GSAP SplitText + ScrollTrigger + Lenis）显示基于亮度的网格化竖条半调渲染、多层 WebGL 滚动合成、逐词错峰揭示、逐行上升揭示、逐字符滚动高亮与悬停字符切换；图片视差为遮罩容器内 `yPercent` 进度绑定；不归类为 ASCII | `reference-only`；只抽象采用滚动进度映射、层级语义和文字编排方法，不复用其源码、品牌、字体、配色、栅格、文案、图像、视频、音频、图标、场景素材或特有编排序列 |

## 明确排除

`nextlevelbuilder/ui-ux-pro-max-skill` 不是本 Skill 的来源。本 Skill 未采用该项目的文字、模板、设计系统、配色或资产。

## 改写声明

Craft Frontend PPT 是重新组织并大幅改写的衍生作品，组合了上述锁定版本中的部分理念。它改变了结构、措辞、范围、路由、规则强度和默认行为，删除重复与冲突内容，并新增按条件启用的工作流和单一所有者参考架构。上游作者未对本衍生作品作出背书。
