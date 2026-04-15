/**
 * ImageGen — thin wrapper over Google's Imagen 4 predict API.
 *
 * One request returns N images via sampleCount; no parallel fanout needed.
 * The API key is supplied by the caller (from localStorage).
 */

const IMAGEN_MODEL = 'imagen-4.0-generate-001'
const IMAGEN_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${IMAGEN_MODEL}:predict`

// Imagen aspect ratios. Defaults per slot are picked by the caller.
export const ASPECT_RATIOS = ['1:1', '9:16', '16:9', '3:4', '4:3']

export const DEFAULT_ASPECT_FOR_SLOT = {
  cover: '16:9',
  'default-bg': '16:9',
  scene: '16:9',
  portrait: '3:4',
}

/** Decode a base64 string to a Blob of the given mime type. */
function base64ToBlob(b64, mimeType) {
  const bin = atob(b64)
  const len = bin.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mimeType || 'image/png' })
}

/**
 * Generate N images via Imagen.
 *
 * @param {string} apiKey - Google AI Studio API key
 * @param {object} opts
 * @param {string} opts.prompt - User prompt (passed through verbatim)
 * @param {number} [opts.sampleCount=2] - Number of variations (1–4)
 * @param {string} [opts.aspectRatio='1:1'] - One of ASPECT_RATIOS
 * @returns {Promise<Blob[]>} Array of image blobs
 * @throws Error with a human-readable message on refusal / network / quota failure
 */
export async function generateImages(apiKey, { prompt, sampleCount = 2, aspectRatio = '1:1' }) {
  if (!apiKey) throw new Error('Missing Google AI API key')
  if (!prompt || !prompt.trim()) throw new Error('Prompt is empty')

  const body = {
    instances: [{ prompt: prompt.trim() }],
    parameters: {
      sampleCount: Math.max(1, Math.min(4, sampleCount | 0)),
      aspectRatio,
      // Loosest publicly available Imagen settings. Imagen still has hardcoded
      // red-lines (minors, real-person likenesses) that cannot be disabled.
      personGeneration: 'ALLOW_ADULT',
      safetyFilterLevel: 'BLOCK_ONLY_HIGH',
    },
  }

  let res
  try {
    res = await fetch(IMAGEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
      },
      body: JSON.stringify(body),
    })
  } catch (e) {
    throw new Error(`Network error: ${e.message}`)
  }

  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      detail = body?.error?.message || detail
    } catch { /* ignore parse failures */ }
    throw new Error(`Imagen ${res.status}: ${detail}`)
  }

  const data = await res.json()
  const predictions = Array.isArray(data?.predictions) ? data.predictions : []

  // Imagen silently drops refused images — zero predictions means the whole
  // request was filtered.
  if (predictions.length === 0) {
    const reason = data?.raiFilteredReason || data?.raiReasons?.[0] || 'Image was filtered by safety policy.'
    throw new Error(`Generation refused: ${reason}`)
  }

  const blobs = []
  for (const p of predictions) {
    // Per-image refusal field
    if (p.raiFilteredReason && !p.bytesBase64Encoded) continue
    if (!p.bytesBase64Encoded) continue
    blobs.push(base64ToBlob(p.bytesBase64Encoded, p.mimeType || 'image/png'))
  }

  if (blobs.length === 0) {
    throw new Error('Generation refused: all candidates were filtered.')
  }

  return blobs
}
