import { Navigate, Outlet, useLocation } from 'react-router'
import { LoadingState } from '@/components/ui/Spinner'
import { ErrorState } from '@/components/ui/States'
import { useAuth } from './authContext'

export interface LoginRedirectState {
  from?: string
}

/**
 * UX guard only: it hides management screens from signed-out users. The
 * backend enforces authorization on every protected endpoint regardless.
 */
export function ProtectedRoute() {
  const { status, error, retry } = useAuth()
  const location = useLocation()

  if (status === 'unauthenticated') {
    const state: LoginRedirectState = { from: location.pathname + location.search }
    return <Navigate to="/login" replace state={state} />
  }
  if (status === 'loading') {
    return (
      <div className="min-h-screen">
        <LoadingState label="Memeriksa sesi…" />
      </div>
    )
  }
  if (status === 'error') {
    return <ErrorState error={error} title="Gagal memverifikasi sesi" onRetry={retry} />
  }
  return <Outlet />
}
