import { Link } from 'react-router'

export function Logo({ to = '/' }: { to?: string }) {
  return (
    <Link to={to} className="flex items-center gap-2 font-semibold text-stone-900">
      <span className="flex size-8 items-center justify-center rounded-lg bg-green-700 text-white" aria-hidden="true">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 10h16v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-9Zm-1-4h18v4H3V6Zm9 0v15M12 6c-1.5-3-5-3.5-5-1s3 1 5 1c2 0 5 1.5 5-1s-3.5-2-5 1Z" strokeLinejoin="round" />
        </svg>
      </span>
      Patungan
    </Link>
  )
}
