// ---------------------------------------------------------------------------
// Shared client-side image compression, used by every photo/image upload
// path in the app — photoService.ts (location Before/During/After photos,
// QC/punch-list photos) and floorPlanService.ts (floor plan images).
// Extracted from photoService.ts so floorPlanService.ts didn't need a
// parallel copy of the same logic.
//
// Modern phone cameras produce 2-6MB+ photos straight off the sensor.
// Uploading them uncompressed drives up both field data usage (workers are
// commonly on mobile data, not wifi) and Storage costs at volume.
// compressImage() resizes to a max dimension and re-encodes as JPEG
// in-browser (Canvas API, no external library) before upload. Falls back to
// the original file if compression fails for any reason (e.g. an
// unsupported format) or doesn't actually shrink the file, rather than
// blocking the upload outright.
//
// compressPhotoForUpload() is the newer, two-tier variant used specifically
// by photoService.ts's field photo capture path (locked spec, 2026-08-09):
// a ~400-600KB main image plus a ~50KB thumbnail, both generated from the
// same decoded bitmap (so the thumbnail isn't a lossy re-encode of an
// already-lossy main image) and both uploaded — nothing near the original
// 3-8MB camera file ever leaves the device. Mirrors the same budget already
// locked for the sibling xa-photolog app. floorPlanService.ts intentionally
// keeps using the single-tier compressImage() below — floor plans are a
// one-per-floor reference document (zoom/pin placement wants the higher
// single-image quality), not a high-volume per-photo capture flow.
// ---------------------------------------------------------------------------

const COMPRESS_MAX_DIMENSION = 1600 // px, longest side
const COMPRESS_QUALITY = 0.82 // JPEG quality, 0-1
const COMPRESS_SKIP_BELOW_BYTES = 500 * 1024 // don't bother compressing already-small files

export async function compressImage(file: File): Promise<File> {
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

    // toBlob(), not toDataURL() — avoids base64's ~33% size overhead for
    // what's about to be uploaded as a binary file anyway.
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
    console.warn('Image compression failed, uploading original file instead:', err)
    return file
  }
}

// ---- Two-tier main + thumbnail compression --------------------------------

const MAIN_MAX_DIMENSION = 1280 // px, longest side
const MAIN_MAX_BYTES = 600 * 1024 // ceiling of the locked ~400-600KB budget

const THUMB_MAX_DIMENSION = 320 // px, longest side
const THUMB_MAX_BYTES = 50 * 1024 // ~50KB budget

// Quality ladder every tier steps down through until it lands at or under
// its byte ceiling. Starting at 0.85 favors keeping quality high when the
// ceiling is easily met; the floor of 0.4 keeps even busy/high-detail
// photos from spiraling into visible blocking artifacts — if the image is
// still over budget at 0.4, that quality's result is used as-is (best
// effort) rather than degrading further.
const QUALITY_STEPS = [0.85, 0.75, 0.65, 0.55, 0.45, 0.4]

function drawToCanvas(bitmap: ImageBitmap, maxDimension: number): HTMLCanvasElement | null {
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.drawImage(bitmap, 0, 0, width, height)
  return canvas
}

function encodeJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
}

// Encodes `canvas` at descending quality until the result fits `maxBytes`,
// returning the last (lowest-quality) attempt if none fit.
async function encodeWithinBudget(canvas: HTMLCanvasElement, maxBytes: number): Promise<Blob | null> {
  let best: Blob | null = null
  for (const quality of QUALITY_STEPS) {
    const blob = await encodeJpeg(canvas, quality)
    if (!blob) continue
    best = blob
    if (blob.size <= maxBytes) return blob
  }
  return best
}

function toJpegFile(blob: Blob, originalName: string, suffix: string): File {
  const baseName = originalName.replace(/\.[^./]+$/, '')
  return new File([blob], `${baseName}${suffix}.jpg`, { type: 'image/jpeg', lastModified: Date.now() })
}

// Produces the two files photoService.ts uploads for every field photo: a
// ~400-600KB main image capped at 1280px, and a ~50KB thumbnail capped at
// 320px, both re-encoded from the same decoded bitmap. Falls back to
// returning the original file for both tiers if decoding/canvas fails for
// any reason (e.g. an unsupported format) — same fail-open behavior as
// compressImage() above, so a compression bug never blocks a field upload.
export async function compressPhotoForUpload(file: File): Promise<{ main: File; thumbnail: File }> {
  try {
    const bitmap = await createImageBitmap(file)

    const mainCanvas = drawToCanvas(bitmap, MAIN_MAX_DIMENSION)
    const thumbCanvas = drawToCanvas(bitmap, THUMB_MAX_DIMENSION)
    bitmap.close?.()
    if (!mainCanvas || !thumbCanvas) return { main: file, thumbnail: file }

    const [mainBlob, thumbBlob] = await Promise.all([
      encodeWithinBudget(mainCanvas, MAIN_MAX_BYTES),
      encodeWithinBudget(thumbCanvas, THUMB_MAX_BYTES),
    ])
    if (!mainBlob || !thumbBlob) return { main: file, thumbnail: file }

    return {
      main: mainBlob.size < file.size ? toJpegFile(mainBlob, file.name, '') : file,
      thumbnail: toJpegFile(thumbBlob, file.name, '_thumb'),
    }
  } catch (err) {
    console.warn('Photo compression failed, uploading original file for both tiers instead:', err)
    return { main: file, thumbnail: file }
  }
}
