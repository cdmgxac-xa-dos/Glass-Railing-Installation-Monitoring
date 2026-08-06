import { GanttChartSquare } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function SplashPage() {
  const navigate = useNavigate()

  return (
    <div className="flex min-h-screen flex-col items-center justify-between bg-xa-navy px-6 py-12 text-white">
      <div />
      <div className="flex flex-col items-center text-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-white/10 backdrop-blur">
          <GanttChartSquare size={40} />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight">XA DOS</h1>
        <p className="mt-2 text-sm font-medium uppercase tracking-[0.2em] text-blue-200">
          Glass Railing Monitoring
        </p>
        <p className="mt-4 max-w-[26ch] text-sm text-blue-100">
          Track every railing location from bracket to sign-off, floor by floor.
        </p>
      </div>

      <button
        onClick={() => navigate('/login')}
        className="w-full max-w-xs rounded-2xl bg-white py-4 text-center text-base font-bold text-xa-navy shadow-pop active:scale-[0.98]"
      >
        Enter
      </button>
    </div>
  )
}
