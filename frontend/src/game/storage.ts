// localStorage / sessionStorage can be missing or throw (private windows, blocked
// site data). Every read and write goes through these helpers.

export function load<T>(key: string, fallback: T, store: 'local' | 'session' = 'local'): T {
  try {
    const s = store === 'local' ? window.localStorage : window.sessionStorage
    const raw = s.getItem(key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

export function save(key: string, value: unknown, store: 'local' | 'session' = 'local'): void {
  try {
    const s = store === 'local' ? window.localStorage : window.sessionStorage
    s.setItem(key, JSON.stringify(value))
  } catch {
    // storage unavailable: the game still works, it just forgets
  }
}

function randomId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `u${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`
  }
}

let cachedUserId: string | null = null

export function getUserId(): string {
  if (cachedUserId) return cachedUserId
  // Same key the alpha used, so existing players keep their history.
  let id: string | null
  try {
    id = window.localStorage.getItem('cram-cartridge-user')
  } catch {
    id = null
  }
  if (!id) {
    id = randomId()
    try {
      window.localStorage.setItem('cram-cartridge-user', id)
    } catch {
      // ignore
    }
  }
  cachedUserId = id
  return id
}
