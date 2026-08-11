import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-2 text-center">
      <p className="text-3xl font-bold text-brand-ink">404</p>
      <p className="text-brand-slate">Page not found</p>
      <Link to="/" className="mt-2 text-sm font-semibold text-brand-teal hover:underline">
        Go home
      </Link>
    </div>
  )
}
