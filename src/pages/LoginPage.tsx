import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { Logo } from '@/components/layout/Logo'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { TextField } from '@/components/ui/FormField'
import { InlineError } from '@/components/ui/States'
import { useAuth } from '@/features/auth/authContext'
import type { LoginRedirectState } from '@/features/auth/ProtectedRoute'
import { getErrorMessage } from '@/services/errors'
import { hasErrors, isValidEmail, type FieldErrors } from '@/utils/validation'

type Field = 'email' | 'password'

/** Only same-app paths are allowed as a post-login target (no open redirects). */
function safeRedirect(from: unknown): string {
  return typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') ? from : '/'
}

export function LoginPage() {
  const { status, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const redirectTo = safeRedirect((location.state as LoginRedirectState | null)?.from)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<FieldErrors<Field>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (status === 'authenticated' && !submitting) return <Navigate to={redirectTo} replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const v: FieldErrors<Field> = {}
    if (!email.trim()) v.email = 'Email wajib diisi.'
    else if (!isValidEmail(email)) v.email = 'Format email tidak valid.'
    if (!password) v.password = 'Kata sandi wajib diisi.'
    setErrors(v)
    setSubmitError(null)
    if (hasErrors(v)) return

    setSubmitting(true)
    try {
      await login({ email: email.trim(), password })
      setPassword('')
      navigate(redirectTo, { replace: true })
    } catch (err) {
      setSubmitError(getErrorMessage(err, 'Gagal masuk. Silakan coba lagi.'))
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-stone-50 px-4 py-10">
      <div className="mb-6">
        <Logo />
      </div>
      <Card className="w-full max-w-sm p-6">
        <h1 className="text-xl font-semibold text-stone-900">Masuk sebagai bendahara</h1>
        <p className="mt-1 text-sm text-stone-500">Kelola iuran kado pernikahan teman-teman SMA.</p>
        <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
          <TextField
            label="Email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
            required
            autoFocus
          />
          <TextField
            label="Kata sandi"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            required
          />
          <InlineError message={submitError} />
          <Button type="submit" className="w-full" loading={submitting}>
            {submitting ? 'Memproses…' : 'Masuk'}
          </Button>
        </form>
      </Card>
      <p className="mt-6 max-w-sm text-center text-xs text-stone-500">
        Hanya bendahara yang memiliki akun. Teman lain cukup membuka tautan acara publik yang dibagikan.
      </p>
    </div>
  )
}
