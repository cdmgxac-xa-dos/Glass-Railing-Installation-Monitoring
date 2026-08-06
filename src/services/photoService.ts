import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'
import type { LocationPhoto, PhotoCategory } from '../types'
import { MOCK_PHOTOS } from '../data/mockData'
import { getLocationById } from './locationService'

// ---------------------------------------------------------------------------
// Photo service — reads/writes gr_photos + the private glass-railing-photos
// Storage bucket. Path convention: {project_code}/{location_id}/{uuid}.{ext}
// (see supabase/schema.sql). Bucket is private — reads use signed URLs, not
// public URLs.
//
// DUAL MODE, same pattern as the other services: mock in-memory store (blob
// object URLs) when Supabase isn't configured, real Storage + table when it
// is.
//
// SIGNED URL TTL: 8 hours (one field shift). getPhotosForLocation is called
// once per page visit with no refresh-on-expiry logic, so the TTL needs to
// outlast a normal session on the Photos page rather than being tight.
//
// COMPRESSION: modern phone cameras produce 8-20MB+ photos. Uploading the
// original file over a mobile/site connection was reported slow in real
// field testing. compressImage() resizes to a max dimension and re-encodes
// as JPEG in-browser (Canvas API, no external library) before upload —
// applies in both modes, so mock-mode previews match what real uploads
// will look/behave like. Falls back to the original file if compression
// fails for any reason (e.g. an unsupported format) or doesn't actually
// shrink the file, rather than blocking the upload outright.
// ---------------------------------------------------------------------------

const BUCKET = 'glass-railing-photos'
const SIGNED_URL_TTL_SECONDS = 8 * 60 * 60 // 8 hours

const COMPRESS_MAX_DIMENSION = 1600 // px, longest side
const COMPRESS_QUALITY = 0.82 // JPEG quality, 0-1
const COMPRESS_SKIP_BELOW_BYTES = 500 * 1024 // don't bother compressing already-small files

interface GrPhotoRow {
  id: string
  location_id: string
  category: PhotoCategory
  storage_path: string
  file_name: string
  uploaded_by: string | null
  uploaded_at: string
}

async function toLocationPhoto(row: GrPhotoRow): Promise<LocationPhoto> {
  const { data, error } = await supabase!.storage
    .from(BUCKET)
    .createSignedUrl(row.storage_path, SIGNED_URL_TTL_SECONDS)

  if (error) throw error

  return {
    id: row.id,
    locationId: row.location_id,
    category: row.category,
    previewUrl: data.signedUrl,
    fileName: row.file_name,
    uploadedBy: row.uploaded_by ?? 'Unknown',
    uploadedAt: row.uploaded_at,
  }
}

function extensionFor(fileName: string): string {
  const match = fileName.match(/\.([a-zA-Z0-9]+)$/)
  return match ? match[1].toLowerCase() : 'jpg'
}

// Resizes and re-encodes an image file in-browser before upload. Skips
// small files outright, and falls back to the original file on any error
// (unsupported format, decode failure, etc.) rather than blocking the
// upload — a slightly larger photo is better than a failed one.
async function compressImage(file: File): Promise<File> {
  if (file.size < COMPRESS_SKIP_BELOW_BYTES) return file

  try {
    const bitmap = await createImageBitmap(file)

    const scale = Math.min(1, COMPRESS_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
    const width = Math.round(bitmap.width * scale)
    const height = Math.round(bitmap.height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return file

    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close?.()

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', COMPRESS_QUALITY),
    )
    if (!blob) return file

    // Only use the compressed version if it's actually smaller — a tiny or
    // already-efficient source image could theoretically come back larger
    // after re-encoding.
    if (blob.size >= file.size) return file

    // Re-encoded as JPEG regardless of source format, so the extension
    // needs to match the actual content now, not the original filename.
    const baseName = file.name.replace(/\.[^./]+$/, '')
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg', lastModified: Date.now() })
  } catch (err) {
    console.warn('Photo compression failed, uploading original file instead:', err)
    return file
  }
}

// Mock-only in-memory store.
const mockStore: LocationPhoto[] = [...MOCK_PHOTOS]
let mockCounter = 1

export async function getPhotosForLocation(locationId: string): Promise<LocationPhoto[]> {
  if (!isSupabaseConfigured) {
    return mockStore.filter((p) => p.locationId === locationId)
  }

  const { data, error } = await supabase!
    .from('gr_photos')
    .select('*')
    .eq('location_id', locationId)
    .order('uploaded_at')

  if (error) throw error
  return Promise.all((data as GrPhotoRow[]).map(toLocationPhoto))
}

export async function addPhoto(
  locationId: string,
  category: PhotoCategory,
  file: File,
  uploadedBy: string,
): Promise<LocationPhoto> {
  const compressedFile = await compressImage(file)

  if (!isSupabaseConfigured) {
    const photo: LocationPhoto = {
      id: `PH-${(mockCounter++).toString().padStart(4, '0')}`,
      locationId,
      category,
      previewUrl: URL.createObjectURL(compressedFile),
      fileName: compressedFile.name,
      uploadedBy,
      uploadedAt: new Date().toISOString(),
    }
    mockStore.push(photo)
    return photo
  }

  // projectCode isn't part of this function's signature (keeps
  // PhotosPage.tsx unchanged) — resolved internally, same pattern as
  // locationService.ts's projectNameFor() lookup.
  const location = await getLocationById(locationId)
  if (!location) {
    throw new Error(`Cannot upload photo: location ${locationId} not found.`)
  }

  const uuid = crypto.randomUUID()
  const storagePath = `${location.projectCode}/${locationId}/${uuid}.${extensionFor(compressedFile.name)}`

  const { error: uploadError } = await supabase!.storage.from(BUCKET).upload(storagePath, compressedFile, {
    contentType: compressedFile.type || undefined,
  })
  if (uploadError) throw uploadError

  const { data: insertedRow, error: insertError } = await supabase!
    .from('gr_photos')
    .insert({
      location_id: locationId,
      category,
      storage_path: storagePath,
      file_name: compressedFile.name,
      uploaded_by: uploadedBy,
    })
    .select('*')
    .single()

  if (insertError) {
    // Storage object was uploaded but the row insert failed — clean up the
    // orphaned object rather than leaving it unreferenced in the bucket.
    await supabase!.storage.from(BUCKET).remove([storagePath])
    throw insertError
  }

  return toLocationPhoto(insertedRow as GrPhotoRow)
}

export async function removePhoto(photoId: string): Promise<void> {
  if (!isSupabaseConfigured) {
    const idx = mockStore.findIndex((p) => p.id === photoId)
    if (idx >= 0) {
      URL.revokeObjectURL(mockStore[idx].previewUrl)
      mockStore.splice(idx, 1)
    }
    return
  }

  // Need the storage_path to delete the Storage object — the DB row id
  // alone isn't enough, so fetch first, then delete both.
  const { data: row, error: fetchError } = await supabase!
    .from('gr_photos')
    .select('storage_path')
    .eq('id', photoId)
    .maybeSingle()

  if (fetchError) throw fetchError
  if (!row) return // already gone

  const { error: deleteError } = await supabase!.from('gr_photos').delete().eq('id', photoId)
  if (deleteError) throw deleteError

  // Row delete succeeded; best-effort Storage cleanup after. If this fails,
  // the DB is already consistent (no dangling reference) — an orphaned
  // Storage object is a minor cleanup issue, not a data-integrity one.
  await supabase!.storage.from(BUCKET).remove([row.storage_path])
}
