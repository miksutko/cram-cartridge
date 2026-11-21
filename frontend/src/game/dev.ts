import type { TraceStep } from '../api/types'
import { load, save } from './storage'
import { createStore } from './store'

// Dev mode: hidden from players. On with ?dev=1 or typing "snow" on the start screen,
// off with ?dev=0 or "snow" again. Remembered for the browser session.

function initialDev(): boolean {
  try {
    const flag = new URLSearchParams(window.location.search).get('dev')
    if (flag === '1') {
      save('cram-dev', true, 'session')
      return true
    }
    if (flag === '0') {
      save('cram-dev', false, 'session')
      return false
    }
  } catch {
    // ignore
  }
  return load('cram-dev', false, 'session')
}

export const devMode = createStore<boolean>(initialDev())

export function toggleDev(): void {
  devMode.set((on) => {
    save('cram-dev', !on, 'session')
    return !on
  })
}

export interface TraceEntry {
  id: number
  label: string
  at: number
  steps: TraceStep[] | null
}

export const traceLog = createStore<TraceEntry[]>([])
export const lastResponse = createStore<{ path: string; body: unknown } | null>(null)

let nextId = 1
export function logTrace(label: string, steps: TraceStep[] | null | undefined): void {
  traceLog.set((list) => [{ id: nextId++, label, at: Date.now(), steps: steps ?? null }, ...list].slice(0, 40))
}
