import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { DrawingListTable } from '@/components/DrawingListTable'
import { listByStatus } from '@/services/drawingService'
import type { DrawingItem } from '@/types'

export function DAAAReviewPage() {
  const [items, setItems] = useState<DrawingItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listByStatus(['submitted_to_daaa', 'daaa_review'])
      .then(setItems)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-brand-ink">DAAA Review Queue</h1>
        <p className="text-sm text-brand-slate">{items.length} drawings awaiting technical review</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-brand-slate" />
        </div>
      ) : (
        <DrawingListTable items={items} />
      )}
    </div>
  )
}
