# Second model: Codex

Optional. Skip when the Codex CLI is not installed or not authenticated, and say so in the final report.

## Review (default from a section upwards)

```bash
git diff > .figma-work/<frame>/nodes/<id>/diff.patch
codex exec --sandbox read-only \
  -o .figma-work/<frame>/nodes/<id>/codex-review.md \
  "Read spec.json and diff.patch in .figma-work/<frame>/nodes/<id>/ and .figma-work/<frame>/shared/context.md. List: values that diverge from the spec (layout, typography, colours, motion durations, easings, keyframes), motion or states entries that are not implemented, any data logic or hardcoded content inside components, repo conventions that are violated. Format: file:line | expected | found."
```

Apply a Codex finding only when the spec or the Phase 5 measurement confirms it.

## Escalation

A node that still fails after 2 fix rounds: Codex implements it in a separate git worktree (`codex exec --sandbox workspace-write ...`), with the same spec and the same fixed instruction. Both versions go through verification; the one with fewer measured deviations wins.

## Disagreement

When the two models disagree, the measurement decides, not either model. Record the disagreement and its resolution in `decisions/`.
