# Animations

Animations are part of the job. Every entry of `spec.motion` is either implemented and verified, or declared as an open issue.

## Where the data comes from

1. `get_motion_context` (or Figma's `figma-implement-motion` skill if available): keyframe tracks, easing curves, ready-made CSS `@keyframes` and motion.dev snippets, timeline coordination hints. Treat the snippets as a reference to adapt to the project's tokens, but copy **durations, delays, easings and keyframes exactly**.
2. Component variants: they define the **target states** (hover, pressed, open).
3. A state exists but its transition (duration, easing) is not in the Figma data: open an issue and ask. Do not pick a silent default such as `duration-200`. If the user authorises a default, record it in `decisions/`.

## How to implement: the lowest level that works

Use what the repo already has (library, shared variants, hooks). Never add a second animation library.

| Case | Implementation |
|---|---|
| State change (hover, focus, active) | `transition-[props] duration-[Nms] ease-[cubic-bezier(...)] delay-[Nms]` |
| Mount entrance, loops, keyframes | `--animate-*` plus `@keyframes` in `@theme`, used as `animate-*`; `starting:` for simple entrances |
| Scroll entrance | the repo's helper or hook if it has one; otherwise an IntersectionObserver that adds a class |
| Exit from the DOM, layout animation, springs, gestures, coordinated sequences | the repo's animation library; if there is none, ask before adding one |

- In the Next branch the first two rows do not need `"use client"`. A component does not become a Client Component just because it has a CSS transition.
- Springs: use the same parameters as Figma (stiffness, damping, mass). Do not convert them to a duration by eye.
- Stagger: per-index delays come from the timeline hints, not from guesswork.
- Prefer animating `transform` and `opacity`. If Figma animates width or height, consider `scale` or a layout animation and record the choice.
- Always keep a correct final state under `prefers-reduced-motion`.

## In the spec

- CSS transitions: `kind: "transition"` with `properties`, `duration`, `delay`, `easing`.
- CSS or WAAPI keyframes: `kind: "keyframes"` with `duration`, `delay`, `easing`, `iterations`, `keyframes`.
- Springs and other JS-driven animation: `kind: "js"`. The script cannot verify their timing; it reports them as warnings and still checks the final state through the numeric gate.
