/**
 * Railway Cron: Generate content batch
 *
 * Set up in Railway:
 *   Schedule: 0 9 * * 1   (every Monday at 9 AM)
 *   Command:  curl -X POST $NEXT_PUBLIC_APP_URL/api/cron/generate
 *             -H "Authorization: Bearer $CRON_SECRET"
 */
import { NextRequest, NextResponse } from 'next/server'
import { getDraftCount } from '@/lib/db'
import { generateBatch } from '@/lib/generator'

export const maxDuration = 300

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
    // Only generate if draft queue is low (< 10 posts)
    const draftCount = await getDraftCount()
    if (draftCount >= 10) {
      return NextResponse.json({
        skipped: true,
        reason: `Draft queue has ${draftCount} posts — no generation needed`,
      })
    }

    const needed = Math.max(10, 30 - draftCount)
    const result = await generateBatch(needed)

    return NextResponse.json({
      success: true,
      generated: result.generated,
      errors: result.errors,
      draftCountBefore: draftCount,
    })
  } catch (error) {
    console.error('Cron generate error:', error)
    return NextResponse.json(
      { error: 'Generation failed', detail: String(error) },
      { status: 500 }
    )
  }
}
