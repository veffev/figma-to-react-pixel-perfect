# Preview templates

Development-only pages that render one Figma node at its frame width, with the spec's `fixture` as props. The verification scripts open these pages.

| File | Where it goes |
|---|---|
| `next-page.tsx` | `app/(dev)/figma-preview/[node]/page.tsx` (Next App Router) |
| `react-preview.tsx` | a route such as `/figma-preview/:node`, registered only in development (React) |
| `flow-playground.tsx` | next to the preview (`app/(dev)/figma-preview/flow-playground.tsx`); used by one page per flow under `flows/<flow>/` with mock data from `mocks/<flow>.ts` |
| `registry.tsx` | next to the preview: `app/(dev)/figma-preview/registry.tsx`, or beside `react-preview.tsx` |

Each implementer adds one entry to the registry, keyed by the node id in its URL form (`45-120`):

```tsx
previews['45-120'] = {
  width: 384,
  render: (state) =>
    state === 'skeleton' ? <PricingCardSkeleton /> : <PricingCard title="Pro plan" price={29} features={['Unlimited projects']} />,
}
```

Notes:

- Adapt the templates to the repo: in a JavaScript-only repo rename to `.jsx` and drop the types; follow its export style and lint rules.
- Never place the preview in a folder starting with `_`: App Router treats it as private and creates no route.
- A page node uses `width: 'viewport'`, so the script can resize the window and check the layout at several sizes.
- The Next template renders inside `<Suspense>` because it reads `params` and `searchParams`; the verification script waits for the node to appear.
- Fixture values live only in the registry, never inside components.
