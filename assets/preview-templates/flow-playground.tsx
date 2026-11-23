'use client'

import { useState, type CSSProperties, type ReactNode } from 'react'

export type FlowController = {
  step: string
  state: string
  go: (step: string, state?: string) => void
  next: () => void
  back: () => void
  setState: (state: string) => void
  simulate: () => Promise<boolean>
}

export type FlowStep = {
  id: string
  states?: string[]
  render: (flow: FlowController) => ReactNode
}

export type FlowPlaygroundProps = {
  name: string
  steps: FlowStep[]
  initialStep?: string
  shell?: (content: ReactNode) => ReactNode
}

const bar: CSSProperties = {
  position: 'fixed',
  left: 12,
  bottom: 12,
  zIndex: 2147483000,
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 8,
  maxWidth: 'calc(100vw - 24px)',
  padding: '8px 10px',
  borderRadius: 10,
  background: 'rgba(17, 17, 23, 0.92)',
  color: '#f4f4f5',
  font: '12px/1.4 ui-sans-serif, system-ui, sans-serif',
}

const chip = (active: boolean): CSSProperties => ({
  padding: '3px 9px',
  borderRadius: 999,
  border: '1px solid rgba(255, 255, 255, 0.25)',
  background: active ? '#6366f1' : 'transparent',
  color: 'inherit',
  font: 'inherit',
  cursor: 'pointer',
})

export const FlowPlayground = ({ name, steps, initialStep, shell }: FlowPlaygroundProps) => {
  const [stepId, setStepId] = useState(initialStep ?? steps[0].id)
  const [state, setState] = useState('default')
  const [latency, setLatency] = useState(600)
  const [failNext, setFailNext] = useState(false)

  const index = Math.max(0, steps.findIndex((item) => item.id === stepId))
  const current = steps[index]
  const states = ['default', ...(current.states ?? []).filter((item) => item !== 'default')]

  const go = (id: string, nextState = 'default') => {
    setStepId(id)
    setState(nextState)
  }

  const flow: FlowController = {
    step: current.id,
    state,
    go,
    setState,
    next: () => {
      if (index < steps.length - 1) go(steps[index + 1].id)
    },
    back: () => {
      if (index > 0) go(steps[index - 1].id)
    },
    simulate: () =>
      new Promise((resolve) => {
        setState('loading')
        window.setTimeout(() => {
          setState(failNext ? 'error' : 'default')
          resolve(!failNext)
        }, latency)
      }),
  }

  const content = current.render(flow)

  return (
    <div data-flow={name} data-flow-step={current.id} data-flow-state={state}>
      {shell ? shell(content) : content}
      <aside data-flow-controls style={bar}>
        <strong>{name}</strong>
        {steps.map((item) => (
          <button key={item.id} type="button" data-flow-go={item.id} style={chip(item.id === current.id)} onClick={() => go(item.id)}>
            {item.id}
          </button>
        ))}
        <label>
          state{' '}
          <select data-flow-state-select value={state} onChange={(event) => setState(event.target.value)}>
            {[...new Set([...states, state])].map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label>
          latency{' '}
          <select value={latency} onChange={(event) => setLatency(Number(event.target.value))}>
            {[0, 600, 2000].map((item) => (
              <option key={item} value={item}>
                {item} ms
              </option>
            ))}
          </select>
        </label>
        <label>
          <input type="checkbox" data-flow-fail checked={failNext} onChange={(event) => setFailNext(event.target.checked)} /> fail next
        </label>
      </aside>
    </div>
  )
}
