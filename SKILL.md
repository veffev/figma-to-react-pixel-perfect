---
name: figma-to-react-pixel-perfect
description: Implements the UI layer of a Figma design in React or Next.js (App Router) with Tailwind v4, pixel-perfect and including animations. Produces presentational components, skeletons and a props contract, with no data-fetching code. Uses a decomposer, parallel section agents, an optional Codex review, and a scripted Playwright check against the Figma spec. Use when the user shares a Figma link or node and asks to implement, build or match a design in a React or Next.js codebase, or to update an implementation after the design changed.
---

# Figma to React / Next.js, pixel-perfect (UI layer only)

## Scope

This skill builds the **UI layer**: presentational components, skeletons, states, animations, tokens, and a **props contract** describing the data each component needs.

It writes **no data logic**: no `fetch`, no SWR / TanStack Query / Apollo, no server actions, no HTTP clients, no data providers. Every project has its own server and client data libraries. The user wires data using the contract this skill produces. If the user explicitly asks to connect data, do it as separate work, following the repo's conventions, after the UI is verified.

## Principles

1. **The spec is the test.** Whatever is in `spec.json` is checked by script.
2. **Numbers beat pixels.** The gate is the numeric comparison; the pixel diff is a secondary signal.
3. **Files beat conversation.** All shared context lives on disk.
4. **Never invent values.** A value, state or transition missing from Figma is an issue and a question to the user, never a silent default.
5. **Do infer structure.** A frame is one snapshot at one size. Read the layout intent behind it (columns, what fills, what is anchored, what is centred) and build that, so the page is right at every window size, not only at the frame's. A page that only works at the frame size is not done.
6. **Animations are requirements**, not polish.
7. **Repo conventions win** over this skill's defaults.

## Requirements

- Figma MCP server. Load Figma's own `figma-design-to-code` skill before the first `get_design_context` and follow it for extraction, URL parsing and assets. It does not have to be installed in the project: if it is not among the available skills, read it from the Figma MCP server as the resource `skill://figma/figma-design-to-code/SKILL.md`. If neither works, continue with `get_design_context` and say in the final report that Figma's skill was not loaded. If `figma-implement-motion` is available, load it for motion data; otherwise call `get_motion_context` directly. Call `create_session` as soon as the `fileKey` is known and pass `sessionId` to every Figma tool.
- Playwright in the target project (`@playwright/test` or `playwright`) with Chromium installed. The scripts have no other dependency.
- Tailwind CSS v4.
- Optional: Codex CLI, authenticated, for the second-model review.

## Scale the pipeline to the job

| Job | Pipeline |
|---|---|
| One component | One agent: extract, spec, implement, verify |
| One section | Same, plus Codex review |
| A full page | Full pipeline below |
| Several screens (a section, a flow, several links) | Flow analysis first (`references/flow-analysis.md`), user confirms the flow map, then the full pipeline one group at a time |

## Phases

Read the reference file for a phase when you reach it, not before.

| # | Phase | Who | Reference |
|---|---|---|---|
| 0 | Repo recon: branch (Next / React), conventions, gates | orchestrator | `references/recon.md` |
| 1 | Figma extraction: metadata, variables, comments, motion inventory | orchestrator | Figma's `figma-design-to-code` |
| 1b | Flow analysis, only with several screens: project routing and flow patterns, shared shells, routes vs steps vs states; **stop for user confirmation** | decomposer subagent | `references/flow-analysis.md` |
| 2 | Decomposition: component tree, static vs dynamic, props contract, server/client | decomposer subagent | `references/decomposer.md`, `references/component-reuse.md`, `references/layout-intent.md` |
| 3 | Deterministic spec per node (`spec.json`), tokens | orchestrator | `references/spec.md`, `references/figma-css-mapping.md` |
| 4 | Implementation in two waves: shared components, then sections in parallel | implementer subagents | `references/implementation.md`, `references/motion.md` |
| 5 | Verification with the bundled scripts, fix loop | verifier subagent | `references/verification.md` |
| 6 | Integration, repo checks, final report with the data-wiring map | orchestrator | `references/implementation.md` |
| 7 | Distill to `docs/figma/<frame>.json`, clean up (after user approval) | orchestrator | `references/incremental-update.md` |

If `docs/figma/<frame>.json` already exists, this is an update: go to `references/incremental-update.md`.

Codex review and escalation: `references/codex.md`.

## Shared memory

Work in `.figma-work/<frame>/` (add it to `.gitignore`). It is the only memory every agent, subagent and Codex see the same way.

```
shared/context.md            # written by: orchestrator
shared/flow-map.json         # written by: decomposer   (schema: assets/flow-map.schema.json), several screens only
shared/component-tree.json   # written by: decomposer   (schema: assets/component-tree.schema.json)
shared/board.json            # written by: orchestrator
shared/decisions/<agent>.md  # append-only, one file per agent
shared/issues/<agent>.md     # missing values, conflicts, questions for the user
nodes/<nodeId>/spec.json     # schema: assets/spec.schema.json
nodes/<nodeId>/figma.png, impl.png, diff.png, report.json
```

- One writer per file.
- Each agent reads `context.md`, its own node of the tree, and its own spec. Not everything.
- Check `component-tree.json` before creating a component: if it exists, import it; otherwise open an issue.
- An instruction that contradicts a recorded decision: stop and flag it.

## Roles

- Orchestrator and decomposer: the strongest model available.
- Implementers: a mid-tier model, one per section, in parallel.
- Verifier: a different agent from the one that wrote the code.

## Scripts

Run from the target project root so Playwright resolves from the project.

```bash
# numeric gate, states, motion, optional pixel diff -> report.json (exit 1 on failures)
node <skill>/scripts/verify-node.mjs --spec .figma-work/<frame>/nodes/<id>/spec.json \
  --url http://localhost:3000/figma-preview/<id> --figma .figma-work/<frame>/nodes/<id>/figma.png

# no data logic and no fixture values inside the produced components
node <skill>/scripts/purity-check.mjs --spec .figma-work/<frame>/nodes/<id>/spec.json <files...>

# stable hash of a spec, used for incremental updates
node <skill>/scripts/spec-hash.mjs .figma-work/<frame>/nodes/<id>/spec.json
```

## Always

- No data logic, in any phase.
- A frame is not a page. With several screens, never create one route per frame without the flow analysis and the user's confirmation.
- The decomposer reads the project (routes, layouts, existing flows) before it decides structure; the project's existing pattern wins.
- Pieces that repeat across screens or across designs become one dynamic component (props, variants, slots), found before any code is written and recorded in `docs/figma/components.json` so later designs reuse them (`references/component-reuse.md`). Never rebuild a component that already exists.
- Never use the frame's height or width as a fixed or minimum size of a page, and never build page structure with absolute frame coordinates (`references/layout-intent.md`).
- A page is verified at several window sizes, not only at the frame size.
- The screenshot is for comparison only, never for estimating values.
- Never replace a Figma value with the nearest step of the Tailwind scale.
- Inconsistent design (15px and 16px for the same role): flag it and ask, do not normalise silently.
- What stays unresolved after the fix loop is reported with its likely cause, never hidden.
