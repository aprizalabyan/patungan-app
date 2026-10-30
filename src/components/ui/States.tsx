import type { ReactNode } from 'react'
import { getErrorMessage } from '@/services/errors'
import { Button } from './Button'

interface EmptyStateProps {
  title: string
  description?: ReactNode
  action?: ReactNode
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center px-4 py-12 text-center">
      <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-green-50 text-green-700">
        <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M3 7h18M5 7v11a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7M9 11h6" strokeLinecap="round" />
        </svg>
      </div>
      <p className="font-medium text-stone-900">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-stone-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

interface ErrorStateProps {
  error: unknown
  title?: string
  onRetry?: () => void
}

export function ErrorState({ error, title = 'Gagal memuat data', onRetry }: ErrorStateProps) {
  return (
    <div role="alert" className="flex flex-col items-center px-4 py-12 text-center">
      <p className="font-medium text-red-700">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-stone-600">{getErrorMessage(error)}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-4" onClick={onRetry}>
          Coba lagi
        </Button>
      )}
    </div>
  )
}

export function InlineError({ message }: { message: string | null | undefined }) {
  if (!message) return null
  return (
    <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
      {message}
    </p>
  )
}
