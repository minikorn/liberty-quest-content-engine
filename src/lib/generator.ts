import OpenAI from 'openai'
import { EDITORIAL_CONSTITUTION } from './constitution'
import { createPost, updatePost } from './db'
import { generateAndStoreImage, imageGenerationAvailable } from './images'
import type { PostType, GeneratedContent, ContentPost } from '@/types'

// ---------------------------------------------------------------------------
// OpenAI client
// ---------------------------------------------------------------------------

function getOpenAI(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is not set')
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

const MODEL = 'gpt-4o'

// ---------------------------------------------------------------------------
// Weighted type selector
// ---------------------------------------------------------------------------

const WEIGHTS: { type: PostType; weight: number }[] = [
  { type: 'can_you_beat_grandpa', weight: 40 },
  { type: 'this_week_in_history', weight: 20 },
  { type: 'family_memory', weight: 15 },
  { type: 'american_inventions', weight: 10 },
  { type: 'american_heroes', weight: 5 },
  { type: 'liberty_quest_product', weight: 10 },
]

export function selectWeightedType(): PostType {
  const total = WEIGHTS.reduce((sum, w) => sum + w.weight, 0)
  let rand = Math.random() * total
  for (const { type, weight } of WEIGHTS) {
    rand -= weight
    if (rand <= 0) return type
  }
  return 'this_week_in_history'
}

// ---------------------------------------------------------------------------
// Per-type user prompts
// ---------------------------------------------------------------------------

function getUserPrompt(type: PostType): string {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  switch (type) {
    case 'can_you_beat_grandpa':
      return `Today is ${today}.

Generate a "Can You Beat Grandpa?" American history trivia post for Facebook.

Rules:
- The question must be factually accurate and verifiable
- 4 multiple-choice options labeled A, B, C, D
- Only ONE correct answer
- Not a trick question — it's fair and answerable by a curious reader
- The body should open with "🧠 Can You Beat Grandpa?" and include the full question and all 4 options
- End with "Drop your answer in the comments! Answer revealed tomorrow. 👇"
- Playful, competitive tone — Grandpa is wise but beatable
- Image prompt should suggest a vintage Americana illustration style

Return this exact JSON structure:
{
  "title": "short headline for internal use",
  "body": "the complete Facebook post copy",
  "trivia_question": "the question text only",
  "trivia_option_a": "option A text only",
  "trivia_option_b": "option B text only",
  "trivia_option_c": "option C text only",
  "trivia_option_d": "option D text only",
  "trivia_correct_answer": "A" or "B" or "C" or "D",
  "trivia_explanation": "2-3 sentence explanation of the answer",
  "image_prompt": "detailed image generation prompt in vintage Americana style"
}`

    case 'this_week_in_history':
      return `Today is ${today}.

Generate a "This Week in American History" Facebook post about a real historical event
or anniversary that occurred during this week or this month in history.

Rules:
- The event must be real and historically accurate
- Storytelling first — lead with the human drama, not just the date
- 150-200 words in the post body
- Connect it to something the reader already knows
- End with a reflection question or "Did you know?" kicker
- Image prompt: suggest a period-accurate historical illustration or vintage photo style

Return this exact JSON structure:
{
  "title": "short headline for internal use",
  "body": "the complete Facebook post copy (150-200 words)",
  "image_prompt": "detailed image generation prompt"
}`

    case 'american_inventions':
      return `Today is ${today}.

Generate an "American Inventions" Facebook post celebrating a notable American invention
or inventor.

Rules:
- Feature the inventor as a person, not just the invention
- Include something surprising — who they were, what problem they were solving
- Wonder and surprise tone
- 150-200 words
- Include a fun shareable fact
- Subjects can include: household inventions, industrial inventions, food inventions,
  medical breakthroughs, communication tech, transportation — anything genuinely American
- Image prompt: vintage illustration or patent drawing style

Return this exact JSON structure:
{
  "title": "short headline for internal use",
  "body": "the complete Facebook post copy (150-200 words)",
  "image_prompt": "detailed image generation prompt"
}`

    case 'american_heroes':
      return `Today is ${today}.

Generate an "American Heroes" Facebook post about a historical American figure.

Rules:
- Do NOT default to Mount Rushmore figures or overexposed presidents
- Include diverse subjects: women, scientists, teachers, soldiers, farmers, athletes,
  civil rights leaders, inventors, explorers, First Nations leaders, immigrants who shaped America
- Focus on ONE specific act or achievement — not a full biography
- Humble and human tone — not hagiographic
- 150-200 words
- The reader should finish feeling like they just met someone worth knowing
- Image prompt: dignified portrait or historical scene style

Return this exact JSON structure:
{
  "title": "short headline for internal use",
  "body": "the complete Facebook post copy (150-200 words)",
  "image_prompt": "detailed image generation prompt"
}`

    case 'liberty_quest_product':
      return `Today is ${today}.

Generate a Liberty Quest product spotlight post for Facebook.

Liberty Quest publishes American history puzzle books — crosswords, trivia, word searches,
and brain games built around American history themes. Designed for history buffs,
families, grandparents, and anyone who loves puzzles AND American history.

Rules:
- Confident and inviting, never pushy or salesy
- "Here's something we made that you might love" energy
- Feature the content of the books (sample questions, historical themes, gift potential)
- 100-150 words
- Include a call to action (visit the link in bio / check it out)
- Image prompt: warm book-and-puzzle imagery, Reader's Digest aesthetic

Return this exact JSON structure:
{
  "title": "short headline for internal use",
  "body": "the complete Facebook post copy (100-150 words)",
  "image_prompt": "detailed image generation prompt"
}`

    case 'family_memory':
      return `Today is ${today}.

Generate a "Family Memory" nostalgia post for Facebook — a warm, specific question
that invites readers to share their own memories and stories.

Rules:
- The question must be SPECIFIC enough to spark a real memory
  (not "what did you do as a kid?" but "What did your grandmother keep in a tin on the kitchen counter?")
- Warmly nostalgic, not saccharine
- 80-120 words
- End with the question as its own line
- American context (1940s-1980s nostalgia is the sweet spot)
- Should generate lots of comments and shares
- Image prompt: warm nostalgic family scene or vintage household item

Return this exact JSON structure:
{
  "title": "short headline for internal use",
  "body": "the complete Facebook post copy (80-120 words ending with the question)",
  "image_prompt": "detailed image generation prompt"
}`

    default:
      return 'Generate an engaging American history Facebook post. Return JSON with title, body, and image_prompt fields.'
  }
}

// ---------------------------------------------------------------------------
// Core generation function
// ---------------------------------------------------------------------------

async function generateContent(type: PostType): Promise<GeneratedContent> {
  const openai = getOpenAI()
  const userPrompt = getUserPrompt(type)

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: EDITORIAL_CONSTITUTION },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.85,
    max_tokens: 1000,
    response_format: { type: 'json_object' },
  })

  const raw = response.choices[0]?.message?.content
  if (!raw) throw new Error('OpenAI returned empty content')

  const parsed = JSON.parse(raw) as GeneratedContent
  if (!parsed.title || !parsed.body) {
    throw new Error('Generated content missing required fields')
  }
  return parsed
}

