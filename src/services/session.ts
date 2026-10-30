/**
 * Client-side session holding the backend's short-lived Bearer token.
 *
 * The backend issues a JWT in the response body and does not support cookies
 * (CORS `allow_credentials=False`), so an HttpOnly cookie is not an option.
 * We keep the token in `sessionStorage` (scoped to the tab, cleared when it
 * closes) together with its expiry, never in `localStorage`, and never store
 * the password. See README "Authentication" for the trade-offs.
 */

const STORAGE_KEY = 'patungan.session'

interface StoredSession {
  token: string
  /** Epoch milliseconds after which the token is treated as expired. */
  expiresAt: number
}

type Listener = () => void

const listeners = new Set<Listener>()

function read(): StoredSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredSession>
    if (typeof parsed.token !== 'string' || typeof parsed.expiresAt !== 'number') return null
    return { token: parsed.token, expiresAt: parsed.expiresAt }
  } catch {
    return null
  }
}

function notify(): void {
  listeners.forEach((l) => l())
}

export const session = {
  /**
   * Returns the token if present and not expired. Side-effect free so it can be
   * a `useSyncExternalStore` snapshot; an expired entry is removed when the
   * next authenticated request comes back 401.
   */
  getToken(): string | null {
    const s = read()
    if (!s || Date.now() >= s.expiresAt) return null
    return s.token
  },

  set(token: string, expiresInSeconds: number): void {
    // Expire slightly early so we never send a token that dies mid-request.
    const expiresAt = Date.now() + Math.max(0, expiresInSeconds - 30) * 1000
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ token, expiresAt }))
    } catch {
      // Storage unavailable (e.g. privacy mode); the session simply won't survive a reload.
    }
    notify()
  },

  clear(): void {
    const had = read() !== null
    try {
      sessionStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
    if (had) notify()
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
}
