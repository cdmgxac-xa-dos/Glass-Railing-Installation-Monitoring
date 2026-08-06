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
// ---------------------------------------------------------------------------

const BUCKET = 'glass-railing-photos'
const SIGNED_URL_TTL_SECONDS = 8 * 60 * 60 // 8 hours

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

// Mock-only in-memory store. Object URLs (URL.createObjectURL) only make
// sense here — real mode uses signed Storage URLs instead, so the cleanup
// call (URL.revokeObjectURL) stays mock-only too.
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
  if (!isSupabaseConfigured) {
    const photo: LocationPhoto = {
      id: `PH-${(mockCounter++).toString().padStart(4, '0')}`,
      locationId,
      category,
      previewUrl: URL.createObjectURL(file),
      fileName: file.name,
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
  const storagePath = `${location.projectCode}/${locationId}/${uuid}.${extensionFor(file.name)}`

  const { error: uploadError } = await supabase!.storage.from(BUCKET).upload(storagePath, file, {
    contentType: file.type || undefined,
  })
  if (uploadError) throw uploadError

  const { data: insertedRow, error: insertError } = await supabase!
    .from('gr_photos')
    .insert({
      location_id: locationId,
      category,
      storage_path: storagePath,
      file_name: file.name,
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
