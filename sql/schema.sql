-- Liberty Quest Content Engine — PostgreSQL Schema
-- Run this once against your Railway PostgreSQL database
-- railway run psql $DATABASE_URL < sql/schema.sql

-- Post type enum
CREATE TYPE post_type AS ENUM (
  'can_you_beat_grandpa',
  'answer_reveal',
  'this_week_in_history',
  'american_inventions',
  'american_heroes',
  'liberty_quest_product',
  'family_memory'
);

-- Post status enum
CREATE TYPE post_status AS ENUM (
  'draft',
  'approved',
  'scheduled',
  'published',
  'failed',
  'rejected'
);

-- Main content posts table
CREATE TABLE content_posts (
  id                    SERIAL PRIMARY KEY,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  scheduled_for         TIMESTAMPTZ,
  published_at          TIMESTAMPTZ,

  post_type             post_type NOT NULL,
  status                post_status NOT NULL DEFAULT 'draft',

  -- Content
  title                 TEXT NOT NULL,
  body                  TEXT NOT NULL,
  image_prompt          TEXT,
  generated_image_url   TEXT,
  image_url             TEXT,            -- manually uploaded image URL
  link_url              TEXT,            -- optional link to attach

  -- For trivia posts: the answer reveal
  trivia_question       TEXT,
  trivia_option_a       TEXT,
  trivia_option_b       TEXT,
  trivia_option_c       TEXT,
  trivia_option_d       TEXT,
  trivia_correct_answer CHAR(1),         -- 'A', 'B', 'C', or 'D'
  trivia_explanation    TEXT,

  -- Links a trivia post to its answer_reveal post (and vice versa)
  linked_post_id        INTEGER REFERENCES content_posts(id) ON DELETE SET NULL,

  -- Facebook
  facebook_post_id      TEXT,

  -- Engagement (synced periodically from Facebook API)
  engagement_likes      INTEGER DEFAULT 0,
  engagement_comments   INTEGER DEFAULT 0,
  engagement_shares     INTEGER DEFAULT 0,

  -- Generation metadata
  generation_model      TEXT,
  generation_prompt     TEXT
);

-- Index for dashboard queries
CREATE INDEX idx_posts_status      ON content_posts(status);
CREATE INDEX idx_posts_type        ON content_posts(post_type);
CREATE INDEX idx_posts_scheduled   ON content_posts(scheduled_for);
CREATE INDEX idx_posts_created     ON content_posts(created_at DESC);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_content_posts_updated_at
  BEFORE UPDATE ON content_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Prompt templates table (editable via dashboard)
CREATE TABLE prompt_templates (
  id          SERIAL PRIMARY KEY,
  post_type   post_type NOT NULL UNIQUE,
  system_prompt TEXT NOT NULL,
  user_prompt   TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default prompt templates (the AI engine uses these as fallbacks)
INSERT INTO prompt_templates (post_type, system_prompt, user_prompt) VALUES
(
  'can_you_beat_grandpa',
  'You are the Liberty Quest content team creating Facebook trivia posts.',
  'Generate a "Can You Beat Grandpa?" American history trivia post. Return JSON with: title, body (the Facebook post copy with the question and 4 labeled options), trivia_question, trivia_option_a, trivia_option_b, trivia_option_c, trivia_option_d, trivia_correct_answer (A/B/C/D), trivia_explanation, image_prompt.'
),
(
  'answer_reveal',
  'You are the Liberty Quest content team creating Facebook trivia answer reveal posts.',
  'Generate an answer reveal post for a trivia question. Return JSON with: title, body (celebratory reveal with explanation), image_prompt.'
),
(
  'this_week_in_history',
  'You are the Liberty Quest content team creating Facebook history posts.',
  'Generate a "This Week in American History" post about a real historical anniversary happening this week or this month. Return JSON with: title, body (storytelling style, 150-200 words), image_prompt.'
),
(
  'american_inventions',
  'You are the Liberty Quest content team creating Facebook invention posts.',
  'Generate an "American Inventions" post celebrating a notable American invention or inventor. Return JSON with: title, body (150-200 words, wonder and surprise tone), image_prompt.'
),
(
  'american_heroes',
  'You are the Liberty Quest content team creating Facebook history posts.',
  'Generate an "American Heroes" post about a historical American figure — include lesser-known figures, women, scientists, teachers, and soldiers, not just presidents. Return JSON with: title, body (150-200 words, humble not hagiographic), image_prompt.'
),
(
  'liberty_quest_product',
  'You are the Liberty Quest content team creating Facebook product posts.',
  'Generate a product spotlight post for Liberty Quest history puzzle books. Tone: confident and inviting, never pushy. Return JSON with: title, body (100-150 words), image_prompt.'
),
(
  'family_memory',
  'You are the Liberty Quest content team creating Facebook nostalgia posts.',
  'Generate a "Family Memory" nostalgia post with a specific, evocative question that invites readers to share their own stories. Return JSON with: title, body (80-120 words ending with a question), image_prompt.'
);
