/**
 * Liberty Quest Image Engine
 *
 * All post types use Unsplash for real photography.
 *
 * Required env vars:
 *   UNSPLASH_ACCESS_KEY         — from unsplash.com/developers
 *   CLOUDINARY_CLOUD_NAME       — your Cloudinary cloud name (optional but recommended)
 *   CLOUDINARY_UPLOAD_PRESET    — unsigned upload preset (optional but recommended)
 *
 * Without Cloudinary, Unsplash URLs are used directly. With Cloudinary,
 * images are re-hosted for permanence and faster delivery.
 */

import type { PostType } from '@/types'

// ---------------------------------------------------------------------------
// Post type → image strategy (all use Unsplash)
// ---------------------------------------------------------------------------

type ImageStrategy = 'unsplash'

const STRATEGY_MAP: Record<PostType, ImageStrategy> = {
  can_you_beat_grandpa: 'unsplash',
  answer_reveal: 'unsplash',
  liberty_quest_product: 'unsplash',
  family_memory: 'unsplash',
  this_week_in_history: 'unsplash',
  american_heroes: 'unsplash',
  american_inventions: 'unsplash',
  did_you_know: 'unsplash',
  poll_question: 'unsplash',
  quote_of_the_day: 'unsplash',
}

// ---------------------------------------------------------------------------
// Unsplash image search
// ---------------------------------------------------------------------------

interface UnsplashPhoto {
  id: string
  urls: { regular: string; small: string }
  alt_description: string | null
  user: { name: string; links: { html: string } }
  links: { html: string }
}

interface UnsplashSearchResult {
  results: UnsplashPhoto[]
  total: number
}

/**
 * Extract clean search keywords from an image prompt.
 * Strips style/aesthetic words and keeps subject matter.
 */
function extractUnsplashKeywords(imagePrompt: string): string {
  const stripWords = [
    'vintage', 'illustration', 'style', 'aesthetic', 'artistic', 'painting',
    'drawing', 'render', 'detailed', 'dramatic', 'cinematic', 'warm', 'sepia',
    'tones', 'colors', 'inspired', 'historic', 'period-accurate', 'depicted',
    'showing', 'scene of', 'image of', 'picture of', 'photo of',
  ]
  let cleaned = imagePrompt.toLowerCase()
  for (const word of stripWords) {
    cleaned = cleaned.replace(new RegExp(`\\b${word}\\b`, 'g'), '')
  }
  // Take first ~6 meaningful words
  const words = cleaned.split(/\s+/).filter(w => w.length > 3).slice(0, 6)
  return words.join(' ').trim() || imagePrompt.slice(0, 60)
}

async function searchUnsplash(imagePrompt: string): Promise<string> {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY
  if (!accessKey) throw new Error('UNSPLASH_ACCESS_KEY not set')

  const query = extractUnsplashKeywords(imagePrompt)
  const url = `https://api.unsplash.com/search/photos?` +
    `query=${encodeURIComponent(query)}&` +
    `orientation=landscape&` +
    `per_page=10&` +
    `content_filter=high`

  const response = await fetch(url, {
    headers: {
      Authorization: `Client-ID ${accessKey}`,
      'Accept-Version': 'v1',
    },
  })

  if (!response.ok) {
    throw new Error(`Unsplash API error: ${response.status} ${response.statusText}`)
  }

  const data = await response.json() as UnsplashSearchResult

  if (!data.results || data.results.length === 0) {
    // Fall back to a broader search
    return searchUnsplashFallback(imagePrompt)
  }

  // Pick from the top 5 results randomly for variety
  const top = data.results.slice(0, 5)
  const photo = top[Math.floor(Math.random() * top.length)]

  // Trigger download event per Unsplash API guidelines
  await triggerUnsplashDownload(photo.id, accessKey)

  return photo.urls.regular
}

async function searchUnsplashFallback(imagePrompt: string): Promise<string> {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY!
  // Broader Americana history fallback queries
  const fallbacks = [
    'american history vintage',
    'united states historical',
    'americana vintage photograph',
    'american heritage',
  ]
  const query = fallbacks[Math.floor(Math.random() * fallbacks.length)]
  const url = `https://api.unsplash.com/search/photos?` +
    `query=${encodeURIComponent(query)}&orientation=landscape&per_page=20`

  const response = await fetch(url, {
    headers: { Authorization: `Client-ID ${accessKey}`, 'Accept-Version': 'v1' },
  })
  const data = await response.json() as UnsplashSearchResult
  const photo = data.results[Math.floor(Math.random() * Math.min(data.results.length, 10))]
  if (!photo) throw new Error('No Unsplash results even for fallback query')
  await triggerUnsplashDownload(photo.id, accessKey)
  return photo.urls.regular
}

async function triggerUnsplashDownload(photoId: string, accessKey: string): Promise<void> {
  // Required by Unsplash API guidelines when you use a photo
  try {
    await fetch(`https://api.unsplash.com/photos/${photoId}/download`, {
      headers: { Authorization: `Client-ID ${accessKey}`, 'Accept-Version': 'v1' },
    })
  } catch {
    // Non-fatal — just a courtesy call
  }
}

// ---------------------------------------------------------------------------
// Cloudinary upload
// ---------------------------------------------------------------------------

interface CloudinaryUploadResult {
  secure_url: string
  public_id: string
  width: number
  height: number
}

/**
 * Upload an image (by URL) to Cloudinary using an unsigned upload preset.
 *
 * Setup in Cloudinary dashboard:
 *   Settings → Upload → Upload presets → Add upload preset
 *   Set signing mode to "Unsigned"
 *   Copy the preset name into CLOUDINARY_UPLOAD_PRESET env var
 */
async function uploadToCloudinary(imageUrl: string): Promise<string> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET

  if (!cloudName || !uploadPreset) {
    throw new Error('CLOUDINARY_CLOUD_NAME and CLOUDINARY_UPLOAD_PRESET must be set')
  }

  const formData = new FormData()
  formData.append('file', imageUrl)
  formData.append('upload_preset', uploadPreset)
  formData.append('folder', 'liberty-quest')

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: 'POST', body: formData }
  )

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Cloudinary upload failed: ${err}`)
  }

  const result = await response.json() as CloudinaryUploadResult
  return result.secure_url
}

// ---------------------------------------------------------------------------
// Main export: generate + store
// ---------------------------------------------------------------------------

export async function generateAndStoreImage(
  postType: PostType,
  imagePrompt: string
): Promise<string> {
  // All strategies use Unsplash — postType retained for future routing if needed
  void STRATEGY_MAP[postType]

  const hasCloudinary =
    !!process.env.CLOUDINARY_CLOUD_NAME && !!process.env.CLOUDINARY_UPLOAD_PRESET

  // Unsplash returns a real, already-hosted URL.
  const sourceUrl = await searchUnsplash(imagePrompt)
  if (!hasCloudinary) {
    console.warn('Cloudinary not configured — returning Unsplash URL directly')
    return sourceUrl
  }
  return await uploadToCloudinary(sourceUrl)
}

/**
 * Check whether image fetching is available.
 */
export function imageGenerationAvailable(): boolean {
  return !!process.env.UNSPLASH_ACCESS_KEY
}

export { STRATEGY_MAP }
