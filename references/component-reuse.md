# Reusable components across screens and designs

A design with several screens, or a second design in a project that already has one, almost always repeats the same pieces with small differences: a form field, a card, a list row, a section header. Building each occurrence separately duplicates code and lets the copies drift. Recognising what is really one component, and making it dynamic enough to serve every occurrence, is part of decomposition.

## When this applies

- The input has more than one screen (together with `flow-analysis.md`, before any code).
- The project already contains components built by an earlier run: `docs/figma/components.json` exists.
- A single screen repeats a pattern (already covered by the basic rule in `decomposer.md`; the rules below refine it).

## Step 1: read what already exists

1. `docs/figma/components.json`, if present: the registry of components built from Figma so far, with their variants, props and the Figma components they came from.
2. The repo's own shared components (`components/ui` and equivalents), their props and variant mechanism (CVA, variant props, compound components).

A candidate that matches something existing is **reused or extended**, never rebuilt next to it.

## Step 2: collect candidates across all screens

Look across every screen of the input, not one screen at a time:

- **Figma components**: instances that share a `componentId` or belong to the same component set. Variants of the set are variants of one React component.
- **Lookalikes**: subtrees with the same shape (same node types in the same order, same layout mode) whose text, colours or sizes differ. Detached copies and hand-duplicated groups are the usual case. Designers do not always componentise; the skill still should.
- **Component sheets**: a frame that lays out variants and states is the definition of a component, not a screen.

Record each candidate with every place it occurs (`usedIn`: node ids and screens).

## Step 3: compare the occurrences

For each candidate, line up its occurrences and sort every difference into one of these:

| What differs | Becomes |
|---|---|
| Text, image, number (content) | a prop in the `dataContract` |
| A discrete visual change (colour scheme, emphasis, density) | a `variant` prop, with the repo's variant mechanism |
| A discrete size change | a `size` variant; or no prop at all if the component simply fills its container |
| A part that is present in some occurrences only (icon, badge, helper text) | an optional prop or a slot (`children`, a named `ReactNode` prop) |
| Interactive or data condition (hover, error, loading, disabled, empty) | a state of the same component |
| A different inner structure in one region | a slot: the parent passes the region in |
| Position or spacing around it | not the component's concern: the parent's layout |

Identical values across occurrences stay inside the component. Use the exact Figma values of each variant; a variant is specified, not interpolated.

## Step 4: decide, with these rules

**Make it one dynamic component when**

- the occurrences have the same role and the same structure, and
- every difference fits the table above, and
- the result needs a handful of props and variants, with no branching layout inside.

**Keep them separate when**

- they only look alike but mean different things (a pricing card and a profile card);
- merging needs a pile of boolean flags or `if` branches for layout: that is two components sharing a smaller one;
- an occurrence differs in most of its structure.

**Prefer composition to configuration.** When occurrences share a frame but differ in content, build the frame as a component with slots and let each use fill them. Small shared parts (label, icon wrapper, badge) are extracted before big ones.

**Do not over-abstract.** A component is shared only with two or more real occurrences in the designs at hand (or one occurrence plus an existing component in the repo). Never add a prop or a variant for a case that no frame shows.

**Name by role, not by screen**: `FormField`, not `LoginEmailInput`.

## Step 5: extending a component that already exists

When a new design needs an existing shared component in a form it does not support yet:

1. Propose the extension (new variant, new optional prop or slot) and list where the component is used today.
2. Add it without changing the output of existing usages.
3. Re-run verification on **every saved spec of that component**, not only the new one (see the registry below). A shared component that changes is re-verified everywhere.
4. If the new case cannot be added without changing existing usages, stop and ask: it may be a different component.

## Step 6: show the inventory and ask

Together with the flow map (or on its own for a single screen with many patterns), show the user:

| Component | Used in | Variants | Props | Decision |
|---|---|---|---|---|
| `FormField` | 9 screens | `default`, `error`, `disabled` | `label`, `value`, `helperText?`, `leadingIcon?` | one dynamic component |
| `SocialButton` | 6 screens | `brand`: 3, `state`: 4 | `href` | reuses `components/ui/button` |
| `PlanCard` / `ProfileCard` | 2 + 1 | - | - | kept separate: different role and structure |

Plus the open questions ("are these two cards the same component with a `featured` variant?"). Wait for the answer before writing code, as for the flow map. Record the decisions in `decisions/`.

## The registry: `docs/figma/components.json`

Committed to the repo, updated at the end of every run. It is how the next design finds what the previous one built.

```json
{
  "components": [
    {
      "name": "FormField",
      "path": "components/form-field.tsx",
      "figmaComponents": ["3012:17352"],
      "variants": { "state": ["default", "error", "disabled"] },
      "dataContract": [
        { "prop": "label", "type": "string", "required": true },
        { "prop": "helperText", "type": "string", "required": false }
      ],
      "slots": ["leadingIcon"],
      "usedIn": ["log-in-entry", "sign-up-details"],
      "specs": ["docs/figma/specs/form-field/default.json", "docs/figma/specs/form-field/error.json"]
    }
  ]
}
```

The specs of **shared** components are kept (in `docs/figma/specs/<component>/`, one per variant or state) instead of being deleted at cleanup, so a later extension can be regression-checked. Specs of pages and one-off sections are still deleted, leaving only their hashes.

## Verification

- Each variant and state shown in the designs has its own spec and its own preview state.
- A shared component is verified in isolation (wave 1) and again inside each screen that uses it.
- After an extension, all specs listed in the registry for that component are re-run.
- The final report lists, per shared component: where it is used, its variants, its props contract, and what was kept separate and why.
