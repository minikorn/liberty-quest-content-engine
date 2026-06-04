'use client'

import { useState, useEffect, useCallback } from 'react'
import { PostCard } from '@/components/PostCard'
import type { ContentPost } from '@/types'

export default function PublishedPage() {
  const [posts, setPosts] = useState<ContentPost[]>([])
  const [loading, setLoading] = useState(true)

  const loadPosts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/posts?status=published&limit=50')
      const data = await res.json()
      setPosts(data.posts ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadPosts() }, [loadPosts])

  const totalLikes = posts.reduce((sum, p) => sum + p.engagement_likes, 0)
  const totalComments = posts.reduce((sum, p) => sum + p.engagement_comments, 0)
  const totalShares = posts.reduce((sum, p) => sum + p.engagement_shares, 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-liberty-blue">Published Posts</h1>
          <p className="text-gray-600 text-sm mt-1">
            Your published content history and engagement scores.
          </p>
        </div>
        <button onClick={loadPosts} className="text-sm text-blue-600 hover:text-blue-800">
          ↻ Refresh
        </button>
      </div>

      {/* Aggregate stats */}
      {posts.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-liberty-blue">❤️ {totalLikes}</div>
            <div className="text-sm text-gray-500">Total Reactions</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-liberty-blue">💬 {totalComments}</div>
            <div className="text-sm text-gray-500">Total Comments</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <div className="text-2xl font-bold text-liberty-blue">🔁 {totalShares}</div>
            <div className="text-sm text-gray-500">Total Shares</div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-4">⏳</div>
          <p>Loading published posts…</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-16 text-gray-400 bg-white rounded-lg shadow">
          <div className="text-4xl mb-4">📰</div>
          <p className="text-lg font-medium">No published posts yet</p>
          <p className="text-sm mt-2">Generate content, approve it, and publish your first post.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">{posts.length} published posts</p>
          {posts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              showActions={false}
            />
          ))}
        </div>
      )}
    </div>
  )
}