// ---------------------------------------------------------------------------
// Generate and save a single post
// ---------------------------------------------------------------------------

export async function generateAndSavePost(
  type: PostType
): Promise<ContentPost> {
  const content = await generateContent(type)

  const post = await createPost({
    post_type: type,
    title: content.title,
    body: content.body,
    image_prompt: content.image_prompt,
    trivia_question: content.trivia_question,
    trivia_option_a: content.trivia_option_a,
    trivia_option_b: content.trivia_option_b,
    trivia_option_c: content.trivia_option_c,
    trivia_option_d: content.trivia_option_d,
    trivia_correct_answer: content.trivia_correct_answer,
    trivia_explanation: content.trivia_explanation,
    generation_model: MODEL,
  })

  // Auto-generate image if the pipeline is configured
  if (content.image_prompt && imageGenerationAvailable()) {
    try {
      const imageUrl = await generateAndStoreImage(type, content.image_prompt)
      await updatePost(post.id, { generated_image_url: imageUrl } as Parameters<typeof updatePost>[1])
    } catch (imgErr) {
      // Image generation is non-fatal — post is still usable without one
      console.warn(`Image generation failed for post ${post.id}:`, imgErr)
    }
  }

  // If this is a trivia post, auto-generate the answer reveal post
  if (type === 'can_you_beat_grandpa' && content.trivia_explanation) {
    const revealBody = generateRevealBody(content)
    const revealPost = await createPost({
      post_type: 'answer_reveal',
      title: `Answer Reveal: ${content.title}`,
      body: revealBody,
      image_prompt: `Vintage Americana celebration image. American flag bunting, warm colors, celebratory tone. Reader's Digest style illustration.`,
      linked_post_id: post.id,
      generation_model: MODEL,
    })
    // Link the trivia post back to its reveal
    await updatePost(post.id, { linked_post_id: revealPost.id })
  }

  return post
}

function generateRevealBody(content: GeneratedContent): string {
  const answer = content.trivia_correct_answer
  const optionMap: Record<string, string | undefined> = {
    A: content.trivia_option_a,
    B: content.trivia_option_b,
    C: content.trivia_option_c,
    D: content.trivia_option_d,
  }
  const correctText = answer ? optionMap[answer] : null

  return `✅ ANSWER TIME!

Yesterday we asked: "${content.trivia_question}"

The correct answer is: **${answer}. ${correctText ?? ''}**

${content.trivia_explanation ?? ''}

Great job if you got it right! 🎉 Give Grandpa a run for his money?

👇 Tag someone who would have known this one! And don't miss our next trivia challenge — follow Liberty Quest so you never miss a post!`
}

// ---------------------------------------------------------------------------
// Batch generation
// ---------------------------------------------------------------------------

export async function generateBatch(count: number = 30): Promise<{
  generated: number
  errors: number
  posts: ContentPost[]
}> {
  const posts: ContentPost[] = []
  let errors = 0

  // Ensure at least some product posts in every batch
  const types: PostType[] = []
  for (let i = 0; i < count; i++) {
    types.push(selectWeightedType())
  }

  // Process sequentially to avoid rate limits
  for (const type of types) {
    // Skip answer_reveal — those are auto-generated with trivia posts
    if (type === 'answer_reveal') continue

    try {
      const post = await generateAndSavePost(type)
      posts.push(post)
      // Small delay to respect rate limits
      await new Promise(r => setTimeout(r, 800))
    } catch (err) {
      console.error(`Failed to generate ${type}:`, err)
      errors++
    }
  }

  return { generated: posts.length, errors, posts }
}
