import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { DrawingListTable } from '@/components/DrawingListTable'
import { listMyAssignedItems } from '@/services/drawingService'
import { useAuth } from '@/context/AuthContext'
import type { DrawingItem } from '@/types'

export function DraftsmanPage() {
  const { profile } = useAuth()
  const [items, setItems] = useState<DrawingItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return
    listMyAssignedItems(profile.id)
      .then(setItems)
      .finally(() => setLoading(false))
  }, [profile])

  const active = items.filter((i) => !['approved', 'completed'].includes(i.status))
  const done = items.filter((i) => ['approved', 'completed'].includes(i.status))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-brand-ink">My Assigned Drawings</h1>
        <p className="text-sm text-brand-slate">
          {active.length} active · {done.length} approved/completed
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-brand-slate" />
        </div>
      ) : (
        <>
          <DrawingListTable items={active} />
          {done.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-bold text-brand-slate">Approved / Completed</h2>
              <DrawingListTable items={done} />
            </div>
          )}
        </>
      )}
    </div>
  )
}
