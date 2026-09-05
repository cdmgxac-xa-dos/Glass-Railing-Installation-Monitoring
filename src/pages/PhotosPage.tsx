import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import type { LocationPhoto, PhotoCategory } from '../types'
import { PHOTO_CATEGORIES } from '../types'
import { addPhoto, getPhotosForLocation, removePhoto } from '../services/photoService'
import { isSupabaseConfigured } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { useLocationReference } from '../hooks/useLocationReference'
import PageHeader from '../components/PageHeader'
import PhotoSection from '../components/PhotoSection'

export default function PhotosPage() {
  const { locationId = '' } = useParams()
  const { user } = useAuth()
  const reference = useLocationReference(locationId)
  const [photos, setPhotos] = useState<LocationPhoto[]>([])

  useEffect(() => {
    getPhotosForLocation(locationId).then(setPhotos)
  }, [locationId])

  async function handleAdd(category: PhotoCategory, files: FileList) {
    const uploads = Array.from(files).map((file) => addPhoto(locationId, category, file, user?.name ?? 'Field User'))
    const added = await Promise.all(uploads)
    setPhotos((prev) => [...prev, ...added])
  }

  async function handleRemove(photoId: string) {
    await removePhoto(photoId)
    setPhotos((prev) => prev.filter((p) => p.id !== photoId))
  }

  return (
    <div className="min-h-screen bg-[#F5F8FC]">
      <PageHeader title="Photos" subtitle={reference} />
      <div className="space-y-4 px-4 py-5">
        <p className="text-xs font-semibold text-xa-slate">
          {isSupabaseConfigured ? '✓ Photos sync automatically to the project record.' : 'Offline · Photos are saved on this device only.'}
        </p>
        {PHOTO_CATEGORIES.map((category) => (
          <PhotoSection
            key={category}
            category={category}
            photos={photos.filter((p) => p.category === category)}
            onAdd={(files) => handleAdd(category, files)}
            onRemove={handleRemove}
          />
        ))}
      </div>
    </div>
  )
}
