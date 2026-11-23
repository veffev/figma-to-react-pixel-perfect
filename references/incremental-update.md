# Phase 7 and incremental updates

## Phase 7: distill and clean up

Only after the user approves the result.

1. Write `docs/figma/<frame>.json` (committed to the repo):

```json
{
  "figmaUrl": "https://www.figma.com/design/...",
  "fileKey": "...",
  "frameNodeId": "12:345",
  "branch": "next-app-router",
  "implementedAt": "YYYY-MM-DD",
  "components": [
    {
      "name": "PricingCard",
      "figmaNodes": ["45:120"],
      "path": "components/pricing-card.tsx",
      "kind": "server",
      "dataContract": [ { "prop": "title", "type": "string", "required": true } ],
      "specHash": "sha256:..."
    }
  ],
  "decisions": ["..."],
  "openIssues": ["..."]
}
```

`specHash` comes from `scripts/spec-hash.mjs`: sha256 of the node's `spec.json` with sorted keys, motion included, `fixture` excluded. Never hash the raw Figma output: it changes even when the design does not.

2. Show the user what will be deleted, then remove `.figma-work/<frame>/`. Do a full reset (including the distilled file) only if asked.
3. Update `docs/figma/components.json` with the shared components built or extended in this run, and keep their specs in `docs/figma/specs/<component>/` (`component-reuse.md`). Only page and one-off section specs are deleted.
4. Keep the preview route: updates need it, and it is excluded from production.

## Incremental update (the designer changed the frame)

1. Read `docs/figma/<frame>.json`. Regenerate `tree.json` and, for every saved node, its `spec.json` (including motion). Recompute the hashes.
2. Compare:
   - **same hash**: do not touch the component
   - **different hash**: only that node goes back to the decomposer and the implementer, with the diff between the old and the new spec
   - **new or removed node**: update the component tree and tell the user what to add or remove
3. A change in the `dataContract` (prop added, removed or renamed) must be **flagged prominently**: it breaks the data wiring the user wrote.
4. Re-verify the changed nodes and the sections that use them.
5. Report recent `get_comments`: they often explain why the design changed.
