# Phase 3: deterministic spec

For each node of the component tree call `get_design_context` and `get_screenshot` on **that node only** (never on a whole long page: it saturates context and leads to approximation). If the node is marked `motion: true`, also call `get_motion_context` on it.

Save the screenshot as `nodes/<nodeId>/figma.png` and note its scale. Then write `nodes/<nodeId>/spec.json` (schema: `assets/spec.schema.json`) with normalised values: no temporary URLs, no volatile fields.

## Shape

```json
{
  "nodeId": "45:120",
  "component": "PricingCard",
  "frame": { "width": 384, "height": 520, "screenshotScale": 2 },
  "layout": { "display": "flex", "direction": "column", "gap": 24, "padding": [32, 32, 32, 32] },
  "elements": [
    {
      "figmaNode": "45:121",
      "role": "title",
      "bind": "title",
      "box": { "x": 32, "y": 32, "w": 320, "h": 32 },
      "style": {
        "fontFamily": "Inter", "fontSize": 24, "fontWeight": 600,
        "lineHeight": 32, "letterSpacing": -0.48, "color": "rgb(11, 11, 15)"
      }
    }
  ],
  "states": { "hover": { "45:120": { "backgroundColor": "rgb(245, 245, 250)" } } },
  "motion": [
    {
      "figmaNode": "45:120", "trigger": "hover", "kind": "transition",
      "properties": ["background-color"], "duration": 200, "delay": 0,
      "easing": "cubic-bezier(0.2, 0, 0, 1)"
    },
    {
      "figmaNode": "45:130", "trigger": "mount", "kind": "keyframes",
      "duration": 600, "delay": 100, "easing": "cubic-bezier(0.16, 1, 0.3, 1)", "iterations": 1,
      "keyframes": [
        { "offset": 0, "opacity": 0, "transform": "translateY(16px)" },
        { "offset": 1, "opacity": 1, "transform": "translateY(0px)" }
      ]
    }
  ],
  "fixture": { "title": "Pro plan", "price": 29, "features": ["Unlimited projects"] }
}
```

## Rules

- `box` is relative to the node's own top-left corner, in CSS pixels.
- `style` keys are camelCase CSS property names. Numbers are pixels, except `fontWeight` and `opacity`. Colours are `rgb()` / `rgba()` strings.
- `bind` links an element to a prop of the `dataContract`.
- `fixture` holds the exact values shown in the frame. It feeds the preview and the verification. It must **not** end up inside components.
- `motion[].kind` is `transition`, `keyframes`, or `js` (springs and other JS-driven animation).
- Durations and delays are milliseconds.
- `states` keys the script can trigger: `hover`, `focus`, `active` (alias `pressed`). Other states (open, selected, empty, error, loading) are verified through the preview route's `?state=` parameter with their own spec.

## Tokens

Reuse the tokens already in `@theme`. Add new ones there (CSS-first, no `tailwind.config.js`), including `--ease-*` and `--animate-*` with `@keyframes`:

```css
@theme {
  --color-brand-500: #4f46e5;
  --text-body: 1rem;
  --text-body--line-height: 1.5rem;
  --text-body--letter-spacing: -0.01em;
  --radius-card: 1.25rem;
  --ease-emphasized: cubic-bezier(0.2, 0, 0, 1);
  --animate-rise: rise 600ms cubic-bezier(0.16, 1, 0.3, 1) 100ms both;
  @keyframes rise {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
}
```

- Recurring values become tokens. One-off values use an arbitrary value (`gap-[18px]`).
- Never round to the nearest step of the scale.
- If the repo has custom breakpoints, use those.
- Check utilities against the docs for the installed Tailwind version.

## Responsiveness

A page spec carries `"scope": "page"` and a `responsive` block: see `layout-intent.md` for how to derive and write it. Without it, the script can only check the frame size and warns about it.

- Several frames for several breakpoints: extract all of them, one spec per frame, and map the differences onto the repo's breakpoints.
- A single frame: match it exactly at its size, make it fluid around that size from the Figma constraints, and derive the stacked layout for narrow windows. Mark what was derived and list it for the user to confirm. Never deliver "desktop only".
