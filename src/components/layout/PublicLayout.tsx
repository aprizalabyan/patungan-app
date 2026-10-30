import { Outlet } from 'react-router'
import { Logo } from './Logo'

export function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-stone-50">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Logo to="/public" />
          <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600">
            Hanya baca
          </span>
        </div>
      </header>
      <main id="konten" className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:py-8">
        <Outlet />
      </main>
      <footer className="py-6 text-center text-xs text-stone-500">
        Dikelola oleh bendahara melalui Patungan.
      </footer>
    </div>
  )
}
