import type {
  AnswerResult,
  DeckSummary,
  Fight,
  Health,
  Report,
  RunMap,
  UploadResult,
} from './types'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init)
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    const detail = body && typeof body.detail === 'string' ? body.detail : `${res.status} ${res.statusText}`
    throw new Error(detail)
  }
  return body as T
}

function post<T>(path: string, data: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export const api = {
  health: () => request<Health>('/api/health'),
  decks: () => request<{ decks: DeckSummary[]; snowflake_error: string | null }>('/api/decks'),
  upload: (file: File, name: string) => {
    const form = new FormData()
    form.append('file', file)
    form.append('name', name)
    return request<UploadResult>('/api/upload', { method: 'POST', body: form })
  },
  startRun: (userId: string, deckId: string) => post<RunMap>('/api/run', { user_id: userId, deck_id: deckId }),
  map: (runId: string) => request<RunMap>(`/api/map?run_id=${encodeURIComponent(runId)}`),
  enterNode: (runId: string, nodeId: string) => post<Fight>('/api/node', { run_id: runId, node_id: nodeId }),
  answer: (userId: string, runId: string, qId: string, choice: number) =>
    post<AnswerResult>('/api/answer', { user_id: userId, run_id: runId, q_id: qId, choice }),
  report: (userId: string) => request<Report>(`/api/report?user_id=${encodeURIComponent(userId)}`),
}

export function getUserId(): string {
  const key = 'cram-cartridge-user'
  try {
    const saved = localStorage.getItem(key)
    if (saved) return saved
    const id = crypto.randomUUID()
    localStorage.setItem(key, id)
    return id
  } catch {
    return crypto.randomUUID()
  }
}
