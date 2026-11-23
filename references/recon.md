# Phase 0: repo recon

Output: `shared/context.md`, with the branch on the first line. Read, do not assume.

## Branch

From `package.json`:

- `next` and an `app/` directory: **Next App Router**
- `next` and only `pages/`: treat as the React branch (no Server Components)
- otherwise: **React** (Vite or another bundler)

## Conventions to record

- **Repo instruction files**: `CLAUDE.md`, `AGENTS.md`, rule READMEs. Follow them.
- **Language**: TypeScript or JavaScript only. In a JS repo: no types, props contract as JSDoc, no `tsc`.
- **ESLint rules**, including local ones (for example one component per file, no comments, no hardcoded UI text). Generated code must pass them.
- **i18n**: if a message catalog exists, static text goes there in every language present, never as a literal in JSX.
- **Structure and naming**: where components live (colocated next to the route, feature folders, `components/ui`), default or named exports, barrel files, path aliases, file-name casing.
- **Existing primitives**: `components/ui`, `cn()`, CVA, Radix or shadcn. Reuse them.
- **CSS**: the file holding `@theme`, existing tokens (colours, typography, radius), **custom breakpoints**, custom utilities.
- **Animation**: the library already present (`motion`, `framer-motion`), shared variants or helpers, the repo's own hooks, `tw-animate-css`. Reuse what exists; never add a second library.
- **Composition pattern**: how the repo separates the piece that owns data from the piece that draws, and how it names skeletons. Use this only to **name and place** UI components consistently, not to write data code.
- **Routing and flows**: the route tree, route groups and layouts; how existing multi-step flows work (local state, search param, nested routes, store) and in which files; how states are modelled. Needed whenever the input has several screens (`flow-analysis.md`).
- **Fonts**: how they are loaded (`next/font`, Fontsource, `@font-face`) and which CSS variables expose them.
- **Playwright**: existing config, base URL, how the dev server starts.

## Gates

- Tailwind below v4: stop and ask whether to migrate.
- A font used in the frame is not available in the project: stop and ask. No fix loop recovers a wrong font.

## Existing implementation

If `docs/figma/<frame>.json` exists, switch to `incremental-update.md`.

If `docs/figma/components.json` exists, read it: it lists the shared components earlier runs built from Figma, with their variants and props. They are reused or extended, not rebuilt (`component-reuse.md`).
