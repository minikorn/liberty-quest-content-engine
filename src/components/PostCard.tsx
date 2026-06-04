'use client'

import { useState } from 'react'
import Image from 'next/image'
import { format } from 'date-fns'
import clsx from 'clsx'
import type { ContentPost, PostStatus } from '@/types'
import { POST_TYPE_LABELS, POST_TYPE_COLORS, STATUS_COLORS } from '@/types'

interface PostCardProps {
  post: ContentPost
  onStatusChange?: (id: number, status: PostStatus) => void
  onPublish?: (id: number) => void
  showActions?: boolean
}

export function PostCard({
  post,
  onStatusChange,
  onPublish,
  showActions = true,
}: PostCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(
    post.image_url ?? post.generated_image_url ?? null
  )
  const [imageError, setImageError] = useState<string | null>(null)
  const [scheduledFor, setScheduledFor] = useState(
    post.scheduled_for
      ? format(new Date(post.scheduled_for), "yyyy-MM-dd'T'HH:mm")
      : ''
  )

  async function handleStatusChange(newStatus: PostStatus) {
    setLoading(newStatus)
    try {
      const res = await fetch(`/api/posts/${post.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) onStatusChange?.(post.id, newStatus)
    } finally {
      setLoading(null)
    }
  }

  async function handleSchedule() {
    if (!scheduledFor) return
    setLoading('schedule')
    try {
      const res = await fetch(`/api/posts/${post.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'scheduled',
          scheduled_for: new Date(scheduledFor).toISOString(),
        }),
      })
      if (res.ok) onStatusChange?.(post.id, 'scheduled')
    } finally {
      setLoading(null)
    }
  }

  async function handlePublishNow() {
    setLoading('publish')
    try {
      const res = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: post.id }),
      })
      if (res.ok) {
        onPublish?.(post.id)
        onStatusChange?.(post.id, 'published')
      } else {
        const data = await res.json()
        alert(`Failed to publish: ${data.error}`)
      }
    } finally {
      setLoading(null)
    }
  }

  async function handleGenerateImage() {
    setLoading('image')
    setImageError(null)
    try {
      const res = await fetch(`/api/posts/${post.id}/image`, { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setImageUrl(data.imageUrl)
      } else {
        setImageError(data.error ?? 'Image generation failed')
      }
    } finally {
      setLoading(null)
    }
  }

  const isTriviaPost = post.post_type === 'can_you_beat_grandpa'
  const previewText = post.body.length > 200
    ? post.body.slice(0, 200) + '…'
    : post.body

  return (
    <div className={clsx(
      'bg-white rounded-lg shadow border-l-4 p-4',
      post.post_type === 'can_you_beat_grandpa' && 'border-blue-400',
      post.post_type === 'answer_reveal' && 'border-green-400',
      post.post_type === 'this_week_in_history' && 'border-amber-400',
      post.post_type === 'american_inventions' && 'border-yellow-400',
      post.post_type === 'american_heroes' && 'border-red-400',
      post.post_type === 'liberty_quest_product' && 'border-purple-400',
      post.post_type === 'family_memory' && 'border-pink-400',
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={clsx(
              'text-xs font-semibold px-2 py-0.5 rounded-full',
              POST_TYPE_COLORS[post.post_type]
            )}>
              {POST_TYPE_LABELS[post.post_type]}
            </span>
            <span className={clsx(
              'text-xs font-semibold px-2 py-0.5 rounded-full',
              STATUS_COLORS[post.status]
            )}>
              {post.status}
            </span>
            {post.scheduled_for && (
              <span className="text-xs text-gray-500">
                📅 {format(new Date(post.scheduled_for), 'MMM d, h:mm a')}
              </span>
            )}
          </div>
          <h3 className="font-semibold text-gray-900 text-sm truncate">
            {post.title}
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Created {format(new Date(post.created_at), 'MMM d, yyyy')}
          </p>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-gray-400 hover:text-gray-600 text-sm shrink-0"
        >
          {expanded ? '▲ Less' : '▼ More'}
        </button>
      </div>

      {/* Post body preview */}
      <div className="text-sm text-gray-700 bg-gray-50 rounded p-3 mb-3 whitespace-pre-wrap">
        {expanded ? post.body : previewText}
      </div>

      {/* Image section */}
      <div className="mb-3">
        {imageUrl ? (
          <div className="relative">
            <div className="relative w-full h-48 rounded overflow-hidden bg-gray-100">
              <Image
                src={imageUrl}
                alt={post.title}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 600px"
                unoptimized
              />
            </div>
            {showActions && (
              <button
                onClick={handleGenerateImage}
                disabled={loading === 'image'}
                className="mt-1 text-xs text-gray-400 hover:text-blue-600"
              >
                {loading === 'image' ? '⏳ Regenerating…' : '↻ Regenerate image'}
              </button>
            )}
          </div>
        ) : showActions && post.image_prompt ? (
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded border border-dashed border-gray-200">
            <span className="text-gray-400 text-sm flex-1">No image yet</span>
            <button
              onClick={handleGenerateImage}
              disabled={loading === 'image'}
              className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs rounded font-medium disabled:opacity-50 whitespace-nowrap"
            >
              {loading === 'image' ? '⏳ Generating…' : '🎨 Generate Image'}
            </button>
          </div>
        ) : null}
        {imageError && (
          <p className="text-xs text-red-600 mt-1">⚠ {imageError}</p>
        )}
      </div>

      {/* Trivia details (when expanded) */}
      {expanded && isTriviaPost && post.trivia_question && (
        <div className="bg-blue-50 rounded p-3 mb-3 text-sm">
          <p className="font-semibold text-blue-800 mb-2">Trivia Details</p>
          <p className="mb-1"><strong>Q:</strong> {post.trivia_question}</p>
          <p>A: {post.trivia_option_a} {post.trivia_correct_answer === 'A' && '✅'}</p>
          <p>B: {post.trivia_option_b} {post.trivia_correct_answer === 'B' && '✅'}</p>
          <p>C: {post.trivia_option_c} {post.trivia_correct_answer === 'C' && '✅'}</p>
          <p>D: {post.trivia_option_d} {post.trivia_correct_answer === 'D' && '✅'}</p>
          {post.trivia_explanation && (
            <p className="mt-2 text-blue-700 italic">{post.trivia_explanation}</p>
          )}
        </div>
      )}

      {/* Image prompt (when expanded) */}
      {expanded && post.image_prompt && (
        <div className="bg-amber-50 rounded p-3 mb-3 text-sm">
          <p className="font-semibold text-amber-800 mb-1">Image Prompt</p>
          <p className="text-amber-700 italic">{post.image_prompt}</p>
        </div>
      )}

      {/* Engagement stats */}
      {post.status === 'published' && (
        <div className="flex gap-4 text-xs text-gray-500 mb-3">
          <span>❤️ {post.engagement_likes}</span>
          <span>💬 {post.engagement_comments}</span>
          <span>🔁 {post.engagement_shares}</span>
          {post.facebook_post_id && (
            <a
              href={`https://www.facebook.com/${post.facebook_post_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              View on Facebook →
            </a>
          )}
        </div>
      )}

      {/* Actions */}
      {showActions && post.status === 'draft' && (
        <div className="flex flex-wrap gap-2 mt-2">
          <button
            onClick={() => handleStatusChange('approved')}
            disabled={loading !== null}
            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded font-medium disabled:opacity-50"
          >
            {loading === 'approved' ? '...' : '✓ Approve'}
          </button>
          <button
            onClick={() => handleStatusChange('rejected')}
            disabled={loading !== null}
            className="px-3 py-1.5 bg-gray-400 hover:bg-gray-500 text-white text-sm rounded font-medium disabled:opacity-50"
          >
            {loading === 'rejected' ? '...' : '✗ Reject'}
          </button>
        </div>
      )}

      {showActions && post.status === 'approved' && (
        <div className="flex flex-wrap gap-2 mt-2 items-center">
          <input
            type="datetime-local"
            value={scheduledFor}
            onChange={e => setScheduledFor(e.target.value)}
            className="text-sm border rounded px-2 py-1.5 text-gray-700"
          />
          <button
            onClick={handleSchedule}
            disabled={!scheduledFor || loading !== null}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-sm rounded font-medium disabled:opacity-50"
          >
            {loading === 'schedule' ? '...' : '📅 Schedule'}
          </button>
          <button
            onClick={handlePublishNow}
            disabled={loading !== null}
            className="px-3 py-1.5 bg-liberty-blue hover:bg-blue-900 text-white text-sm rounded font-medium disabled:opacity-50"
          >
            {loading === 'publish' ? 'Publishing...' : '🚀 Publish Now'}
          </button>
        </div>
      )}

      {showActions && post.status === 'scheduled' && (
        <div className="flex flex-wrap gap-2 mt-2">
          <button
            onClick={handlePublishNow}
            disabled={loading !== null}
            className="px-3 py-1.5 bg-liberty-blue hover:bg-blue-900 text-white text-sm rounded font-medium disabled:opacity-50"
          >
            {loading === 'publish' ? 'Publishing...' : '🚀 Publish Now'}
          </button>
          <button
            onClick={() => handleStatusChange('approved')}
            disabled={loading !== null}
            className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm rounded font-medium disabled:opacity-50"
          >
            Unschedule
          </button>
        </div>
      )}
    </div>
  )
}
