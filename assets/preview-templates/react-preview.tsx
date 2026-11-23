import { previews } from './registry'

export const FigmaPreview = () => {
  if (!import.meta.env.DEV) return null

  const params = new URLSearchParams(window.location.search)
  const node = window.location.pathname.split('/').filter(Boolean).pop() ?? ''
  const entry = previews[node]
  if (!entry) return null

  return (
    <div style={{ width: entry.width === 'viewport' ? '100%' : entry.width }}>
      {entry.render(params.get('state') ?? undefined)}
    </div>
  )
}
