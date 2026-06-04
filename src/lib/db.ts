import { Pool } from 'pg'
import type { ContentPost, PostType, PostStatus } from '@/types'

// Singleton pool — reused across requests in the same process
let pool: Pool | null = null

function getPool(): Pool {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is not set')
    }
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false }
        : false,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    })
  }
  return pool
}

export async function query<T = unknown>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  const client = getPool()
  const result = await client.query(sql, params)
  return result.rows as T[]
}

export async function queryOne<T = unknown>(
  sql: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(sql, params)
  return rows[0] ?? null
}

// --- Post queries ---

export async function getPosts(filters: {
  status?: PostStatus
  post_type?: PostType
  limit?: number
  offset?: number
} = {}): Promise<ContentPost[]> {
  const conditions: string[] = []
  const params: unknown[] = []

  if (filters.status) {
    params.push(filters.status)
    conditions.push(`status = $${params.length}`)
  }
  if (filters.post_type) {
    params.push(filters.post_type)
    conditions.push(`post_type = $${params.length}`)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const limit = filters.limit ?? 50
  const offset = filters.offset ?? 0

  params.push(limit, offset)

  return query<ContentPost>(
    `SELECT * FROM content_posts
     ${where}
     ORDER BY created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  )
}

export async function getPost(id: number): Promise<ContentPost | null> {
  return queryOne<ContentPost>(
    'SELECT * FROM content_posts WHERE id = $1',
    [id]
  )
}

export async function createPost(data: {
  post_type: PostType
  title: string
  body: string
  image_prompt?: string
  trivia_question?: string
  trivia_option_a?: string
  trivia_option_b?: string
  trivia_option_c?: string
  trivia_option_d?: string
  trivia_correct_answer?: string
  trivia_explanation?: string
  linked_post_id?: number
  generation_model?: string
  generation_prompt?: string
}): Promise<ContentPost> {
  const post = await queryOne<ContentPost>(
    `INSERT INTO content_posts (
      post_type, title, body, image_prompt,
      trivia_question, trivia_option_a, trivia_option_b,
      trivia_option_c, trivia_option_d, trivia_correct_answer,
      trivia_explanation, linked_post_id,
      generation_model, generation_prompt
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
    RETURNING *`,
    [
      data.post_type,
      data.title,
      data.body,
      data.image_prompt ?? null,
      data.trivia_question ?? null,
      data.trivia_option_a ?? null,
      data.trivia_option_b ?? null,
      data.trivia_option_c ?? null,
      data.trivia_option_d ?? null,
      data.trivia_correct_answer ?? null,
      data.trivia_explanation ?? null,
      data.linked_post_id ?? null,
      data.generation_model ?? null,
      data.generation_prompt ?? null,
    ]
  )
  if (!post) throw new Error('Failed to create post')
  return post
}

export async function updatePost(
  id: number,
  data: Partial<{
    status: PostStatus
    scheduled_for: string | null
    published_at: string | null
    image_url: string | null
    link_url: string | null
    facebook_post_id: string | null
    body: string
    title: string
    linked_post_id: number | null
    engagement_likes: number
    engagement_comments: number
    engagement_shares: number
  }>
): Promise<ContentPost | null> {
  const keys = Object.keys(data) as (keyof typeof data)[]
  if (keys.length === 0) return getPost(id)

  const sets = keys.map((k, i) => `${k} = $${i + 2}`)
  const values = keys.map(k => data[k])

  return queryOne<ContentPost>(
    `UPDATE content_posts SET ${sets.join(', ')}
     WHERE id = $1 RETURNING *`,
    [id, ...values]
  )
}

export async function getScheduledPostsDue(): Promise<ContentPost[]> {
  return query<ContentPost>(
    `SELECT * FROM content_posts
     WHERE status = 'scheduled'
       AND scheduled_for <= NOW()
     ORDER BY scheduled_for ASC
     LIMIT 10`
  )
}

export async function getDraftCount(): Promise<number> {
  const result = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM content_posts WHERE status = 'draft'`
  )
  return parseInt(result?.count ?? '0', 10)
}

export async function getPublishedThisWeek(): Promise<number> {
  const result = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM content_posts
     WHERE status = 'published'
       AND published_at >= date_trunc('week', NOW())`
  )
  return parseInt(result?.count ?? '0', 10)
}

export async function getUpcomingScheduled(): Promise<ContentPost[]> {
  return query<ContentPost>(
    `SELECT * FROM content_posts
     WHERE status IN ('scheduled', 'approved')
     ORDER BY scheduled_for ASC NULLS LAST
     LIMIT 14`
  )
}
