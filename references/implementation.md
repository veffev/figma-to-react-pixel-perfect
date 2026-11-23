# Phases 4 and 6: implementation and integration

## What each component consists of

1. The **presentational component**: props only. No data access, no data-library imports.
2. The **props type** (TypeScript) or JSDoc (JavaScript), identical to the `dataContract`.
3. `<Name>Skeleton`, when the tree asks for one.
4. The state variants present in the design.

Every element listed in `spec.elements` carries `data-figma-node="<nodeId>"`. The root of the component carries the spec's own `nodeId`. This is the hook the verification uses. A skeleton root carries `data-figma-skeleton`.

## Two waves

- **Wave 1, shared components.** Build the `scope: shared` components in dependency order. Each one passes verification in isolation before wave 2 starts.
- **Wave 2, sections.** One agent per section, in parallel. A section composes shared components, creates none, and touches no other section's files. The page or section receives its data as props from above.

## Page structure

Pages and full-size sections follow `layout-intent.md`: root at `min-h-dvh` / `h-dvh`, regions in flex or grid, fill regions without fixed sizes, anchored items placed by their region's padding, decoration positioned in percentages of the region it lives in. Frame pixel coordinates with `position: absolute` are for decoration and overlays only.

## Fixed instruction for implementers

> Use ONLY the values in spec.json. Implement EVERY entry of motion and states. No fetch, no data library, no sample data inside components: dynamic content comes from props. A missing value goes to issues, never invented. Follow context.md (language, lint, i18n, naming, folders). Put data-figma-node on every element of the spec.

## Branch specifics

**Next App Router**

- Respect `kind` from the tree. `"use client"` only where the tree says `client`, on the smallest leaf.
- Images: `next/image` with the node's exact dimensions; `priority` only above the fold.
- Fonts: `next/font`, exposed through the CSS variable used by the `--font-*` token.

**React**

- Images: `<img>` with exact `width` and `height`, `loading="lazy"` below the fold.
- Fonts: the repo's method (Fontsource, `@font-face`), exposed through the `--font-*` token.

## Preview route (development only)

Renders one node at the frame's width, passing the `fixture` as props. A page node uses `width: 'viewport'` so it can be checked at several window sizes. A `?state=` parameter selects other states (`skeleton`, `empty`, ...). Templates are in `assets/preview-templates/`.

- Next: `app/(dev)/figma-preview/[node]/page.*`, returning `notFound()` in production. Never use a folder starting with `_`: App Router treats it as private and creates no route.
- React: a route registered only in development, or a separate bundler entry.

Node ids contain `:`; use the `-` form in URLs (`45-120`).

## Flow playground (development only)

A flow with two or more steps also gets a playground page under the preview folder, where the real step components run on mock data and the user can walk through the flow: see `flow-playground.md`. Mock data and step-to-step wiring live there and nowhere else.

## Phase 6: integration

1. Assemble the sections into the real page and rerun verification on the whole frame.
2. Run the repo's own checks: lint; type-check only in a TypeScript repo; alt text; visible focus.
3. Final report, centred on the **data-wiring map** for the user:

| Component | Props (contract) | Skeleton | Suggested loading boundary | Server / Client |
|---|---|---|---|---|

Also report: remaining deviations with their likely cause, animations implemented and with what, derived skeletons, open issues (missing states or transitions, static/dynamic doubts), and any disagreement between models and how it was settled.
