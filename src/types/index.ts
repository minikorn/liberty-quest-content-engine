export type PostType =
  | 'can_you_beat_grandpa'
  | 'answer_reveal'
  | 'this_week_in_history'
  | 'american_inventions'
  | 'american_heroes'
  | 'liberty_quest_product'
  | 'family_memory'

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
}

export const POST_TYPE_COLORS: Record<PostType, string> = {
  can_you_beat_grandpa: 'bg-blue-100 text-blue-800',
  answer_reveal: 'bg-green-100 text-green-800',
  this_week_in_history: 'bg-amber-100 text-amber-800',
  american_inventions: 'bg-yellow-100 text-yellow-800',
  american_heroes: 'bg-red-100 text-red-800',
  liberty_quest_product: 'bg-purple-100 text-purple-800',
  family_memory: 'bg-pink-100 text-pink-800',
}

export const STATUS_COLORS: Record<PostStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  approved: 'bg-blue-100 text-blue-700',
  scheduled: 'bg-amber-100 text-amber-700',
  published: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  rejected: 'bg-gray-100 text-gray-400',
}

// Weighted content type distribution
export const CONTENT_WEIGHTS: { type: PostType; weight: number }[] = [
  { type: 'can_you_beat_grandpa', weight: 40 },
  { type: 'this_week_in_history', weight: 20 },
  { type: 'family_memory', weight: 15 },
  { type: 'american_inventions', weight: 10 },
  { type: 'american_heroes', weight: 5 },
  { type: 'liberty_quest_product', weight: 10 },
]

// Weekly calendar schedule
export const WEEKLY_SCHEDULE: { day: number; type: PostType; label: string }[] = [
  { day: 1, type: 'can_you_beat_grandpa', label: 'Monday' },   // Monday
  { day: 2, type: 'answer_reveal', label: 'Tuesday' },          // Tuesday
  { day: 3, type: 'this_week_in_history', label: 'Wednesday' }, // Wednesday
  { day: 4, type: 'can_you_beat_grandpa', label: 'Thursday' },  // Thursday
  { day: 5, type: 'liberty_quest_product', label: 'Friday' },   // Friday
  { day: 6, type: 'family_memory', label: 'Saturday' },         // Saturday
  { day: 0, type: 'american_inventions', label: 'Sunday' },     // Sunday
]
