/**
 * Railway Cron: Auto-schedule posts
 *
 * Fills the next 7 days of posting slots with available draft/approved posts.
 * Runs every 6 hours to keep the queue topped up without manual intervention.
 *
 * Posting slots (UTC): 13:00, 17:00, 21:00
 *   = 9 AM / 1 PM / 5 PM Eastern
 *   = 6 AM / 10 AM / 2 PM Pacific
 *
 * Set up in Railway:
 *   Schedule: 0 *\/6 * * *   (every 6 hours)
 *   Command:  curl -X POST $NEXT_PUBLIC_APP_URL/api/cron/schedule
 *             -H "Authorization: Bearer $CRON_SECRET"
 *
 * Idempotent — re-running never double-schedules a slot.
 */
import { NextRequest, NextResponse } from 'next/server'
import { query, updatePost } from '@/lib/db'
import type { ContentPost } from '@/types'

export const maxDuration = 60

// Daily posting slot hours in UTC. Adjust to suit your audience's timezone.
// 3 posts/day = 13:00, 17:00, 21:00 UTC (9AM, 1PM, 5PM Eastern)
const DAILY_SLOTS_UTC: number[] = [13, 17, 21]

// How many days ahead to fill
const HORIZON_DAYS = 7

// Minimum gap in minutes — slots within this window of an existing post are
// treated as "occupied" even if the times don't match exactly
const SLOT_WINDOW_MINUTES = 60

function isAuthorized(request: NextRequest): boolean {
  const auth = request.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return auth === `Bearer ${secret}`
}

/** Build the full list of future slot times within the horizon */
function buildSlots(): Date[] {
  const slots: Date[] = []
  const now = new Date()
  const cutoff = Date.now() + 30 * 60 * 1000 // skip slots less than 30 min away

  for (let d = 0; d < HORIZON_DAYS; d++) {
    for (const hour of DAILY_SLOTS_UTC) {
      const slot = new Date(now)
      slot.setUTCDate(now.getUTCDate() + d)
      slot.setUTCHours(hour, 0, 0, 0)
      if (slot.getTime() > cutoff) {
        slots.push(slot)
      }
    }
  }

  return slots.sort((a, b) => a.getTime() - b.getTime())
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const slots = buildSlots()

    // Fetch already-scheduled posts in the horizon window
    const horizon = new Date(Date.now() + HORIZON_DAYS * 24 * 60 * 60 * 1000)
    const alreadyScheduled = await query<Pick<ContentPost, 'scheduled_for'>>(
      `SELECT scheduled_for FROM content_posts
       WHERE status = 'scheduled'
         AND scheduled_for >= NOW()
         AND scheduled_for <= $1`,
      [horizon.toISOString()]
    )

    const occupiedMs = alreadyScheduled
      .map(p => new Date(p.scheduled_for!).getTime())

    const windowMs = SLOT_WINDOW_MINUTES * 60 * 1000

    // Filter to slots that have no existing post within the window
    const emptySlots = slots.filter(slot =>
      !occupiedMs.some(t => Math.abs(t - slot.getTime()) < windowMs)
    )

    if (emptySlots.length === 0) {
      return NextResponse.json({
        scheduled: 0,
        message: `All ${slots.length} slots filled for the next ${HORIZON_DAYS} days`,
      })
    }

    // Grab enough drafts/approved posts to fill the empty slots, oldest first
    // (oldest first = FIFO so content ages naturally through the queue)
    const available = await query<ContentPost>(
      `SELECT * FROM content_posts
       WHERE status IN ('draft', 'approved')
       ORDER BY created_at ASC
       LIMIT $1`,
      [emptySlots.length]
    )

    if (available.length === 0) {
      return NextResponse.json({
        scheduled: 0,
        message: 'No draft or approved posts available — run generate cron first',
        emptySlotsAvailable: emptySlots.length,
      })
    }

    // Pair posts to slots and schedule them
    const results: { id: number; scheduledFor: string }[] = []

    for (let i = 0; i < Math.min(available.length, emptySlots.length); i++) {
      const post = available[i]
      const slot = emptySlots[i]

      await updatePost(post.id, {
        status: 'scheduled',
        scheduled_for: slot.toISOString(),
      })

      results.push({ id: post.id, scheduledFor: slot.toISOString() })
    }

    return NextResponse.json({
      scheduled: results.length,
      slotsAvailable: emptySlots.length,
      postsAvailable: available.length,
      results,
    })
  } catch (error) {
    console.error('POST /api/cron/schedule error:', error)
    return NextResponse.json(
      { error: 'Schedule cron failed', detail: String(error) },
      { status: 500 }
    )
  }
}
