# Motion Engineering

Use this reference only when movement materially supports the task.

## Decide whether movement helps

Consider how often the person encounters the interaction. Favor immediacy for frequent actions; reserve more expressive sequences for rare, explanatory, or identity-defining moments.

Give every animation a purpose:

- preserve spatial continuity;
- explain a state or relationship;
- confirm an action;
- soften a meaningful change;
- demonstrate a feature;
- add atmosphere where Brand is the leading register.

When the purpose is weak, let layout, color, and type do the work.

## Design the behavior

- Match frequency and amplitude to the importance of the event.
- Use a coordinated sequence when several elements describe one moment; use local feedback for repeated controls.
- Choose easing by motion type: responsive deceleration for entry and feedback, balanced acceleration for movement already on screen, linear progression for constant motion.
- Set transform origin at the source of the interaction, such as a popover trigger; keep unanchored dialogs centered.
- Keep gestures and reversible interactions interruptible so they continue naturally from their current state.
- Keep content available before enhancement; motion should enrich an already understandable interface.

## Implement efficiently

Prefer transform and opacity for routine motion. Use clipping, filters, masks, layout animation, or springs when their visual or physical behavior is essential and measured performance is acceptable. Animate explicit properties instead of broad transitions.

Use a motion library for gestures, shared layout, sequencing, or interruption when the project already has one or the behavior warrants it. Keep simple hover, focus, and state transitions in CSS.

For continuous animation, stop scheduling or drawing while its surface is offscreen or the document is hidden, and resume without a large time jump. Do not keep a global frame loop alive for a settled frame.

## Provide a reduced-motion experience

Respect the person's motion preference. Preserve information and state change through instant transitions, restrained fades, or static composition. Remove ambient, parallax, and decorative travel in the reduced experience.

## Verify

Test entry, exit, reversal, rapid repeated input, hidden-tab recovery, narrow screens, reduced motion, and lower-performance devices when relevant. Confirm that movement never blocks input or leaves content invisible.
