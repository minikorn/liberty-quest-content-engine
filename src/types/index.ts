export type PostType =
  | 'can_you_beat_grandpa'
  | 'answer_reveal'
  | 'this_week_in_history'
  | 'american_inventions'
  | 'american_heroes'
  | 'liberty_quest_product'
  | 'family_memory'
  | 'did_you_know'
  | 'poll_question'
  | 'quote_of_the_day'

export type PostStatus =
  | 'draft'
  | 'approved'
  | 'scheduled'
  | 'published'
  | 'failed'
  | 'rejected'

export interface ContentPost {
  id: number
  created_at: string
  updated_at: string
  scheduled_for: string | null
  published_at: string | null

  post_type: PostType
  status: PostStatus

  title: string
  body: string
  image_prompt: string | null
  generated_image_url: string | null
  image_url: string | null
  link_url: string | null

  trivia_question: string | null
  trivia_option_a: string | null
  trivia_option_b: string | null
  trivia_option_c: string | null
  trivia_option_d: string | null
  trivia_correct_answer: 'A' | 'B' | 'C' | 'D' | null
  trivia_explanation: string | null

  linked_post_id: number | null
  facebook_post_id: string | null

  engagement_likes: number
  engagement_comments: number
  engagement_shares: number

  generation_model: string | null
}

export interface GeneratedContent {
  title: string
  body: string
  image_prompt: string
  trivia_question?: string
  trivia_option_a?: string
  trivia_option_b?: string
  trivia_option_c?: string
  trivia_option_d?: string
  trivia_correct_answer?: 'A' | 'B' | 'C' | 'D'
  trivia_explanation?: string
}

export const POST_TYPE_LABELS: Record<PostType, string> = {
  can_you_beat_grandpa: '🧠 Can You Beat Grandpa?',
  answer_reveal: '✅ Answer Reveal',
  this_week_in_history: '📅 This Week in History',
  american_inventions: '💡 American Inventions',
  american_heroes: '🦅 American Heroes',
  liberty_quest_product: '📚 Liberty Quest Product',
  family_memory: '💛 Family Memory',
  did_you_know: '🔍 Did You Know?',
  poll_question: '🗳️ Poll',
  quote_of_the_day: '💬 Quote of the Day',
}

export const POST_TYPE_COLORS: Record<PostType, string> = {
  can_you_beat_grandpa: 'bg-blue-100 text-blue-800',
  answer_reveal: 'bg-green-100 text-green-800',
  this_week_in_history: 'bg-amber-100 text-amber-800',
  american_inventions: 'bg-yellow-100 text-yellow-800',
  american_heroes: 'bg-red-100 text-red-800',
  liberty_quest_product: 'bg-purple-100 text-purple-800',
  family_memory: 'bg-pink-100 text-pink-800',
  did_you_know: 'bg-teal-100 text-teal-800',
  poll_question: 'bg-orange-100 text-orange-800',
  quote_of_the_day: 'bg-indigo-100 text-indigo-800',
}

export const STATUS_COLORS: Record<PostStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  approved: 'bg-blue-100 text-blue-700',
  scheduled: 'bg-amber-100 text-amber-700',
  published: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  rejected: 'bg-gray-100 text-gray-400',
}

// Weighted content type distribution (used by weighted random selector)
// answer_reveal is excluded — generated automatically with trivia posts
export const CONTENT_WEIGHTS: { type: PostType; weight: number }[] = [
  { type: 'can_you_beat_grandpa', weight: 25 },
  { type: 'did_you_know', weight: 20 },
  { type: 'this_week_in_history', weight: 12 },
  { type: 'family_memory', weight: 10 },
  { type: 'poll_question', weight: 10 },
  { type: 'american_inventions', weight: 8 },
  { type: 'quote_of_the_day', weight: 8 },
  { type: 'liberty_quest_product', weight: 5 },
  { type: 'american_heroes', weight: 2 },
]

// Weekly calendar schedule — 3 posts/day (auto-scheduler fills actual times)
// Used only for UI reference; slot times are managed by /api/cron/schedule
export const WEEKLY_SCHEDULE: { day: number; type: PostType; label: string }[] = [
  { day: 1, type: 'can_you_beat_grandpa', label: 'Monday AM' },
  { day: 1, type: 'did_you_know', label: 'Monday PM' },
  { day: 2, type: 'answer_reveal', label: 'Tuesday AM' },
  { day: 2, type: 'poll_question', label: 'Tuesday PM' },
  { day: 3, type: 'this_week_in_history', label: 'Wednesday AM' },
  { day: 3, type: 'family_memory', label: 'Wednesday PM' },
  { day: 4, type: 'can_you_beat_grandpa', label: 'Thursday AM' },
  { day: 4, type: 'quote_of_the_day', label: 'Thursday PM' },
  { day: 5, type: 'liberty_quest_product', label: 'Friday AM' },
  { day: 5, type: 'did_you_know', label: 'Friday PM' },
  { day: 6, type: 'family_memory', label: 'Saturday AM' },
  { day: 6, type: 'american_heroes', label: 'Saturday PM' },
  { day: 0, type: 'american_inventions', label: 'Sunday AM' },
  { day: 0, type: 'poll_question', label: 'Sunday PM' },
]
