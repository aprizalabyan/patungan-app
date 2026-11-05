import { NavLink, Outlet, useNavigate } from 'react-router'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/features/auth/authContext'
import { cn } from '@/utils/cn'
import { Logo } from './Logo'

const NAV = [
  { to: '/', label: 'Dasbor', end: true },
  { to: '/events', label: 'Acara', end: false },
  { to: '/friends', label: 'Teman', end: false },
]

export function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-stone-50">
      <a
        href="#konten"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2"
      >
        Lewati ke konten
      </a>
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <Logo />
          <nav aria-label="Navigasi utama" className="hidden flex-1 gap-1 sm:flex">
            {NAV.map((item) => (
              <NavItem key={item.to} {...item} />
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            {user && <span className="hidden text-sm text-stone-600 md:inline">{user.name}</span>}
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                await logout()
                navigate('/login', { replace: true })
              }}
            >
              Keluar
            </Button>
          </div>
        </div>
        <nav aria-label="Navigasi utama (seluler)" className="flex gap-1 border-t border-stone-100 px-2 py-1.5 sm:hidden">
          {NAV.map((item) => (
            <NavItem key={item.to} {...item} className="flex-1 justify-center" />
          ))}
        </nav>
      </header>
      <main id="konten" className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  )
}

function NavItem({ to, label, end, className }: { to: string; label: string; end: boolean; className?: string }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'flex rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
          isActive ? 'bg-green-50 text-green-800' : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900',
          className,
        )
      }
    >
      {label}
    </NavLink>
  )
}
