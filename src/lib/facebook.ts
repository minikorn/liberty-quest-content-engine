/**
 * Facebook Graph API publisher
 *
 * Docs: https://developers.facebook.com/docs/pages/publishing
 *
 * Required env vars:
 *   FACEBOOK_PAGE_ID           — your Page's numeric ID
 *   FACEBOOK_PAGE_ACCESS_TOKEN — long-lived Page access token
 */

interface FacebookPostResult {
  id: string  // format: "{page-id}_{post-id}"
}

interface FacebookError {
  error: {
    message: string
    type: string
    code: number
    fbtrace_id: string
  }
}

class FacebookAPIError extends Error {
  code: number
  constructor(message: string, code: number) {
    super(message)
    this.name = 'FacebookAPIError'
    this.code = code
  }
}

function getCredentials(): { pageId: string; token: string } {
  const pageId = process.env.FACEBOOK_PAGE_ID
  const token = process.env.FACEBOOK_PAGE_ACCESS_TOKEN
  if (!pageId || !token) {
    throw new Error(
      'FACEBOOK_PAGE_ID and FACEBOOK_PAGE_ACCESS_TOKEN must be set'
    )
  }
  return { pageId, token }
}

/**
 * Publish a text post (with optional link) to the Facebook Page.
 */
export async function publishTextPost(options: {
  message: string
  link?: string
}): Promise<string> {
  const { pageId, token } = getCredentials()
  const url = `https://graph.facebook.com/v20.0/${pageId}/feed`

  const body: Record<string, string> = {
    message: options.message,
    access_token: token,
  }
  if (options.link) body.link = options.link

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const data = await response.json() as FacebookPostResult | FacebookError

  if ('error' in data) {
    throw new FacebookAPIError(
      `Facebook API error: ${data.error.message}`,
      data.error.code
    )
  }

  return data.id
}

/**
 * Publish a photo post (image URL + caption) to the Facebook Page.
 * Uses the /photos endpoint which creates a photo post with a caption.
 */
export async function publishPhotoPost(options: {
  caption: string
  imageUrl: string
  link?: string
}): Promise<string> {
  const { pageId, token } = getCredentials()
  const url = `https://graph.facebook.com/v20.0/${pageId}/photos`

  const body: Record<string, string> = {
    caption: options.caption,
    url: options.imageUrl,
    access_token: token,
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const data = await response.json() as { post_id: string } | FacebookError

  if ('error' in data) {
    throw new FacebookAPIError(
      `Facebook API error: ${data.error.message}`,
      data.error.code
    )
  }

  return data.post_id
}

/**
 * Main publish function — chooses text or photo based on whether an image is provided.
 * Retries once on transient errors (codes 1, 2, 341).
 */
export async function publishPost(options: {
  message: string
  imageUrl?: string | null
  link?: string | null
}): Promise<string> {
  const TRANSIENT_CODES = new Set([1, 2, 341, 368])

  async function attempt(): Promise<string> {
    if (options.imageUrl) {
      return publishPhotoPost({
        caption: options.message,
        imageUrl: options.imageUrl,
        link: options.link ?? undefined,
      })
    }
    return publishTextPost({
      message: options.message,
      link: options.link ?? undefined,
    })
  }

  try {
    return await attempt()
  } catch (err) {
    if (err instanceof FacebookAPIError && TRANSIENT_CODES.has(err.code)) {
      // Wait 5 seconds and retry once
      await new Promise(r => setTimeout(r, 5000))
      return attempt()
    }
    throw err
  }
}

/**
 * Fetch engagement metrics for a published post.
 */
export async function getEngagement(facebookPostId: string): Promise<{
  likes: number
  comments: number
  shares: number
}> {
  const { token } = getCredentials()
  const url = `https://graph.facebook.com/v20.0/${facebookPostId}` +
    `?fields=reactions.summary(true),comments.summary(true),shares` +
    `&access_token=${token}`

  const response = await fetch(url)
  const data = await response.json() as {
    reactions?: { summary?: { total_count: number } }
    comments?: { summary?: { total_count: number } }
    shares?: { count: number }
  } | FacebookError

  if ('error' in data) {
    console.error('Failed to fetch engagement:', data.error.message)
    return { likes: 0, comments: 0, shares: 0 }
  }

  return {
    likes: data.reactions?.summary?.total_count ?? 0,
    comments: data.comments?.summary?.total_count ?? 0,
    shares: data.shares?.count ?? 0,
  }
}
