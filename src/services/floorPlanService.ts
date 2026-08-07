import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'
import type { FloorPlan, LocationPin } from '../types'

// ---------------------------------------------------------------------------
// Floor plan pin service — backed by gr_floor_plans + gr_location_pins, plus
// the private gr-floor-plans Storage bucket.
//
// DUAL MODE, same pattern as every other service: mock in-memory store when
// Supabase isn't configured, real Storage + tables when it is.
//
// Path convention: {project_code}/{floor_level}.{ext} — one image per
// project+floor (unique constraint on gr_floor_plans), so a re-upload
// overwrites the same Storage object rather than orphaning the old one.
// Bucket is private; served via a signed URL, same as glass-railing-photos.
// ---------------------------------------------------------------------------

const BUCKET = 'gr-floor-plans'
const SIGNED_URL_TTL_SECONDS = 8 * 60 * 60 // 8 hours, same as photoService

interface GrFloorPlanRow {
  id: string
  project_code: string
  floor_level: string
  image_url: string
  image_width: number | null
  image_height: number | null
  uploaded_by: string | null
  created_at: string
  updated_at: string
}

interface GrLocationPinRow {
  id: string
  floor_plan_id: string
  location_id: string
  x_pct: number
  y_pct: number
  created_by: string | null
  created_at: string
  updated_at: string
}

async function toFloorPlan(row: GrFloorPlanRow): Promise<FloorPlan> {
  const { data, error } = await supabase!.storage.from(BUCKET).createSignedUrl(row.image_url, SIGNED_URL_TTL_SECONDS)
  if (error) throw error

  return {
    id: row.id,
    projectCode: row.project_code,
    floorLevel: row.floor_level,
    imageUrl: data.signedUrl,
    imageWidth: row.image_width ?? undefined,
    imageHeight: row.image_height ?? undefined,
    uploadedBy: row.uploaded_by ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapPinRow(row: GrLocationPinRow): LocationPin {
  return {
    id: row.id,
    floorPlanId: row.floor_plan_id,
    locationId: row.location_id,
    xPct: row.x_pct,
    yPct: row.y_pct,
    createdBy: row.created_by ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function extensionFor(fileName: string): string {
  const match = fileName.match(/\.([a-zA-Z0-9]+)$/)
  return match ? match[1].toLowerCase() : 'jpg'
}

function readImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read image dimensions.'))
    }
    img.src = url
  })
}

// Mock-only in-memory stores.
const mockFloorPlans: FloorPlan[] = []
const mockPins: LocationPin[] = []
let mockPlanCounter = 1
let mockPinCounter = 1

export async function getFloorPlan(projectCode: string, floorLevel: string): Promise<FloorPlan | null> {
  if (!isSupabaseConfigured) {
    return mockFloorPlans.find((p) => p.projectCode === projectCode && p.floorLevel === floorLevel) ?? null
  }

  const { data, error } = await supabase!
    .from('gr_floor_plans')
    .select('*')
    .eq('project_code', projectCode)
    .eq('floor_level', floorLevel)
    .maybeSingle()

  if (error) throw error
  return data ? toFloorPlan(data as GrFloorPlanRow) : null
}

export async function uploadFloorPlan(
  projectCode: string,
  floorLevel: string,
  file: File,
  uploadedBy: string,
): Promise<FloorPlan> {
  const { width, height } = await readImageDimensions(file)

  if (!isSupabaseConfigured) {
    const existingIdx = mockFloorPlans.findIndex((p) => p.projectCode === projectCode && p.floorLevel === floorLevel)
    const now = new Date().toISOString()
    const plan: FloorPlan = {
      id: existingIdx >= 0 ? mockFloorPlans[existingIdx].id : `FP-${(mockPlanCounter++).toString().padStart(3, '0')}`,
      projectCode,
      floorLevel,
      imageUrl: URL.createObjectURL(file),
      imageWidth: width,
      imageHeight: height,
      uploadedBy,
      createdAt: existingIdx >= 0 ? mockFloorPlans[existingIdx].createdAt : now,
      updatedAt: now,
    }
    if (existingIdx >= 0) mockFloorPlans[existingIdx] = plan
    else mockFloorPlans.push(plan)
    return plan
  }

  const storagePath = `${projectCode}/${floorLevel}.${extensionFor(file.name)}`

  const { error: uploadError } = await supabase!.storage.from(BUCKET).upload(storagePath, file, {
    contentType: file.type || undefined,
    upsert: true, // re-upload replaces the existing image at the same path
  })
  if (uploadError) throw uploadError

  const { data: insertedRow, error: upsertError } = await supabase!
    .from('gr_floor_plans')
    .upsert(
      {
        project_code: projectCode,
        floor_level: floorLevel,
        image_url: storagePath,
        image_width: width,
        image_height: height,
        uploaded_by: uploadedBy,
      },
      { onConflict: 'project_code,floor_level' },
    )
    .select('*')
    .single()

  if (upsertError) throw upsertError
  return toFloorPlan(insertedRow as GrFloorPlanRow)
}

export async function getPinsForFloorPlan(floorPlanId: string): Promise<LocationPin[]> {
  if (!isSupabaseConfigured) {
    return mockPins.filter((p) => p.floorPlanId === floorPlanId)
  }

  const { data, error } = await supabase!
    .from('gr_location_pins')
    .select('*')
    .eq('floor_plan_id', floorPlanId)
    .order('created_at')

  if (error) throw error
  return (data as GrLocationPinRow[]).map(mapPinRow)
}

export async function createPin(
  floorPlanId: string,
  locationId: string,
  xPct: number,
  yPct: number,
  createdBy: string,
): Promise<LocationPin> {
  if (!isSupabaseConfigured) {
    const now = new Date().toISOString()
    const pin: LocationPin = {
      id: `PIN-${(mockPinCounter++).toString().padStart(3, '0')}`,
      floorPlanId,
      locationId,
      xPct,
      yPct,
      createdBy,
      createdAt: now,
      updatedAt: now,
    }
    mockPins.push(pin)
    return pin
  }

  const { data, error } = await supabase!
    .from('gr_location_pins')
    .insert({
      floor_plan_id: floorPlanId,
      location_id: locationId,
      x_pct: xPct,
      y_pct: yPct,
      created_by: createdBy,
    })
    .select('*')
    .single()

  if (error) throw error
  return mapPinRow(data as GrLocationPinRow)
}

export async function updatePinPosition(pinId: string, xPct: number, yPct: number): Promise<void> {
  if (!isSupabaseConfigured) {
    const pin = mockPins.find((p) => p.id === pinId)
    if (pin) {
      pin.xPct = xPct
      pin.yPct = yPct
      pin.updatedAt = new Date().toISOString()
    }
    return
  }

  const { error } = await supabase!
    .from('gr_location_pins')
    .update({ x_pct: xPct, y_pct: yPct })
    .eq('id', pinId)

  if (error) throw error
}

export async function deletePin(pinId: string): Promise<void> {
  if (!isSupabaseConfigured) {
    const idx = mockPins.findIndex((p) => p.id === pinId)
    if (idx >= 0) mockPins.splice(idx, 1)
    return
  }

  const { error } = await supabase!.from('gr_location_pins').delete().eq('id', pinId)
  if (error) throw error
}
