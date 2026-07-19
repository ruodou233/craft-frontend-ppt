# Production Implementation

Use this reference whenever changing frontend files.

## Inspect the project first

Read the relevant package manifest, entry point, theme or token source, global styles, and one representative component. Identify the framework, styling approach, component library, routing, state pattern, tests, and build commands.

For a new standalone artifact, choose the simplest stack that can express the required behavior. Prefer platform capabilities and existing dependencies before adding packages.

## Preserve and integrate

- Reuse tokens and components when they fit the target behavior.
- Keep public behavior, information architecture, data semantics, routes, and test selectors stable unless the request authorizes changes.
- Isolate intentional deviations and express them through maintainable tokens or components.
- Keep static content server-renderable or plain HTML when interactivity is unnecessary; isolate interactive code to the smallest useful surface.

## Implement structure and states

- Use semantic landmarks, headings, lists, tables, links, buttons, labels, and form controls.
- Make every interactive element reachable and understandable with keyboard and assistive technology.
- Implement the relevant state cycle and recovery path, including pending work and failure.
- Use responsive CSS layout before JavaScript measurement. Let text wrap, reflow, truncate, or expand according to its meaning.
- Give media dimensions or aspect ratios, meaningful alternatives, and suitable loading priority.
- Keep styling specificity predictable and centralize repeated values as tokens.

## Use dependencies deliberately

Inspect the manifest before importing a package. Add a dependency only when it provides a capability that would be expensive or fragile to reproduce, and use its established API rather than recreating it. Keep assets and fonts licensed and load them without blocking the primary content.

## Verify in the runtime

Run the relevant formatter, typecheck, tests, and build when available. Open the result in a browser and inspect at representative wide and narrow viewports. Exercise the primary action, keyboard path, focus order, and relevant states. Check the console and correct visible overflow, layering, crop, and content issues.
