---
name: craft-frontend
description: Build, improve, review, or add purposeful motion to web frontend interfaces with brief-specific visual direction and production-level implementation. Use for landing pages, portfolios, dashboards, app surfaces, components, web-based presentation companions, visual essays, scrollytelling, animated explanatory diagrams, and existing frontend code when the user asks to design, style, redesign, polish, critique, audit, animate, or turn source material into a staged visual narrative. Preserve the target surface's existing stack, brand, behavior, and design system unless the request authorizes a change. Scope this skill to web visual and interaction work rather than backend-only work, native applications, slide decks, hosting, URL cloning, or research-only tasks.
---

# Craft Frontend

Create web interfaces whose direction follows the brief and whose implementation survives real use.

## Route the task

Choose one primary intent:

- **Build** — create a new page, surface, or component.
- **Improve** — change an existing interface while preserving its required behavior.
- **Review** — report evidence-backed findings without changing files unless the user also asks for implementation.

Add the modifiers that materially change the work:

- **Motion** — add or revise interaction and animation.
- **Visual story** — use when the surface's primary job is to transform source material into a staged narrative sequence led by diagrams, imagery, and motion—for example, a live-talk companion, scrollytelling page, campaign narrative, or interactive visual essay. Do not add this modifier to an ordinary landing page, product surface, or motion-only task unless the user asks for that narrative transformation.

Read only the references needed for the route:

| Primary route | Read |
| --- | --- |
| Build | `references/direction.md`, `references/implementation.md` |
| Improve | `references/evaluation.md`, `references/implementation.md`; add `direction.md` when changing visual direction |
| Review | `references/evaluation.md`; add `direction.md` for visual-direction critique |

| Modifier | Also read |
| --- | --- |
| Motion | `references/motion.md`; add `implementation.md` when editing code |
| Visual story | `references/visual-story.md`, `references/motion.md` |

Read `references/sources.md` only when maintaining this skill.

## Work through a conditional loop

Use this shared skeleton, skipping work that does not serve the selected route:

1. **Route** — identify the intent, target surface, allowed scope, and whether files may change.
2. **Inspect** — read the brief, source content, target code, available assets, dependencies, tokens, components, and representative states.
3. **Decide** — choose the smallest coherent direction or intervention. Form a Design Read internally when direction changes; expose it only when confirmation would materially improve the result.
4. **Execute** — build or improve the requested surface. For Review, report findings and stop. For Motion, first establish that movement has a useful purpose.
5. **Verify** — test the relevant behavior, responsive layouts, keyboard use, focus, content extremes, and runtime output. When verification finds a concrete defect, return to Execute and correct it.

## Resolve direction

Resolve aesthetic and product choices in this order:

1. User's explicit request.
2. Confirmed task objective and real source content.
3. Brand and design system of the target surface.
4. Local page and component conventions.
5. Design heuristics.

Judge Brand versus Product register per target surface. Let the primary register drive hierarchy and interaction; let the secondary register influence expression without displacing the surface's job.

## Maintain delivery invariants

Treat these as parallel to visual direction:

- Preserve required behavior, information architecture, business meaning, test selectors, and content truth within the authorized scope.
- Reuse existing tokens, components, libraries, and conventions when they support the task. Introduce a dependency or deviation only when it creates a clear capability or quality gain.
- Use semantic HTML, visible keyboard focus, accessible names and labels, sufficient contrast, browser zoom support, and understandable async or error feedback.
- Complete the states relevant to the interaction: default, hover, focus, active, loading, disabled, empty, error, and success.
- Make representative desktop and mobile layouts reflow without unintended overflow, occlusion, or truncation; size controls for touch where appropriate.
- Keep motion purposeful, interruptible, performance-aware, and paired with a reduced-motion experience.
- Use real content and test representative short, long, empty, and localized strings when relevant.
- Run the project or open the result in a browser. State any verification that the environment could not perform.
- Use only assets, fonts, libraries, and code that the project is allowed to use.

## Keep the direction specific

Ground the interface in one concrete subject, audience, and job. Derive structure, vocabulary, palette, type, imagery, and motion from evidence in that world.

Use expression, motion, and density spectra as shared vocabulary only when they help a new direction or major redesign. For a local change, choose only the relevant axis.

Choose **zero or one** signature element. Add one only when the subject, content, or task supplies a convincing reason; let the rest of the interface support it quietly.

## Deliver proportionally

For implementation, return working files plus the verification performed. For Review, group findings by severity and location, distinguish observed defects from suggestions, and include a concrete correction for each actionable issue.
