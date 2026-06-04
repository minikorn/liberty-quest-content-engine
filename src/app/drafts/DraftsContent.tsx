'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { PostCard } from '@/components/PostCard'
import type { ContentPost, PostStatus } from '@/types'

export function DraftsContent() {
  const searchParams = useSearchParams()
  const defaultStatus = (searchParams.get('status') as PostStatus) ?? 'draft'

  const [posts, setPosts] = useState<ContentPost[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<PostStatus>(defaultStatus)

  const loadPosts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/posts?status=${statusFilter}&limit=50`)
      const data = await res.json()
      setPosts(data.posts ?? [])
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => { loadPosts() }, [loadPosts])

  function handleStatusChange(id: number, newStatus: PostStatus) {
    setPosts(prev => prev.filter(p => p.id !== id || newStatus === statusFilter))
    loadPosts()
  }

  const statusTabs: { value: PostStatus; label: string }[] = [
    { value: 'draft', label: '📝 Drafts' },
    { value: 'approved', label: '✅ Approved' },
    { value: 'scheduled', label: '📅 Scheduled' },
    { value: 'rejected', label: '✗ Rejected' },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-liberty-blue">Draft Queue</h1>
          <p className="text-gray-600 text-sm mt-1">
            Review AI-generated content. Approve to schedule, reject to discard.
          </p>
        </div>
        <button
          onClick={loadPosts}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          ↻ Refresh
        </button>
      </div>

      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {statusTabs.map(tab => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              statusFilter === tab.value
                ? 'border-liberty-blue text-liberty-blue'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-4">⏳</div>
          <p>Loading posts…</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-16 text-gray-400 bg-white rounded-lg shadow">
          <div className="text-4xl mb-4">📭</div>
          <p className="text-lg font-medium">No {statusFilter} posts</p>
          {statusFilter === 'draft' && (
            <p className="text-sm mt-2">Go to the Dashboard and generate some content.</p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">{posts.length} posts</p>
          {posts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              onStatusChange={handleStatusChange}
              showActions={true}
            />
          ))}
        </div>
      )}
    </div>
  )
}
