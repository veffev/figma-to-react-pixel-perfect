# Figma to CSS mapping

Figma's `figma-design-to-code` skill owns the general translation. This table covers the cases that most often go wrong.

| Figma | CSS / Tailwind |
|---|---|
| Auto layout horizontal / vertical | `flex flex-row` / `flex flex-col` |
| Gap | `gap-[Npx]` or a token |
| Padding | exact `pt/pr/pb/pl`; only use `p-*` when all four match |
| Hug contents | intrinsic size (no `w-*`) |
| Fill container | `flex-1`, `self-stretch` or `w-full`, depending on the axis |
| Fixed | `w-[Npx]` / `h-[Npx]` |
| Space between | `justify-between` |
| Wrap | `flex-wrap` with `gap-x` / `gap-y` |
| Absolute position | `relative` on the parent, `absolute` plus offsets on the child |
| Stroke **inside** | `shadow-[inset_0_0_0_1px_<color>]`, or `border` while compensating the padding |
| Stroke **outside** | `outline`, or `shadow-[0_0_0_1px_<color>]` |
| Letter spacing in % | em = value / 100 (for example -2% is `tracking-[-0.02em]`) |
| Line height in % or Auto | exact px or ratio; never leave it to `leading-normal` |
| Drop shadow | `shadow-[x_y_blur_spread_color]` with exact values |
| Layer blur / background blur | `blur-[Npx]` / `backdrop-blur-[Npx]` |
| Layer opacity | `opacity-*` on the node, not on the colour |
| Clip content | `overflow-hidden` |
| Text truncation | `truncate` or `line-clamp-N` |

## Checks before writing the spec

- hug / fill / fixed not confused
- stroke position (inside vs outside) reflected in the box size
- letter spacing converted from % correctly
- line height explicit, never Auto left to the browser
- asymmetric padding not collapsed into `p-*`
- layer opacity not moved onto the fill colour
