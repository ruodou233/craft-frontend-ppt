# Sources and Transformation Record

This file is maintenance provenance. Runtime tasks do not load it.

## Included sources

| Source | Pinned commit | License | Local contribution | Transformation |
| --- | --- | --- | --- | --- |
| Anthropic `frontend-design`, `skills/frontend-design/SKILL.md` | `fa0fa64bdc967915dc8399e803be67759e1e62b8` | Apache-2.0 | subject-grounded direction, hero as thesis, content-aware structure, optional signature, self-critique | Rewritten into conditional direction guidance; fixed two-pass ritual and aesthetic blacklist removed |
| Leonxlnx Taste Skill, `skills/taste-skill/SKILL.md` | `7c397f22d3af6f2b3f1925eb147d8e8801086151` | MIT | Design Read, register inference, audit-first redesign, expression/motion/density vocabulary | Numeric dials, preset mappings, fixed stacks, font/icon lists, and broad bans removed; landing-page bias narrowed |
| Paul Bakaus Impeccable, `.agents/skills/impeccable/SKILL.md` and relevant `reference/` files | `8967edc988ee146823bca3c51fcf51296e9dec18` | Apache-2.0 | intent routing, existing-context priority, production craft, visual iteration | Twenty-three-command surface, setup files, hooks, detectors, and duplicated rules removed; Impeccable's lineage from Anthropic recorded once |
| Vercel Web Interface Guidelines, `command.md` | `4e799d45c17aec1498c269287a83b9dba22b966b` | MIT | semantic, accessible, responsive, state, content, and performance checks | Rules graded as required, conditional, or suggestive; stylistic preferences are no longer universal requirements |
| Emil Kowalski Design Engineering, `skills/emil-design-eng/SKILL.md` | `6bf24434f7730ad169077756cf9c7cd7bd675fc6` | MIT | animation purpose, frequency, easing, origin, interruption, perceived performance | Rigid frequency/duration commands converted to contextual decisions; motion loaded only when relevant |

Canonical repositories:

- https://github.com/anthropics/skills
- https://github.com/Leonxlnx/taste-skill
- https://github.com/pbakaus/impeccable
- https://github.com/vercel-labs/web-interface-guidelines
- https://github.com/emilkowalski/skill

## Explicitly excluded

`nextlevelbuilder/ui-ux-pro-max-skill` is not a source for this skill. No text, templates, design systems, palettes, or assets from that project were included.

## Modification notice

Craft Frontend is a newly organized and substantially rewritten derivative that combines selected concepts from the pinned works. It changes structure, wording, scope, routing, rule strength, and defaults; removes duplicated and conflicting material; and adds a conditional workflow and single-owner reference architecture. The upstream authors do not endorse this derivative.
