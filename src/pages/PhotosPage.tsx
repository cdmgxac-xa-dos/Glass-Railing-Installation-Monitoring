import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import type { LocationPhoto, PhotoCategory } from '../types'
import { PHOTO_CATEGORIES } from '../types'
import { addPhoto, getPhotosForLocation, removePhoto } from '../services/photoService'
import { useAuth } from '../context/AuthContext'
import PageHeader from '../components/PageHeader'
import PhotoSection from '../components/PhotoSection'

export default function PhotosPage() {
  const { locationId = '' } = useParams()
  const { user } = useAuth()
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
      <PageHeader title="Photos" subtitle={locationId} />
      <div className="space-y-4 px-4 py-5">
        <p className="text-xs text-xa-slate">
          Photos are stored on this device for now. Once connected to Supabase Storage, they'll upload
          automatically.
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
