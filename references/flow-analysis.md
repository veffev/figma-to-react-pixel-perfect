# Flow analysis (several frames at once)

Use this whenever the input contains more than one screen: a section, a page of the Figma file, a container frame, or several links. It runs **before** decomposition and **before any code**.

A frame is not a page. Several frames can be different routes, steps of one flow, states of one screen, or breakpoints of one layout. Treating each frame as its own page duplicates code and gets the architecture wrong.

## Step 1: project context first

The decomposer reads the project before it reads the frames. What the project already does decides how the flow is built. Record in `shared/context.md`:

- **Routes that exist**: the `app/` tree (or the router config in a React project), route groups, dynamic segments.
- **Shared shells**: existing layouts (`layout.tsx`, wrapper components) and which routes use them. A shell that already exists is reused, not rebuilt.
- **How multi-step flows are done here**: find one or two existing flows (onboarding, checkout, signup) and note the mechanism: local state, a URL search param, nested routes, a context or store, a stepper component. Name the files.
- **How states are modelled**: variant props, discriminated unions, a `status` prop, separate components.
- **Where the feature belongs**: the folder and naming the repo would use for this flow.
- **What already exists for this flow**: pages, components or routes that these frames are meant to replace or extend.

The project's existing pattern wins. If it uses a search param for steps, propose a search param.

**Empty or new project** (nothing to learn from): say so, propose a default, and ask. Default: one route per flow, steps as states inside that route, one shared layout for the common shell.

## Step 2: inventory the frames

- `get_metadata` on the input node. If a container comes back **without children**, drill into it (call `get_metadata` on it; if it is still empty, use `get_design_context` on it only to list the screens) until every screen has an id, a name and a size.
- One row per screen in `shared/flow-map.json`: node id, name, size, and one screenshot (`get_screenshot`) for reference.
- Do **not** call `get_design_context` on every screen yet. That happens per node, later, and only for the parts that differ.

## Step 3: find what is shared and what changes

Compare the screens' trees (names, types, positions, sizes of the first two levels):

- **Shell**: nodes identical in every screen of a group (logo, side panel, footer link). Built and verified once.
- **Changing region**: the part that differs between screens. This is what each step or state implements.
- Screens with a different shell belong to a different group.

## Step 4: classify each screen

| Relation | Evidence | Becomes |
|---|---|---|
| Different flows | different purpose, entry points, names ("Log in", "Sign up") | separate routes |
| Steps of one flow | same shell, sequence in names or prototype links, each step leads to the next | steps inside one route (mechanism from Step 1) |
| States of one step | same content, different condition (empty, filled, error, loading, disabled, success) | states of the same component |
| Breakpoints | same content at different widths | one layout, mapped to the repo's breakpoints |
| Component sheets | a frame of variants | the component's variants and states, not a screen |

Use prototype connections when Figma has them. Otherwise use names, order on the canvas, and content. When a screen fits two rows, do not guess: list it as a question.

## Step 4b: component inventory

With all screens in view, build the inventory of reusable components (`component-reuse.md`): what repeats across screens, what varies between occurrences, what becomes one dynamic component. Show it to the user together with the flow map.

## Step 5: write the flow map and stop

`shared/flow-map.json` (schema: `assets/flow-map.schema.json`):

```json
{
  "input": { "fileKey": "...", "nodeId": "1:2", "name": "01 · Auth" },
  "projectPattern": { "steps": "search param ?step= (see app/onboarding/page.tsx)", "shell": "app/(auth)/layout.tsx does not exist yet" },
  "shells": [
    { "id": "auth-shell", "figmaNodes": ["2075:11870", "5256:21972"], "target": "app/(auth)/layout.tsx", "reuse": null }
  ],
  "routes": [
    {
      "path": "/login",
      "shell": "auth-shell",
      "stepMechanism": "state",
      "steps": [
        { "id": "entry", "figmaNode": "1:96", "states": { "default": "1:96" } },
        { "id": "email", "figmaNode": "1:140", "states": { "default": "1:140", "error": "1:152", "loading": "1:160" } },
        { "id": "check-inbox", "figmaNode": "1:171", "states": { "default": "1:171" } }
      ]
    }
  ],
  "componentSheets": ["3012:17352"],
  "questions": ["Is 1:180 a step of /login or the start of /reset-password?"]
}
```

Then **show the map to the user and wait**: routes, shells, steps, states, the mechanism chosen and the project file it was copied from, and the open questions. Whether a step is a route or a state is an architecture decision; it is the user's. Do not write code before the answer. Record the answer in `decisions/`.

## Step 6: implement group by group

1. Shells first (one page-level spec each, with its `responsive` block: `layout-intent.md`).
2. Shared components (wave 1).
3. One route at a time. Each step is a presentational component. The route gets a presentational **flow container** that receives the current step and state as props and renders the right step. What advances the flow (submit, verification, navigation) is the user's logic, not this skill's.
4. Step specs cover the **changing region only**; the shell is not re-specified or re-verified per step.
5. States of a step are separate spec files only for what differs from the default state.

## Step 7: preview and verification

- One preview entry per step, with `?state=` for its states. Entries render the step inside its shell when the box coordinates depend on it.
- Verify each step and state against its own frame. Verify the shell once, at all viewports.
- In the final report, the data-wiring map includes the **flow contract**: the step and state props of each flow container, and which user action is expected to move between steps.

## Cost

Work scales with the number of **distinct changing regions**, not with the number of frames. Report the plan's size with the flow map (shells, routes, steps, states) so the user can choose to do one route first.
