import { Suspense } from 'react'
import { notFound } from 'next/navigation'

import { previews } from '../registry'

type PreviewPageProps = {
  params: Promise<{ node: string }>
  searchParams: Promise<{ state?: string }>
}

const Preview = async ({ params, searchParams }: PreviewPageProps) => {
  const { node } = await params
  const { state } = await searchParams
  const entry = previews[node]
  if (!entry) notFound()

  return <div style={{ width: entry.width === 'viewport' ? '100%' : entry.width }}>{entry.render(state)}</div>
}

export default function FigmaPreviewPage(props: PreviewPageProps) {
  if (process.env.NODE_ENV === 'production') notFound()

  return (
    <Suspense fallback={null}>
      <Preview {...props} />
    </Suspense>
  )
}
