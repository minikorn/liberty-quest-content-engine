import { NextRequest, NextResponse } from 'next/server'
import { getPost, updatePost } from '@/lib/db'
import { publishPost } from '@/lib/facebook'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { postId } = body as { postId: number }

    if (!postId) {
      return NextResponse.json({ error: 'postId is required' }, { status: 400 })
    }

    const post = await getPost(postId)
    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    if (!['approved', 'scheduled'].includes(post.status)) {
      return NextResponse.json(
        { error: `Cannot publish a post with status "${post.status}". Must be approved or scheduled.` },
        { status: 400 }
      )
    }

    // Publish to Facebook
    const facebookPostId = await publishPost({
      message: post.body,
      imageUrl: post.image_url ?? post.generated_image_url,
      link: post.link_url,
    })

    // Mark as published in DB
    const updated = await updatePost(postId, {
      status: 'published',
      published_at: new Date().toISOString(),
      facebook_post_id: facebookPostId,
    })

    return NextResponse.json({
      success: true,
      post: updated,
      facebookPostId,
    })
  } catch (error) {
    console.error('POST /api/publish error:', error)

    // If we have a postId, mark it as failed
    try {
      const body = await request.json().catch(() => ({})) as { postId?: number }
      if (body.postId) {
        await updatePost(body.postId, { status: 'failed' })
      }
    } catch { /* ignore */ }

    return NextResponse.json(
      { error: 'Publishing failed', detail: String(error) },
      { status: 500 }
    )
  }
}
