/** Access token state is deliberately per-tab and memory-only. */
type Listener = () => void
const listeners = new Set<Listener>()
let accessToken: string | null = null

function notify(): void {
  listeners.forEach((listener) => listener())
}

export const session = {
  getToken: () => accessToken,
  set(token: string): void {
    accessToken = token
    notify()
  },
  clear(): void {
    const changed = accessToken !== null
    accessToken = null
    if (changed) notify()
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
}
