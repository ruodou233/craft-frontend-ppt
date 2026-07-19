# Evaluation and Refinement

Use this reference for Review, Improve, and post-change verification.

## Inspect before changing

Record the target surface, its primary job, the existing system, and the observed evidence. Separate:

- **Preserve:** behavior, brand signals, hierarchy, components, and patterns that already serve the task.
- **Change:** specific defects or mismatches that block clarity, identity, access, responsiveness, or quality.

For Improve, keep the intervention proportional to the evidence. For Review, report without editing unless implementation is also requested.

## Evaluate by level

### Required quality

- semantic structure, meaningful labels, keyboard operation, visible focus, accessible names, contrast, and browser zoom;
- correct links, buttons, form behavior, async status, and recovery from errors;
- representative narrow and wide layouts without unintended overflow, occlusion, or lost content;
- required interaction states and realistic content extremes;
- successful runtime or build verification when the environment permits it.

### Conditional quality

Apply when the surface needs it: reduced motion, localization, safe areas, large-list performance, URL-synchronized state, destructive-action recovery, unsaved-change protection, and hydration safety.

### Directional suggestions

Treat capitalization, punctuation, exact copy style, a particular motion technique, or a specific layout pattern as contextual suggestions. Let the brief and the target surface decide.

## Verify changes

Compare the result with the brief and the preserved behavior. Exercise the main path, keyboard path, responsive layouts, focus, relevant states, and content extremes. Check console errors and runtime warnings. For motion, also verify interruption and reduced motion.

Return to implementation only for observed defects or a clear missed objective.

## Report findings

Group issues by severity:

- **Critical:** prevents completion, access, or correct use.
- **Major:** materially harms clarity, responsiveness, identity, or performance.
- **Minor:** localized polish or maintainability issue.
- **Suggestion:** plausible improvement whose value depends on preference or context.

For each actionable finding, include its location, evidence, impact, and a concrete correction. Mark unverified claims and allow a clean pass when the evidence supports it.
