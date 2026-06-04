'use client'

import { useState, useEffect, useCallback } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday } from 'date-fns'
import Link from 'next/link'
import clsx from 'clsx'
import type { ContentPost } from '@/types'
import { POST_TYPE_LABELS, POST_TYPE_COLORS } from '@/types'

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [posts, setPosts] = useState<ContentPost[]>([])
  const [loading, setLoading] = useState(true)

  const loadPosts = useCallback(async () => {
    setLoading(true)
    try {
      // Load scheduled and published posts
      const [scheduledRes, publishedRes] = await Promise.all([
        fetch('/api/posts?status=scheduled&limit=100'),
        fetch('/api/posts?status=published&limit=100'),
      ])
      const [scheduledData, publishedData] = await Promise.all([
        scheduledRes.json(),
        publishedRes.json(),
      ])
      setPosts([...(scheduledData.posts ?? []), ...(publishedData.posts ?? [])])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadPosts() }, [loadPosts])

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  })

  // Pad to start on Sunday
  const startDay = startOfMonth(currentMonth).getDay()
  const paddingDays = Array(startDay).fill(null)

  function getPostsForDay(day: Date): ContentPost[] {
    return posts.filter(p => {
      const date = p.scheduled_for ?? p.published_at
      return date && isSameDay(new Date(date), day)
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-liberty-blue">Content Calendar</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() - 1))}
            className="px-3 py-1 border rounded hover:bg-gray-100"
          >
            ‹ Prev
          </button>
          <span className="font-semibold text-lg">
            {format(currentMonth, 'MMMM yyyy')}
          </span>
          <button
            onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() + 1))}
            className="px-3 py-1 border rounded hover:bg-gray-100"
          >
            Next ›
          </button>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="text-center text-xs font-semibold text-gray-500 py-2">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {paddingDays.map((_, i) => (
          <div key={`pad-${i}`} className="h-24 bg-gray-50 rounded" />
        ))}

        {days.map(day => {
          const dayPosts = getPostsForDay(day)
          return (
            <div
              key={day.toISOString()}
              className={clsx(
                'h-24 rounded p-1.5 border overflow-hidden',
                isToday(day) ? 'border-liberty-red bg-red-50' : 'border-gray-100 bg-white'
              )}
            >
              <div className={clsx(
                'text-xs font-semibold mb-1',
                isToday(day) ? 'text-liberty-red' : 'text-gray-600'
              )}>
                {format(day, 'd')}
              </div>
              <div className="space-y-0.5">
                {dayPosts.slice(0, 3).map(post => (
                  <div
                    key={post.id}
                    className={clsx(
                      'text-xs px-1 py-0.5 rounded truncate',
                      POST_TYPE_COLORS[post.post_type]
                    )}
                    title={post.title}
                  >
                    {post.status === 'published' ? '✅' : '📅'} {post.title}
                  </div>
                ))}
                {dayPosts.length > 3 && (
                  <div className="text-xs text-gray-400">+{dayPosts.length - 3} more</div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="mt-6 bg-white rounded-lg shadow p-4">
        <p className="text-sm font-semibold text-gray-700 mb-3">Content Types</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(POST_TYPE_LABELS).map(([type, label]) => (
            <span
              key={type}
              className={clsx('text-xs px-2 py-1 rounded-full', POST_TYPE_COLORS[type as keyof typeof POST_TYPE_COLORS])}
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-4 text-center">
        <Link href="/drafts?status=approved" className="text-sm text-blue-600 hover:underline">
          → Schedule approved posts from the Draft Queue
        </Link>
      </div>
    </div>
  )
}
