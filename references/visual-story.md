# Visual Storytelling

Use this reference for a web surface whose primary job is to stage a narrative: a live-talk companion, scrollytelling page, campaign story, or interactive visual essay. Load it when the audience should feel relationships, changes, and stakes through the screen rather than read the source material there.

## Build a scene spine

Read the complete source and the user's visual requirements before choosing a structure. Decide whether the page accompanies a speaker or must explain itself.

- For a live companion, limit each scene's prose to one large headline and at most one short subtitle. Put no explanations, examples, qualifications, or supporting detail from the speech on screen. Show a number, diagram label, or control only when the visual would otherwise be unintelligible or unusable; these do not enlarge the prose budget.
- For a standalone story, retain enough context, evidence, and navigation for independent understanding while keeping visuals in the leading role.

Turn the source into an ordered set of narrative beats. For every beat, identify:

- the claim, change, feeling, or decision it must communicate;
- three to eight search keywords covering the subject, material world, visual verb, relationship, and intended emotional effect;
- an original diagram, image, or spatial composition that can carry the meaning;
- the copy, number, or control that must remain visible;
- the transition into or out of the beat;
- any action the audience should take.

Keep the beats traceable to the source. Preserve factual meaning, necessary qualifications, and the intended action while moving detailed prose off the presentation surface. Let the source and viewing condition determine the number and size of scenes.

## Research visual mechanisms in parallel

Use subagents to research outside inspiration for the narrative beats. Divide the beats into disjoint groups so every beat receives keyword extraction and research while the searches run in parallel.

Ask each research subagent to search well-regarded open-source frontend design, open-source visual-element and interaction projects, creative-coding communities, data-visualization work, and new-media art.

Because general inspiration searches can miss strong depth-based mechanisms, run an additional focused search for each assigned beat for well-regarded parallax-scrolling and scroll-linked motion. Combine the beat's keyword cluster with relevant terms such as `parallax`, `layered scroll`, `scroll-linked animation`, `sticky scrollytelling`, or `scroll depth`. Treat parallax as a mechanism lens within the five source families, not as a sixth source family. Return the strongest relevant, well-regarded candidate. Record an explicit no-fit when neither parallax scrolling nor another scroll-linked mechanism would clarify the beat, or an explicit no-hit when the search yields no sufficiently supported candidate.

For every candidate, return:

- the narrative beat and keyword cluster it serves;
- the primary repository and official demonstration;
- license and version or commit when available;
- concrete evidence of community or institutional recognition;
- the reusable visual or interaction mechanism;
- how that mechanism could be translated into the brief's own material world;
- the reason to adopt or reject it.

Synthesize the research before implementation. Choose a small set of complementary mechanisms that serve distinct narrative jobs and reinforce one coherent visual language. Recreate the mechanisms for the brief rather than reproducing recognizable compositions, signature appearances, assets, or code. Keep the adopted and rejected sources in a project-level inspiration record.

## Find a native visual language

Extract materials, artifacts, processes, gestures, and spatial relationships from the subject. Use the research to expand how those native elements can behave, not to replace them with an unrelated trend.

If a signature element earns that role, use it as a motif that can change role across beats. Define what remains semantically constant—such as a color meaning connection, a material meaning verification, or a direction meaning flow—then let its form and motion evolve with the story. If no signature element is warranted, build continuity through recurring structure, materials, and motion rules.

Build recognition through that continuity. Let supporting elements reinforce the shared visual grammar so the full sequence feels authored rather than assembled from separate effects.

## Direct the sequence visually

Arrange an opening thesis, meaningful progression, a turn or contrast, and a resolved next step when the source supports them.

Lead every substantive beat with an original diagram, image, or spatial composition. Use title-only scenes as deliberate moments of pause. When a beat contains a relationship, process, state change, or emotional turn, express it through an authored motion sequence.

Translate source verbs into visual behavior: gather, connect, hand off, filter, reveal, compress, split, resist, release, or transform. Coordinate scale, path, density, contrast, material, depth, rhythm, and timing so the audience can feel the change before reading its labels.

Give each beat a dominant visual event while varying stillness, density, contrast, material, and scale across the sequence. Keep a complete and intentional first frame, then let motion reveal causality and transformation. Apply `motion.md` for movement decisions and `implementation.md` for production integration.

For procedural visuals, make results reproducible enough to debug and compare when practical. Stop continuous work offscreen, pause it while the document is hidden, and bound rendering cost to the value of the effect.

## Recompose across displays

Design for the primary viewing condition, including distance, scale, and pacing for a live presentation.

Recompose spatial relationships for narrow screens instead of merely shrinking or mechanically cropping the desktop scene. Preserve real controls, content order, focal relationships, and an understandable completed composition.

## Verify the story

Check that:

- every retained beat maps back to the source and has a clear completed state;
- for a live companion, no scene exceeds one headline plus one short subtitle; any number, diagram label, or control passes the essentiality test above;
- every retained beat has a traceable three-to-eight-keyword cluster and is assigned exactly once across the subagent research groups dispatched in parallel;
- the research matrix covers every beat; for each beat, it records the strongest relevant, well-regarded parallax-scrolling or scroll-linked-motion candidate, an explicit no-fit, or an explicit no-hit; collectively, it covers all five source families with a relevant result or explicit no-hit where needed;
- every shortlisted candidate records its primary repository, official demonstration, license, recognition evidence, reusable mechanism, brief-specific translation, and adopt-or-reject decision;
- every substantive beat is visually led, and motion carries relationships or change instead of serving as unrelated decoration;
- the sequence remains coherent at first paint, without motion, and with reduced motion;
- entering, scrolling to, or jumping directly to a scene reveals the intended scene without stale neighboring state;
- the primary display and a representative narrow display preserve hierarchy, focal relationships, visual impact, and legibility;
- interactive actions remain semantic, keyboard operable, and visibly confirmed;
- external inspiration is recorded and translated into mechanisms rather than recognizable imitation;
- decorative or procedural work pauses when it is not contributing.
