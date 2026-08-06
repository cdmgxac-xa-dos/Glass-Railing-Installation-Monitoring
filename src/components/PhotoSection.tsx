import { Camera, X } from 'lucide-react'
import { useRef } from 'react'
import type { LocationPhoto, PhotoCategory } from '../types'

interface PhotoSectionProps {
  category: PhotoCategory
  photos: LocationPhoto[]
  onAdd: (files: FileList) => void
  onRemove: (photoId: string) => void
}

export default function PhotoSection({ category, photos, onAdd, onRemove }: PhotoSectionProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="rounded-2xl border border-xa-line bg-white p-4 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-xa-navy">{category}</h3>
        <span className="text-xs font-medium text-xa-slate">{photos.length} photo{photos.length === 1 ? '' : 's'}</span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => inputRef.current?.click()}
          className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-xa-line bg-xa-skyblue/50 text-xa-blue active:scale-95"
        >
          <Camera size={22} />
          <span className="text-[10px] font-semibold">Add photo</span>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          capture="environment"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) onAdd(e.target.files)
            e.target.value = ''
          }}
        />

        {photos.map((photo) => (
          <div key={photo.id} className="group relative aspect-square overflow-hidden rounded-xl border border-xa-line">
            <img src={photo.previewUrl} alt={photo.fileName} className="h-full w-full object-cover" />
            <button
              onClick={() => onRemove(photo.id)}
              aria-label="Remove photo"
              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white"
            >
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
