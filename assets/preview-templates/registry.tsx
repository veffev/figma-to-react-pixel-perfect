import type { ReactNode } from 'react'

export type PreviewEntry = {
  width: number | 'viewport'
  render: (state?: string) => ReactNode
}

export const previews: Record<string, PreviewEntry> = {}
