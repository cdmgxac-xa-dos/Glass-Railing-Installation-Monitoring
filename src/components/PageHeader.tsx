import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

interface PageHeaderProps {
  title: string
  subtitle?: string
  onBack?: () => void
  showBack?: boolean
  right?: ReactNode
}

export default function PageHeader({ title, subtitle, onBack, showBack = true, right }: PageHeaderProps) {
  const navigate = useNavigate()

  return (
    <header className="sticky top-0 z-20 bg-xa-navy text-white shadow-pop">
      <div className="flex items-center gap-2 px-4 py-3">
        {showBack && (
          <button
            onClick={() => (onBack ? onBack() : navigate(-1))}
            aria-label="Go back"
            className="-ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full active:bg-white/10"
          >
            <ChevronLeft size={24} />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-bold leading-tight">{title}</h1>
          {subtitle && <p className="truncate text-xs text-blue-100">{subtitle}</p>}
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </div>
    </header>
  )
}
