# Third-Party Notices

**No third-party code is included in this repository.** Everything under `runtime/`, `examples/` and `references/` was written by the repository owner (ruodou233) or, for `runtime/talk-stage.js`, implemented from a behaviour specification written from the owner's own code.

## `runtime/talk-stage.js`

The element's public interface (the `slidechange` event, the `data-deck-active` / `data-deck-skip` attributes, `goTo()`, `#speaker-notes`, and the 1920×1080 scaled stage) follows the conventions of the slide-deck starter component shipped with Anthropic's Claude Design, so that effects written against that interface keep working. The implementation is an independent clean-room rewrite: it was written from a behaviour specification derived only from the owner's own scripts, by an implementer who did not read the original component. It contains no code from Claude Design. Claude Design does not endorse this project.

## Ideas acknowledged (no code or text used)

- **op7418/guizang-ppt-skill** (AGPL-3.0): the idea of an offline two-window presenter mode and recording per-slide rehearsal timing. None of its code or text is used.
- **zarazhangrui/frontend-slides** (MIT): the idea of letting the user pick a style from a few rendered sample slides instead of describing it.

## Previous version

v1 of this skill (tag `v1-legacy` in git history) contained material rewritten from Anthropic `frontend-design`, Impeccable, Taste Skill, Vercel Web Interface Guidelines and Emil Kowalski's Design Engineering skill, with notices recorded in that version. v2 removed those references; their notices remain with the v1 history.
