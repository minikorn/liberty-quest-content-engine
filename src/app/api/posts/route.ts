import { NextRequest, NextResponse } from 'next/server'
import { getPosts } from '@/lib/db'
import type { PostStatus, PostType } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') as PostStatus | null
    const post_type = searchParams.get('post_type') as PostType | null
    const limit = parseInt(searchParams.get('limit') ?? '50', 10)
    const offset = parseInt(searchParams.get('offset') ?? '0', 10)

    const posts = await getPosts({
      status: status ?? undefined,
      post_type: post_type ?? undefined,
      limit,
      offset,
    })

    return NextResponse.json({ posts })
  } catch (error) {
    console.error('GET /api/posts error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch posts' },
      { status: 500 }
    )
  }
}
