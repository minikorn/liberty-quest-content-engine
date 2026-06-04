/**
 * Railway Cron: Auto-publish scheduled posts
 *
 * Set up in Railway:
 *   Schedule: 0 10 * * *   (every day at 10 AM)
 *   Command:  curl -X POST $NEXT_PUBLIC_APP_URL/api/cron/publish
 *             -H "Authorization: Bearer $CRON_SECRET"
 */
import { NextRequest, NextResponse } from 'next/server'
import { getScheduledPostsDue, updatePost } from '@/lib/db'
import { publishPost } from '@/lib/facebook'

export const maxDuration = 120

function isAuthorized(request: NextRequest): boolean {
  const auth = request.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return auth === `Bearer ${secret}`
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const due = await getScheduledPostsDue()

    if (due.length === 0) {
      return NextResponse.json({ published: 0, message: 'No posts due' })
    }

    const results = []

    for (const post of due) {
      try {
        const facebookPostId = await publishPost({
          message: post.body,
          imageUrl: post.image_url ?? post.generated_image_url,
          link: post.link_url,
        })

        await updatePost(post.id, {
          status: 'published',
          published_at: new Date().toISOString(),
          facebook_post_id: facebookPostId,
        })

        results.push({ id: post.id, status: 'published', facebookPostId })
      } catch (err) {
        await updatePost(post.id, { status: 'failed' })
        results.push({ id: post.id, status: 'failed', error: String(err) })
      }

      // Brief pause between posts
      await new Promise(r => setTimeout(r, 2000))
    }

    const published = results.filter(r => r.status === 'published').length
    const failed = results.filter(r => r.status === 'failed').length

    return NextResponse.json({ published, failed, results })
  } catch (error) {
    console.error('Cron publish error:', error)
    return NextResponse.json(
      { error: 'Publish cron failed', detail: String(error) },
      { status: 500 }
    )
  }
}
