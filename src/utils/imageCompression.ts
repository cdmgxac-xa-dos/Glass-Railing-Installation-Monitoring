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
