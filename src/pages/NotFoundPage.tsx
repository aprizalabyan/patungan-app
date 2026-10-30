import { Link } from 'react-router'
import { buttonClasses } from '@/components/ui/Button'

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-stone-50 px-4 text-center">
      <p className="text-sm font-semibold text-green-700">404</p>
      <h1 className="mt-2 text-2xl font-semibold text-stone-900">Halaman tidak ditemukan</h1>
      <p className="mt-2 text-stone-500">Alamat yang Anda buka tidak tersedia.</p>
      <Link to="/" className={`${buttonClasses('primary')} mt-6`}>
        Kembali ke beranda
      </Link>
    </div>
  )
}
