import { lastResponse, logTrace } from '../game/dev'
import { createStore } from '../game/store'
import type {
  AnswerRequest,
  AnswerResult,
  DecksResponse,
  Health,
  ItemResult,
  NodeResult,
  Report,
  RunMap,
  ScoresResponse,
  TraceStep,
  TreasureResult,
  UploadResult,
} from './types'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/** Thrown when an optional (PROPOSED) endpoint is not on the server yet. */
export class Unsupported extends Error {}

export interface Backend {
  health(): Promise<Health>
  decks(userId: string): Promise<DecksResponse>
  upload(file: File, name: string): Promise<UploadResult>
  startRun(userId: string, deckId: string, playerName: string): Promise<RunMap>
  map(runId: string): Promise<RunMap>
  enterNode(runId: string, nodeId: string): Promise<NodeResult>
  answer(req: AnswerRequest): Promise<AnswerResult>
  report(userId: string): Promise<Report>
  treasure(runId: string, nodeId: string, choiceId: string): Promise<TreasureResult>
  useItem(runId: string, itemId: string, qId: string | null): Promise<ItemResult>
  scores(deckId: string): Promise<ScoresResponse>
}

function record(path: string, body: unknown): void {
  lastResponse.set({ path, body })
  if (body && typeof body === 'object' && 'trace' in body) {
    const trace = (body as { trace?: TraceStep[] }).trace
    logTrace(path, Array.isArray(trace) ? trace : null)
  }
}

async function request<T>(path: string, init?: RequestInit, optional = false): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, init)
  } catch {
    throw new ApiError(0, 'The backend is not answering')
  }
  const body: unknown = await res.json().catch(() => null)
  if (!res.ok) {
    if (optional && (res.status === 404 || res.status === 405)) throw new Unsupported(path)
    const detail =
      body && typeof body === 'object' && 'detail' in body && typeof body.detail === 'string'
        ? body.detail
        : `${res.status} ${res.statusText}`
    throw new ApiError(res.status, detail)
  }
  record(path.split('?')[0], body)
  return body as T
}

function post<T>(path: string, data: unknown, optional = false): Promise<T> {
  return request<T>(
    path,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) },
    optional,
  )
}

const q = encodeURIComponent

export const realBackend: Backend = {
  health: () => request<Health>('/api/health'),
  decks: (userId) => request<DecksResponse>(`/api/decks?user_id=${q(userId)}`),
  upload: (file, name) => {
    const form = new FormData()
    form.append('file', file)
    form.append('name', name)
    return request<UploadResult>('/api/upload', { method: 'POST', body: form })
  },
  startRun: (userId, deckId, playerName) =>
    post<RunMap>('/api/run', { user_id: userId, deck_id: deckId, player_name: playerName }),
  map: (runId) => request<RunMap>(`/api/map?run_id=${q(runId)}`),
  enterNode: (runId, nodeId) => post<NodeResult>('/api/node', { run_id: runId, node_id: nodeId }),
  answer: (req) => post<AnswerResult>('/api/answer', req),
  report: (userId) => request<Report>(`/api/report?user_id=${q(userId)}`),
  treasure: (runId, nodeId, choiceId) =>
    post<TreasureResult>('/api/treasure', { run_id: runId, node_id: nodeId, choice_id: choiceId }, true),
  useItem: (runId, itemId, qId) => post<ItemResult>('/api/item', { run_id: runId, item_id: itemId, q_id: qId }, true),
  scores: (deckId) => request<ScoresResponse>(`/api/scores?deck_id=${q(deckId)}`, undefined, true),
}

export type BackendMode = 'checking' | 'real' | 'mock'
export const backendMode = createStore<BackendMode>('checking')
export const healthStore = createStore<Health | null>(null)

let active: Backend = realBackend

/** The backend every screen talks to (real, or the mock when it is active). */
export const api: Backend = new Proxy({} as Backend, {
  get: (_t, key: keyof Backend) => active[key],
})

/**
 * Use the mock only if VITE_MOCK=1, ?mock=1, or /api/health fails at startup.
 * The live demo must run on the real backend.
 */
export async function initBackend(): Promise<void> {
  let forced = import.meta.env.VITE_MOCK === '1'
  try {
    if (new URLSearchParams(window.location.search).get('mock') === '1') forced = true
  } catch {
    // ignore
  }
  if (!forced) {
    try {
      const h = await realBackend.health()
      healthStore.set(h)
      active = realBackend
      backendMode.set('real')
      return
    } catch {
      // fall through to the mock
    }
  }
  const { mockBackend } = await import('./mock')
  active = mockBackend
  healthStore.set(await mockBackend.health())
  backendMode.set('mock')
}

export function errorText(err: unknown): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error) return err.message
  return 'Something went wrong'
}
