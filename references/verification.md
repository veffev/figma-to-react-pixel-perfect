# Phase 5: verification

Run by a verifier agent that did not write the code. Start the dev server, open the preview route, run the scripts from the project root.

```bash
node <skill>/scripts/verify-node.mjs \
  --spec .figma-work/<frame>/nodes/<id>/spec.json \
  --url http://localhost:3000/figma-preview/<id> \
  --figma .figma-work/<frame>/nodes/<id>/figma.png \
  --skeleton-url "http://localhost:3000/figma-preview/<id>?state=skeleton"

node <skill>/scripts/purity-check.mjs \
  --spec .figma-work/<frame>/nodes/<id>/spec.json <component files...>
```

`verify-node.mjs` options:

| Option | Meaning |
|---|---|
| `--spec` | path to `spec.json` (required) |
| `--url` | preview URL (required) |
| `--figma` | Figma screenshot for the pixel diff |
| `--skeleton-url` | preview URL of the skeleton state |
| `--out` | output directory (default: next to the spec) |
| `--root` | root selector (default: `[data-figma-node="<nodeId>"]`) |
| `--box-tolerance` | px tolerance for boxes (default 1) |
| `--max-pixel-diff` | fail above this percentage (default: not gating) |
| `--executable` | path to a Chromium binary, if not the Playwright one |
| `--viewports` | override the spec's viewports, for example `1280x720,1920x1080` |
| `--responsive-url` | URL for the multi-viewport pass, if different from `--url` (for example the real route) |

It writes `report.json`, `impl.png`, and `diff.png`, and exits 1 when there are failures.

## What is checked

1. **Numeric gate (the main one).** For every element found through `[data-figma-node]`: bounding box against `box` (±1px) and computed style against `style` (exact; ±0.5px on fractional values). Root size against `frame`, root layout against `layout`. An element of the spec missing from the DOM is a failure.
2. **States.** For `hover`, `focus` and `active`: trigger, wait for transitions, compare the expected styles.
3. **Motion.**
   - `transition`: computed `transition-property`, `-duration`, `-delay`, `-timing-function`.
   - `keyframes`: computed `animation-*` values, or a snapshot of `getAnimations()` taken at load for WAAPI animations; keyframes compared on `opacity` and `transform`.
   - `js`: timing cannot be read; reported as a warning. The final state is still covered by the numeric gate.
   - A motion entry with no matching animation is a failure, exactly like a wrong padding.
4. **Reduced motion.** With `prefers-reduced-motion: reduce` the final boxes must still be correct.
5. **Skeleton.** Same outer box as the component with data (±1px).
6. **Other window sizes (pages).** For every viewport in `spec.responsive.viewports`: no horizontal overflow; no vertical scroll when the design is single-screen; `mustRemain` nodes rendered and inside the window; `anchors`, `centered`, `fractions` and `noOverlap` hold. One screenshot per viewport is saved as `viewport-<w>x<h>.png`: look at them. A page spec without `responsive` produces a warning, and the page is not done.
7. **Pixel diff (secondary).** Screenshot at `deviceScaleFactor = screenshotScale`, fonts ready, finite animations finished, infinite ones stopped. Compared with `figma.png`. Different dimensions are a failure. A high diff with a green numeric gate usually means font rendering or an element that is not in the spec: investigate, do not ignore.
8. **Purity.** No `fetch(`, no data-library imports, no fixture values hardcoded in component files.

## Flows

After the per-node checks, walk each flow in its playground:

```bash
node <skill>/scripts/verify-flow.mjs \
  --walk .figma-work/<flow>/flow-walk.json \
  --url http://localhost:3000/figma-preview/flows/<flow>
```

It fails when a step is not reached, an action target is missing, an expected state or node does not appear, or the page logs a runtime error. It writes `flow-report.json` and one screenshot per step. See `flow-playground.md`.

## Report and fix loop

`report.json` lists numeric deviations:

```json
{ "pass": false, "pixelDiff": 2.4, "failures": [
  { "figmaNode": "45:121", "property": "padding-top", "expected": 24, "actual": "20px" },
  { "figmaNode": "45:130", "property": "motion.duration", "expected": 600, "actual": 300 }
], "warnings": [] }
```

The implementer receives the report (with `diff.png` as support) and fixes from the numbers. At most 3 rounds per node. After the 2nd failed round, escalate (see `codex.md`). Whatever is still open goes into the final report with its likely cause.

## Notes on the script

- While it runs, link clicks and form submits are prevented, so triggering `active` on a link does not navigate away.
- The Next.js dev overlay is hidden before screenshots.
- It waits for the root node to be attached, so a preview that streams inside `<Suspense>` works.

## Known limits

- The pixel comparison is a simple per-channel threshold, less forgiving of anti-aliasing than pixelmatch. Text anti-aliasing differs between Figma and Chromium, so some diff on text is normal.
- JS-driven animation timing is not verified by script.
- States other than hover, focus and active need their own preview state and spec.
