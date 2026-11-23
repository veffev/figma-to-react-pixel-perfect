# Phase 2: decomposer

A dedicated subagent on the strongest model. Reads `tree.json` (from `get_metadata`), `motion-inventory.json` and `shared/context.md`. Writes `shared/component-tree.json` (schema: `assets/component-tree.schema.json`). This is where the design reasoning happens; everything downstream inherits its mistakes.

## Splitting

- Instances of the same Figma component (`componentId`): **one** React component; Figma variants become props.
- A component is `shared` only if it appears at least twice **or** it is a real Figma component. Otherwise it stays markup inside its section.
- An equivalent already exists in the repo: set `reuse` to its path.
- Repeated items (cards in a grid, rows in a list): one item component plus an array prop on the container.

## Project context

Read the project before the frames: `shared/context.md` plus the code itself. Existing routes and layouts, how the repo composes pages, where features live, how it models variants and states, which components already exist. Decisions about structure follow what the project already does; an empty project is stated as such and gets proposed defaults the user confirms.

## Several screens

If the input holds more than one screen, do the flow analysis first (`flow-analysis.md`) and wait for the user to confirm the flow map. The component tree is then built per group (shell, shared components, one route at a time).

## Reusable components

Look across all screens of the input, and at what earlier runs built (`docs/figma/components.json`), for pieces that are really one component used with small differences. Decide what becomes a prop, a variant, a slot or a state, and what stays separate: follow `component-reuse.md`. The splitting rules below are the baseline for a single screen.

## Layout intent

For the page frame and every full-width or full-height section, read the layout intent before anything else and record it: follow `layout-intent.md`. Set `scope: "page"` on the page node. This decides whether the result works outside the frame's exact size.

## Static or dynamic

For every text, image and number:

- **Static**: part of the design (labels, section titles, icons). Stays in the component, or goes to the i18n catalog if the repo has one.
- **Dynamic**: content (names, prices, avatars, counts, lists). Becomes a **prop**.
- Unsure: open an issue and ask. Do not decide silently.

## Props contract (`dataContract`)

For each dynamic value: prop name, type, required or not, and an example taken from the frame. This is the interface the user will use to wire their own data. Name props after what they mean (`price`, `authorName`), not after the Figma layer.

## Interactivity (`kind`, Next branch only)

`server` by default. `client` only for local UI state, event handlers, browser APIs, client-only libraries, or JS-driven animation. Put the `"use client"` boundary on the smallest leaf; the rest receives serialisable props or `children`. The decision is about **interactivity only**, never about where data comes from. Omit `kind` in the React branch.

## States

List the states present as variants (hover, pressed, focus, disabled, open, selected, empty, error, loading). States missing from the design go to `issues/` as a question.

## Skeleton

Every component with dynamic content gets `<Name>Skeleton`. If Figma has a loading state, implement that one. Otherwise the skeleton is **derived from the spec geometry** (same boxes, same outer size, no layout shift) and marked `derived: true`.

## Loading boundaries

Mark `boundary: true` where an independent loading boundary makes sense (a section that can arrive after the rest). Annotate only; do not implement it.

## Motion

Set `motion: true` on every component that appears in the motion inventory.

## Example entry

```json
{
  "name": "PricingCard",
  "scope": "shared",
  "figmaNodes": ["45:120", "45:188"],
  "path": "components/pricing-card.tsx",
  "reuse": null,
  "kind": "server",
  "reason": "no UI state or events; hover is CSS only",
  "dataContract": [
    { "prop": "title", "type": "string", "required": true, "example": "Pro plan" },
    { "prop": "price", "type": "number", "required": true, "example": 29 },
    { "prop": "features", "type": "string[]", "required": true, "example": ["Unlimited projects"] }
  ],
  "static": ["45:125 (CTA label)"],
  "variants": { "variant": ["default", "featured"] },
  "states": { "present": ["default", "hover"], "missing": ["focus", "empty"] },
  "skeleton": { "needed": true, "derived": true },
  "boundary": false,
  "motion": true,
  "children": ["Button"]
}
```
