# Layout intent (page and section frames)

A Figma frame is one snapshot of a layout at one size. Matching that snapshot at that size is necessary, not sufficient: the page must also behave correctly at every other size. A frame built with absolute positions still has a structure a developer would recognise at a glance. Reading that structure is part of the job.

**"Never invent" applies to values, not to structure.** Colours, sizes, spacing, timings come only from Figma. How those values hold together when the window changes is inferred here, written down, and verified.

## When this applies

Every node with `scope: page`, and any section that spans the frame's full width or height. Leaf components (button, card) keep the fixed-size spec.

## Step 1: read the intent

For the frame and each direct region, decide and record:

| Question | Evidence in Figma |
|---|---|
| Is this a single-screen design (no scroll intended)? | frame height is a device height; content fits; nothing continues below |
| What are the regions? (columns, header, footer, main) | groups of children, alignment, repeated gutters |
| What does each region do when the window grows or shrinks? | constraints (left / right / left+right / center / scale; top / bottom / top+bottom), auto-layout sizing (hug / fill / fixed) |
| What is anchored to an edge, and by how much? | equal margins on opposite sides, constraint pinned to an edge |
| What is centred, in what? | equal space on both sides, center constraint |
| What is decoration? | overlapping, rotated or floating layers with no layout role |

Typical readings:

- A panel with the same small margin on top, right and bottom, starting near 50%: **a column that fills the height**, not an 822×1101 box.
- A form block vertically centred in the left half: **centred content in a column**.
- A logo at top-left and a link at bottom-left with fixed offsets: **anchored to corners**.
- Floating shapes inside the panel: **decoration**, positioned in percentages of the panel.

If the reading is ambiguous in a way that changes the result (does the panel keep its aspect ratio or fill the height?), ask the user. One question, with the options.

## Step 2: write it into the page spec

Add `"scope": "page"` and a `responsive` block to the page's `spec.json` (schema: `assets/spec.schema.json`):

```json
"responsive": {
  "singleScreen": true,
  "minHeight": 640,
  "stackBelow": 1024,
  "derived": ["stackBelow", "minHeight"],
  "viewports": [[1280, 720], [1440, 900], [1920, 1080], [2560, 1333], [390, 844]],
  "mustRemain": ["3020:17838", "5256:21972"],
  "anchors": [
    { "figmaNode": "5256:21972", "within": "viewport", "edges": { "top": 8, "right": 32, "bottom": 8, "left": "50%+10" } },
    { "figmaNode": "2075:11870", "within": "viewport", "edges": { "top": 28.33, "left": 48 } }
  ],
  "centered": [{ "figmaNode": "3020:17838", "axis": "y", "within": "viewport", "offset": -16 }],
  "fractions": [],
  "noOverlap": [["3020:17838", "5256:21972"]]
}
```

- `singleScreen`: the page must not scroll vertically (above `minHeight`, and when not stacked).
- `minHeight`: below this window height, scrolling is acceptable.
- `stackBelow`: below this width the layout stacks; only overflow and `mustRemain` are checked there.
- `viewports`: always include the frame size's neighbours: one smaller laptop, one common desktop, one large monitor, and one phone when the page will be used on mobile.
- `anchors`: distance from the edges of `within` (`viewport` or a node id). A number is px; a string like `"50%+10"` is a percentage of `within` plus px.
- `centered`: centre of the node relative to the centre of `within`, with an optional px `offset`.
- `fractions`: `{ figmaNode, axis, of, value }` when a region keeps a share of its container.
- `noOverlap`: pairs that must never overlap.
- `mustRemain`: nodes that must stay rendered and inside the window.
- `derived`: the keys you inferred rather than read from Figma.

All offsets and margins come from the frame. Only the behaviour is inferred.

## Step 3: build the structure

- Page root: `min-h-dvh` (or `h-dvh` for a single-screen design). **Never use the frame height as a minimum or fixed height.**
- Regions: flex or grid. Columns as fractions, gutters and margins as the Figma px values.
- Anchored items: padding or margin on their region; `absolute` only when the item overlaps others.
- Fill regions: `flex-1`, `h-full`, `self-stretch`. A fill region takes **no fixed width or height**.
- Decoration inside a region that resizes: position and size in **percentages of that region** (computed from the frame values), so it scales with it. Record the conversion in `decisions/`.
- Images that fill a region: `object-cover` with the focal point from the design.
- `position: absolute` with frame pixel coordinates is allowed only for decoration and overlays, never for the page structure.

## Step 4: derive what one frame cannot tell you

With a single desktop frame, still deliver a page that works everywhere:

- between the smallest laptop and the largest monitor: fluid, following the anchors;
- below `stackBelow`: regions stack in reading order, with the same spacing tokens; decoration may be reduced.

Mark this as **derived** in the report and list it for the user to confirm, exactly like a derived skeleton. Do not stop at "desktop only".

## Step 5: verify

`verify-node.mjs` checks the numeric gate at the frame size and then every `responsive` rule at every viewport. See `verification.md`.
