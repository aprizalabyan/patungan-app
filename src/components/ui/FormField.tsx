import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { cn } from '@/utils/cn'

const controlClasses = (invalid: boolean) =>
  cn(
    'block w-full rounded-lg border bg-white px-3 py-2 text-sm text-stone-900 shadow-sm',
    'placeholder:text-stone-400 focus:outline-none focus:ring-2 disabled:bg-stone-100',
    invalid
      ? 'border-red-400 focus:border-red-500 focus:ring-red-200'
      : 'border-stone-300 focus:border-green-600 focus:ring-green-200',
  )

interface FieldShellProps {
  id: string
  label: ReactNode
  error?: string
  hint?: ReactNode
  required?: boolean
  children: ReactNode
}

function FieldShell({ id, label, error, hint, required, children }: FieldShellProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-stone-700">
        {label}
        {required && (
          <span className="text-red-600" aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-red-600">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="text-xs text-stone-500">
            {hint}
          </p>
        )
      )}
    </div>
  )
}

function describedBy(id: string, error?: string, hint?: ReactNode): string | undefined {
  if (error) return `${id}-error`
  if (hint) return `${id}-hint`
  return undefined
}

interface CommonProps {
  label: ReactNode
  error?: string
  hint?: ReactNode
}

export function TextField({
  label,
  error,
  hint,
  id,
  required,
  className,
  ...rest
}: CommonProps & InputHTMLAttributes<HTMLInputElement>) {
  const autoId = useId()
  const fieldId = id ?? autoId
  return (
    <FieldShell id={fieldId} label={label} error={error} hint={hint} required={required}>
      <input
        id={fieldId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, error, hint)}
        className={cn(controlClasses(Boolean(error)), className)}
        {...rest}
      />
    </FieldShell>
  )
}

export function TextAreaField({
  label,
  error,
  hint,
  id,
  required,
  className,
  ...rest
}: CommonProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const autoId = useId()
  const fieldId = id ?? autoId
  return (
    <FieldShell id={fieldId} label={label} error={error} hint={hint} required={required}>
      <textarea
        id={fieldId}
        required={required}
        rows={3}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, error, hint)}
        className={cn(controlClasses(Boolean(error)), className)}
        {...rest}
      />
    </FieldShell>
  )
}

export function SelectField({
  label,
  error,
  hint,
  id,
  required,
  className,
  children,
  ...rest
}: CommonProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const autoId = useId()
  const fieldId = id ?? autoId
  return (
    <FieldShell id={fieldId} label={label} error={error} hint={hint} required={required}>
      <select
        id={fieldId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, error, hint)}
        className={cn(controlClasses(Boolean(error)), className)}
        {...rest}
      >
        {children}
      </select>
    </FieldShell>
  )
}

interface CheckboxFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: ReactNode
  hint?: ReactNode
}

export function CheckboxField({ label, hint, id, ...rest }: CheckboxFieldProps) {
  const autoId = useId()
  const fieldId = id ?? autoId
  return (
    <div className="flex items-start gap-3">
      <input
        id={fieldId}
        type="checkbox"
        aria-describedby={hint ? `${fieldId}-hint` : undefined}
        className="mt-0.5 size-4 rounded border-stone-300 accent-green-700"
        {...rest}
      />
      <div>
        <label htmlFor={fieldId} className="text-sm font-medium text-stone-700">
          {label}
        </label>
        {hint && (
          <p id={`${fieldId}-hint`} className="text-xs text-stone-500">
            {hint}
          </p>
        )}
      </div>
    </div>
  )
}
