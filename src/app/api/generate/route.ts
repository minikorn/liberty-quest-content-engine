import { NextRequest, NextResponse } from 'next/server'
import { generateBatch, generateAndSavePost } from '@/lib/generator'
import type { PostType } from '@/types'

export const maxDuration = 300 // 5 minutes for batch generation

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const count: number = body.count ?? 30
    const type: PostType | undefined = body.type

    if (count < 1 || count > 50) {
      return NextResponse.json(
        { error: 'count must be between 1 and 50' },
        { status: 400 }
      )
    }

    // Single post of a specific type
    if (type) {
      const post = await generateAndSavePost(type)
      return NextResponse.json({ generated: 1, errors: 0, posts: [post] })
    }

    // Batch generation with weighted distribution
    const result = await generateBatch(count)
    return NextResponse.json(result)
  } catch (error) {
    console.error('POST /api/generate error:', error)
    return NextResponse.json(
      { error: 'Content generation failed', detail: String(error) },
      { status: 500 }
    )
  }
}
