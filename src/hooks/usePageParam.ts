import { useCallback } from 'react'
import { useSearchParams } from 'react-router'

/** Reads/writes a 1-based `page` (and other filters) in the URL so lists are linkable. */
export function useSearchParamState(key: string, defaultValue = '') {
  const [params, setParams] = useSearchParams()
  const value = params.get(key) ?? defaultValue
  const setValue = useCallback(
    (next: string, resetPage = true) => {
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev)
          if (next === defaultValue || next === '') p.delete(key)
          else p.set(key, next)
          if (resetPage && key !== 'page') p.delete('page')
          return p
        },
        { replace: true },
      )
    },
    [key, defaultValue, setParams],
  )
  return [value, setValue] as const
}

export function usePageParam(): [number, (page: number) => void] {
  const [raw, setRaw] = useSearchParamState('page', '1')
  const parsed = Number.parseInt(raw, 10)
  const page = Number.isFinite(parsed) && parsed >= 1 ? parsed : 1
  const setPage = useCallback((p: number) => setRaw(String(Math.max(1, p)), false), [setRaw])
  return [page, setPage]
}
