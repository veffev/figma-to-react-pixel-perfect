# Flow playground: testing a flow with mock data

Static previews show each step. They do not show whether the flow **works**: whether clicking "Continue" reaches the next step, what the loading and error states look like in sequence, whether long content breaks a layout. Every flow with more than one step ships with a development-only playground where the user can walk through it with mock data, and a script that walks it automatically.

This does not change the scope. Components stay presentational and free of data logic. Mock data and the code that moves between steps live **only** in the development preview folder, never in components and never in production routes.

## When

Always, when the flow map has a route with two or more steps, or a single screen whose states the user needs to move between (empty, filled, loading, error, success). Build it as soon as the first two steps of a flow exist, not at the very end: the user tests while the rest is built.

## What to build

All inside the preview folder (`app/(dev)/figma-preview/` in Next, the dev-only preview folder in React):

```
figma-preview/
  flow-playground.tsx        from assets/preview-templates/flow-playground.tsx
  mocks/<flow>.ts            mock data for the flow
  flows/<flow>/page.tsx      the playground page of one flow
```

### 1. Mock data (`mocks/<flow>.ts`)

- Typed against the components' `dataContract`, so a contract change breaks the mock at compile time.
- At least these sets: `default` (the content of the Figma frames, from the spec fixtures), `empty` (no items, missing optional values), `long` (long names, long error messages, large numbers) and, where lists exist, `many`.
- Realistic values in the product's domain. No lorem ipsum.
- Mock data is the only place where sample content lives. `purity-check.mjs` still fails if any of it appears inside a component.

### 2. The playground page (`flows/<flow>/page.tsx`)

A client page that renders `FlowPlayground` with one entry per step of the flow map. Each entry renders the real step component with:

- props from the mock set;
- handlers wired to the flow controller: `flow.next()`, `flow.back()`, `flow.go(stepId)`, `flow.setState(name)`;
- `await flow.simulate()` for anything that would be a request in production: it sets the state to `loading`, waits for the chosen latency, then resolves `true` (state back to `default`) or `false` (state `error`, when "fail next" is on).

```tsx
{
  id: 'email',
  states: ['loading', 'error'],
  render: (flow) => (
    <EmailStep
      email={email}
      status={flow.state === 'loading' || flow.state === 'error' ? flow.state : 'default'}
      errorMessage={mock.errorMessage}
      onEmailChange={setEmail}
      onSubmit={async () => {
        if (await flow.simulate()) flow.next()
      }}
    />
  ),
}
```

Values the user types that later steps display (an email, a name) are kept in the page's local state and passed on, so the flow feels real.

If the flow has a shared shell, pass it as `shell` so steps render inside it. Follow the repo's conventions when adapting the template (JavaScript-only repo: `.jsx` without types; export style; lint rules).

### 3. What the user gets

A floating control bar on the playground page:

- a button per step, to jump anywhere;
- a state selector for the current step (default, loading, error, plus the step's own states);
- a latency selector (0, 600, 2000 ms) to see loading states;
- a "fail next" toggle to send the next simulated request to the error state.

The container exposes `data-flow`, `data-flow-step` and `data-flow-state`, which the walk script reads.

Tell the user the URL of each playground in the report, for example `http://localhost:3000/figma-preview/flows/<flow>`.

## The walk: `flow-walk.json`

Write one per flow in `.figma-work/<flow>/flow-walk.json`, from the flow map. It lists the steps in order and the user actions that lead from each to the next, addressed by `data-figma-node`:

```json
{
  "flow": "flow-a",
  "steps": [
    { "id": "step-1", "root": "1:10", "actions": [{ "click": "1:12" }] },
    {
      "id": "step-2",
      "root": "1:20",
      "actions": [
        { "fill": "1:21", "value": "ada@example.com" },
        { "click": "1:22", "expectState": "loading" }
      ]
    },
    { "id": "step-3", "root": "1:30", "expectVisible": ["1:32"] }
  ]
}
```

Actions: `click`, `fill` (with `value`), `press` (with `key`), `check`. `expectState` asserts the flow state right after an action. `expectVisible` asserts nodes that must be on screen in that step.

## Verification

```bash
node <skill>/scripts/verify-flow.mjs \
  --walk .figma-work/<flow>/flow-walk.json \
  --url http://localhost:3000/figma-preview/flows/<flow>
```

The script opens the playground, and for every step: waits for it to be reached, checks its root node is visible, takes a screenshot (`flow-<step>.png`), performs the actions. It fails when a step is not reached, an action target is missing, an expected state or node does not show up, or the page logs a runtime error. It writes `flow-report.json`.

Run it after the per-node verification. A flow whose steps all pass the numeric gate but which cannot be walked is not done.

The walk covers the happy path end to end. How the error and loading states **look** is verified separately, by each state's own spec through the preview's `?state=` parameter. The user explores the unhappy paths by hand with the "fail next" toggle.

## In the final report

- the playground URL of every flow;
- the mock sets available;
- the result of each walk (steps visited, failures);
- the **flow contract** for the user's real wiring: for each step, the handlers the component expects (`onSubmit`, `onContinue`) and which production action each one stands for.
