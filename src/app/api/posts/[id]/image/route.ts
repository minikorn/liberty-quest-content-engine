/**
 * POST /api/posts/[id]/image
 *
 * Generates (or re-generates) an image for a specific post.
 * Stores the result in generated_image_url.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getPost, updatePost } from '@/lib/db'
import { generateAndStoreImage } from '@/lib/images'

export const maxDuration = 60

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id, 10)
    const post = await getPost(id)

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    if (!post.image_prompt) {
      return NextResponse.json(
        { error: 'Post has no image_prompt to generate from' },
        { status: 400 }
      )
    }

    const imageUrl = await generateAndStoreImage(post.post_type, post.image_prompt)

    const updated = await updatePost(id, { image_url: imageUrl })

    return NextResponse.json({
      success: true,
      imageUrl,
      post: updated,
    })
  } catch (error) {
    console.error('POST /api/posts/[id]/image error:', error)
    return NextResponse.json(
      { error: 'Image generation failed', detail: String(error) },
      { status: 500 }
    )
  }
}
