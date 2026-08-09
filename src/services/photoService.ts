import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'
import type { LocationPhoto, PhotoCategory } from '../types'
import { MOCK_PHOTOS } from '../data/mockData'
import { getLocationById } from './locationService'
import { compressPhotoForUpload } from '../utils/imageCompression'

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
// COMPRESSION: modern phone cameras produce 2-6MB+ photos. Uploading the
// original file over a mobile/site connection was reported slow in real
// field testing. compressPhotoForUpload() (../utils/imageCompression.ts)
// produces a ~400-600KB main image plus a ~50KB thumbnail in-browser, and
// both are uploaded — the original 2-6MB+ file never leaves the device.
// Applies in both modes, so mock-mode previews match what real uploads
// will look/behave like.
// ---------------------------------------------------------------------------

const BUCKET = 'glass-railing-photos'
const SIGNED_URL_TTL_SECONDS = 8 * 60 * 60 // 8 hours

interface GrPhotoRow {
  id: string
  location_id: string
  category: PhotoCategory
  storage_path: string
  // Nullable: rows uploaded before the thumbnail tier existed have none.
  // toLocationPhoto() falls back to the main image's signed URL for those.
  thumbnail_path: string | null
  file_name: string
  uploaded_by: string | null
  uploaded_at: string
}

async function toLocationPhoto(row: GrPhotoRow): Promise<LocationPhoto> {
  const { data, error } = await supabase!.storage
    .from(BUCKET)
    .createSignedUrl(row.storage_path, SIGNED_URL_TTL_SECONDS)

  if (error) throw error

  let thumbnailUrl = data.signedUrl
  if (row.thumbnail_path) {
    const { data: thumbData, error: thumbError } = await supabase!.storage
      .from(BUCKET)
      .createSignedUrl(row.thumbnail_path, SIGNED_URL_TTL_SECONDS)
    if (thumbError) throw thumbError
    thumbnailUrl = thumbData.signedUrl
  }

  return {
    id: row.id,
    locationId: row.location_id,
    category: row.category,
    previewUrl: data.signedUrl,
    thumbnailUrl,
    fileName: row.file_name,
    uploadedBy: row.uploaded_by ?? 'Unknown',
    uploadedAt: row.uploaded_at,
  }
}

function extensionFor(fileName: string): string {
  const match = fileName.match(/\.([a-zA-Z0-9]+)$/)
  return match ? match[1].toLowerCase() : 'jpg'
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
  const { main, thumbnail } = await compressPhotoForUpload(file)

  if (!isSupabaseConfigured) {
    const photo: LocationPhoto = {
      id: `PH-${(mockCounter++).toString().padStart(4, '0')}`,
      locationId,
      category,
      previewUrl: URL.createObjectURL(main),
      thumbnailUrl: URL.createObjectURL(thumbnail),
      fileName: main.name,
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
  const storagePath = `${location.projectCode}/${locationId}/${uuid}.${extensionFor(main.name)}`
  const thumbnailPath = `${location.projectCode}/${locationId}/${uuid}_thumb.${extensionFor(thumbnail.name)}`

  const { error: uploadError } = await supabase!.storage.from(BUCKET).upload(storagePath, main, {
    contentType: main.type || undefined,
  })
  if (uploadError) throw uploadError

  const { error: thumbUploadError } = await supabase!.storage.from(BUCKET).upload(thumbnailPath, thumbnail, {
    contentType: thumbnail.type || undefined,
  })
  if (thumbUploadError) {
    await supabase!.storage.from(BUCKET).remove([storagePath])
    throw thumbUploadError
  }

  const { data: insertedRow, error: insertError } = await supabase!
    .from('gr_photos')
    .insert({
      location_id: locationId,
      category,
      storage_path: storagePath,
      thumbnail_path: thumbnailPath,
      file_name: main.name,
      uploaded_by: uploadedBy,
    })
    .select('*')
    .single()

  if (insertError) {
    // Storage objects were uploaded but the row insert failed — clean up
    // the orphaned objects rather than leaving them unreferenced in the
    // bucket.
    await supabase!.storage.from(BUCKET).remove([storagePath, thumbnailPath])
    throw insertError
  }

  return toLocationPhoto(insertedRow as GrPhotoRow)
}

export async function removePhoto(photoId: string): Promise<void> {
  if (!isSupabaseConfigured) {
    const idx = mockStore.findIndex((p) => p.id === photoId)
    if (idx >= 0) {
      URL.revokeObjectURL(mockStore[idx].previewUrl)
      URL.revokeObjectURL(mockStore[idx].thumbnailUrl)
      mockStore.splice(idx, 1)
    }
    return
  }

  // Need the storage_path/thumbnail_path to delete the Storage objects —
  // the DB row id alone isn't enough, so fetch first, then delete both.
  const { data: row, error: fetchError } = await supabase!
    .from('gr_photos')
    .select('storage_path, thumbnail_path')
    .eq('id', photoId)
    .maybeSingle()

  if (fetchError) throw fetchError
  if (!row) return // already gone

  const { error: deleteError } = await supabase!.from('gr_photos').delete().eq('id', photoId)
  if (deleteError) throw deleteError

  // Row delete succeeded; best-effort Storage cleanup after. If this fails,
  // the DB is already consistent (no dangling reference) — orphaned
  // Storage objects are a minor cleanup issue, not a data-integrity one.
  const pathsToRemove = [row.storage_path, ...(row.thumbnail_path ? [row.thumbnail_path] : [])]
  await supabase!.storage.from(BUCKET).remove(pathsToRemove)
}
