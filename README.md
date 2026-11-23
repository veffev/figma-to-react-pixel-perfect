# figma-to-react-pixel-perfect

An agent skill that implements the **UI layer** of a Figma design in React or Next.js (App Router) with Tailwind v4: pixel-perfect, animations included, and **measured** against the design instead of eyeballed.

It produces presentational components, skeletons and a props contract. It writes no data-fetching code: you wire your own server and client data libraries using the contract.

## Why

Agents asked to "implement this Figma link" usually approximate: they estimate values from a screenshot, skip animations, and call it done after a visual glance. This skill removes the guessing:

- every value comes from Figma data and lands in a machine-readable `spec.json`
- a script compares the rendered result to that spec, element by element (boxes, computed styles, states, animation timing and keyframes)
- a decomposer splits the design into components first, so shared pieces are built once
- pages are built from the layout intent behind the frame and checked at several window sizes, not only at the frame's
- given several screens, it reads the project's routing and flow patterns, maps the frames to routes, steps and states, and asks you to confirm before writing code
- an optional second model (Codex) reviews the diff against the spec
- when the designer changes the frame, only the nodes whose spec hash changed are reworked

## Install

```bash
npx skills add veffev/figma-to-react-pixel-perfect
```

Or copy this folder into your agent's skills directory (for Claude Code: `.claude/skills/` in a project, or `~/.claude/skills/`).

## Requirements

- The Figma MCP server, connected, with Figma's own skills available (`figma-design-to-code`)
- Tailwind CSS v4 in the target project
- Playwright in the target project, with Chromium:
  ```bash
  npm i -D @playwright/test && npx playwright install chromium
  ```
- Optional: the Codex CLI, authenticated, for the second-model review

## Use

Give the agent a Figma link to a frame or component and ask it to implement it, for example:

> Implement this design: https://www.figma.com/design/…?node-id=12-345

The skill scales to the job: a single component runs through one agent; a full page uses the decomposer, parallel section agents and the review.

## What you get

- Presentational components that follow your repo's conventions (language, lint rules, i18n, folders, existing primitives, animation library)
- A skeleton for every component with dynamic content
- A **data-wiring map**: for each component, its props contract, its skeleton, a suggested loading boundary, and whether it is a Server or Client Component
- A development-only preview route per node
- `docs/figma/<frame>.json`, the record that makes later design updates incremental

## Scripts

Run from the target project root.

| Script | Purpose |
|---|---|
| `scripts/verify-node.mjs` | numeric gate, states, motion, reduced motion, skeleton size, optional pixel diff; writes `report.json` |
| `scripts/purity-check.mjs` | fails if component files contain data logic or hardcoded fixture values |
| `scripts/spec-hash.mjs` | stable hash of a spec, for incremental updates |

The only runtime dependency is Playwright, resolved from the target project.

## Limits

- Timing of JS-driven animation (springs) is not verified by script; it is reported as a warning.
- The pixel comparison is a simple per-channel threshold. Text anti-aliasing differs between Figma and Chromium, so some diff on text is expected. The numeric gate is the one that decides.
- States other than hover, focus and active need their own preview state.
- Values, states and transitions missing from the Figma file are not invented: the skill asks.

## License

MIT
