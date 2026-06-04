'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import type { ContentPost, PostType } from '@/types'
import { POST_TYPE_LABELS } from '@/types'

interface Stats {
  drafts: number
  approved: number
  scheduled: number
  published: number
  publishedThisWeek: number
}

const POST_TYPES: PostType[] = [
  'can_you_beat_grandpa',
  'this_week_in_history',
  'american_inventions',
  'american_heroes',
  'liberty_quest_product',
  'family_memory',
]

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [upcoming, setUpcoming] = useState<ContentPost[]>([])
  const [generating, setGenerating] = useState(false)
  const [generateCount, setGenerateCount] = useState(30)
  const [generateType, setGenerateType] = useState<PostType | ''>('')
  const [generateResult, setGenerateResult] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      const [draftsRes, approvedRes, scheduledRes, publishedRes, weekRes, upcomingRes] =
        await Promise.all([
          fetch('/api/posts?status=draft&limit=1'),
          fetch('/api/posts?status=approved&limit=1'),
          fetch('/api/posts?status=scheduled&limit=1'),
          fetch('/api/posts?status=published&limit=1'),
          fetch('/api/posts?status=published&limit=100'),
          fetch('/api/posts?status=scheduled&limit=7'),
        ])

      const [draftsData, approvedData, scheduledData, publishedData, weekData, upcomingData] =
        await Promise.all([
          draftsRes.json(), approvedRes.json(), scheduledRes.json(),
          publishedRes.json(), weekRes.json(), upcomingRes.json(),
        ])

      // Count published this week
      const now = new Date()
      const weekStart = new Date(now)
      weekStart.setDate(now.getDate() - now.getDay())
      weekStart.setHours(0, 0, 0, 0)
      const weekCount = (weekData.posts as ContentPost[]).filter(
        p => p.published_at && new Date(p.published_at) >= weekStart
      ).length

      setStats({
        drafts: draftsData.posts?.length ?? 0,
        approved: approvedData.posts?.length ?? 0,
        scheduled: scheduledData.posts?.length ?? 0,
        published: publishedData.posts?.length ?? 0,
        publishedThisWeek: weekCount,
      })
      setUpcoming(upcomingData.posts ?? [])
    } catch (err) {
      console.error('Failed to load dashboard data:', err)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  async function handleGenerate() {
    setGenerating(true)
    setGenerateResult(null)
    try {
      const body: Record<string, unknown> = { count: generateCount }
      if (generateType) body.type = generateType

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (res.ok) {
        setGenerateResult(
          `✅ Generated ${data.generated} posts (${data.errors} errors). Check the Draft Queue!`
        )
        loadData()
      } else {
        setGenerateResult(`❌ Error: ${data.error}`)
      }
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-liberty-blue mb-1">
          🦅 Liberty Quest Content Engine
        </h1>
        <p className="text-gray-600">Your automated newspaper editor — never misses a publication date.</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {[
          { label: 'Drafts', value: stats?.drafts, color: 'bg-gray-100', link: '/drafts?status=draft' },
          { label: 'Approved', value: stats?.approved, color: 'bg-blue-100', link: '/drafts?status=approved' },
          { label: 'Scheduled', value: stats?.scheduled, color: 'bg-amber-100', link: '/calendar' },
          { label: 'This Week', value: stats?.publishedThisWeek, color: 'bg-green-100', link: '/published' },
          { label: 'Total Published', value: stats?.published, color: 'bg-green-50', link: '/published' },
        ].map(stat => (
          <Link key={stat.label} href={stat.link}>
            <div className={`${stat.color} rounded-lg p-4 text-center hover:shadow-md transition-shadow cursor-pointer`}>
              <div className="text-3xl font-bold text-liberty-blue">
                {stats ? stat.value : '—'}
              </div>
              <div className="text-sm text-gray-600 mt-1">{stat.label}</div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Generate content */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-liberty-blue mb-4">Generate Content</h2>
          <p className="text-sm text-gray-600 mb-4">
            AI will generate posts using the Liberty Quest Editorial Constitution.
            All posts go to Draft Queue for your approval — nothing publishes automatically.
          </p>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Content Type
              </label>
              <select
                value={generateType}
                onChange={e => setGenerateType(e.target.value as PostType | '')}
                className="w-full border rounded px-3 py-2 text-sm"
              >
                <option value="">Weighted mix (recommended)</option>
                {POST_TYPES.map(type => (
                  <option key={type} value={type}>{POST_TYPE_LABELS[type]}</option>
                ))}
              </select>
            </div>

            {!generateType && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Number of posts to generate
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={generateCount}
                  onChange={e => setGenerateCount(parseInt(e.target.value, 10))}
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={generating}
              className="w-full bg-liberty-blue hover:bg-blue-900 text-white font-bold py-3 px-6 rounded disabled:opacity-50 transition-colors"
            >
              {generating
                ? `⏳ Generating… (this takes 1-3 minutes)`
                : generateType
                ? `Generate 1 ${POST_TYPE_LABELS[generateType as PostType]} post`
                : `Generate ${generateCount} Posts`}
            </button>

            {generateResult && (
              <p className={`text-sm p-3 rounded ${generateResult.startsWith('✅') ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                {generateResult}
              </p>
            )}
          </div>
        </div>

        {/* Upcoming scheduled */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-liberty-blue mb-4">
            Upcoming Scheduled
          </h2>
          {upcoming.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="text-lg mb-2">No posts scheduled</p>
              <p className="text-sm">Approve posts in the Draft Queue and schedule them.</p>
              <Link href="/drafts" className="mt-3 inline-block text-sm text-blue-600 hover:underline">
                Go to Draft Queue →
              </Link>
            </div>
          ) : (
            <ul className="space-y-2">
              {upcoming.map(post => (
                <li key={post.id} className="flex items-center gap-3 py-2 border-b last:border-0">
                  <div className="text-sm text-gray-500 w-28 shrink-0">
                    {post.scheduled_for
                      ? new Date(post.scheduled_for).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                      : 'Unscheduled'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{post.title}</div>
                    <div className="text-xs text-gray-400">{POST_TYPE_LABELS[post.post_type]}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Weekly schedule reference */}
      <div className="mt-8 bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-liberty-blue mb-4">Weekly Publishing Schedule</h2>
        <div className="grid grid-cols-7 gap-2 text-center text-sm">
          {[
            { day: 'Mon', type: '🧠 Trivia' },
            { day: 'Tue', type: '✅ Answer Reveal' },
            { day: 'Wed', type: '📅 This Week' },
            { day: 'Thu', type: '🧠 Trivia' },
            { day: 'Fri', type: '📚 Product' },
            { day: 'Sat', type: '💛 Memory' },
            { day: 'Sun', type: '💡 Invention' },
          ].map(({ day, type }) => (
            <div key={day} className="bg-liberty-cream rounded p-3">
              <div className="font-bold text-liberty-blue">{day}</div>
              <div className="text-xs text-gray-600 mt-1">{type}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
