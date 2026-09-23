-- Create job_tracker table for storing scan results and job applications
-- Run this SQL in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS job_tracker (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization TEXT NOT NULL,
  designation TEXT NOT NULL,
  interview_status TEXT NOT NULL DEFAULT 'Applied' CHECK (interview_status IN ('Applied', 'Interviewing', 'Offer', 'Rejected')),
  initial_score INTEGER,
  matched_keywords TEXT[] DEFAULT '{}',
  missing_keywords TEXT[] DEFAULT '{}',
  keyword_universe TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_job_tracker_user_id ON job_tracker(user_id);
CREATE INDEX IF NOT EXISTS idx_job_tracker_created_at ON job_tracker(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE job_tracker ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to read their own jobs
CREATE POLICY "Users can view their own jobs"
  ON job_tracker
  FOR SELECT
  USING (auth.uid() = user_id);

-- Create policy to allow users to insert their own jobs
CREATE POLICY "Users can insert their own jobs"
  ON job_tracker
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create policy to allow users to update their own jobs
CREATE POLICY "Users can update their own jobs"
  ON job_tracker
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create policy to allow users to delete their own jobs
CREATE POLICY "Users can delete their own jobs"
  ON job_tracker
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_job_tracker_updated_at
  BEFORE UPDATE ON job_tracker
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Profiles table additions for extended profile data
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS headline TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS behance TEXT,
  ADD COLUMN IF NOT EXISTS github TEXT,
  ADD COLUMN IF NOT EXISTS linkedin TEXT,
  ADD COLUMN IF NOT EXISTS portfolio TEXT,
  ADD COLUMN IF NOT EXISTS other_link TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS experience_years INT,
  ADD COLUMN IF NOT EXISTS photo_url TEXT,
  ADD COLUMN IF NOT EXISTS resume_language TEXT,
  ADD COLUMN IF NOT EXISTS date_format TEXT,
  ADD COLUMN IF NOT EXISTS plan TEXT,
  -- Full structured base resume (editable draft) + a plain-text serialization
  -- consumed by the scan/analyze/tailor pipeline.
  ADD COLUMN IF NOT EXISTS base_resume JSONB,
  ADD COLUMN IF NOT EXISTS base_resume_text TEXT,
  ADD COLUMN IF NOT EXISTS base_resume_updated_at TIMESTAMPTZ;

-- Job tracker additions for storing generated resume/cover-letter outputs
ALTER TABLE job_tracker
  ADD COLUMN IF NOT EXISTS resume_template_id TEXT,
  ADD COLUMN IF NOT EXISTS cover_letter_template_id TEXT,
  ADD COLUMN IF NOT EXISTS generated_resume_text TEXT,
  ADD COLUMN IF NOT EXISTS generated_cover_letter_text TEXT,
  ADD COLUMN IF NOT EXISTS generated_resume_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS generated_cover_letter_updated_at TIMESTAMPTZ,
  -- Exact optimized-resume render payload, written ONLY when the user downloads
  -- the optimized resume. Lets the Job Tracker reproduce the identical file.
  ADD COLUMN IF NOT EXISTS generated_resume_payload JSONB,
  -- Score of the tailored resume. NULL until the scan's resume is optimized;
  -- `initial_score` keeps the original scan score so the pair can be compared.
  ADD COLUMN IF NOT EXISTS optimized_score INTEGER;

-- Subscriptions table for Razorpay plan access control
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_key TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'created',
  razorpay_subscription_id TEXT UNIQUE NOT NULL,
  razorpay_payment_id TEXT,
  current_period_end TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_created_at ON subscriptions(created_at DESC);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own subscriptions"
  ON subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own subscriptions"
  ON subscriptions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscriptions"
  ON subscriptions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own subscriptions"
  ON subscriptions
  FOR DELETE
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Weekly scan usage tracking
CREATE TABLE IF NOT EXISTS scan_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_key TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scan_usage_user_id ON scan_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_scan_usage_created_at ON scan_usage(created_at DESC);

ALTER TABLE scan_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own scan usage"
  ON scan_usage
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own scan usage"
  ON scan_usage
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own scan usage"
  ON scan_usage
  FOR DELETE
  USING (auth.uid() = user_id);

-- Multiple named base resumes (up to 5 per user, enforced in the app).
-- `resume` holds { draft, template, overrides }; `resume_text` is the plain-text
-- serialization the scan/analyze/tailor pipeline consumes.
CREATE TABLE IF NOT EXISTS base_resumes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Base CV',
  resume JSONB,
  resume_text TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_base_resumes_user_id ON base_resumes(user_id);
CREATE INDEX IF NOT EXISTS idx_base_resumes_created_at ON base_resumes(created_at);

ALTER TABLE base_resumes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own base resumes"
  ON base_resumes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own base resumes"
  ON base_resumes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own base resumes"
  ON base_resumes FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own base resumes"
  ON base_resumes FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_base_resumes_updated_at
  BEFORE UPDATE ON base_resumes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Whether the resume was built on a phone or on a desktop. Written once at
-- creation and never updated; NULL for rows that predate this column.
ALTER TABLE base_resumes
  ADD COLUMN IF NOT EXISTS created_device TEXT
    CHECK (created_device IN ('mobile', 'desktop'));

-- One-time migration: move each user's existing single base resume into a
-- "Default Base CV" row. Safe to re-run (skips users who already have rows).
INSERT INTO base_resumes (user_id, name, resume, resume_text, is_default)
SELECT p.id, 'Default Base CV', p.base_resume, p.base_resume_text, true
FROM profiles p
WHERE p.base_resume IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM base_resumes br WHERE br.user_id = p.id);

-- Help Center support tickets. Only queries and complaints are stored —
-- feedback is emailed to the support inbox and never persisted.
CREATE SEQUENCE IF NOT EXISTS support_ticket_number_seq START 1;

CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  -- Human-facing reference (SYN-000001). Generated by the sequence default so
  -- concurrent inserts can never collide on a read-then-increment.
  ticket_number TEXT NOT NULL UNIQUE
    DEFAULT ('SYN-' || LPAD(nextval('support_ticket_number_seq')::TEXT, 6, '0')),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Reply-to address from the form; may differ from the account email.
  contact_email TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('query', 'complaint')),
  message TEXT NOT NULL,
  -- Storage paths inside the `ticket-attachments` bucket, never URLs — signed
  -- URLs are minted per request so they can expire.
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'resolved', 'closed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_type ON support_tickets(type);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created_at ON support_tickets(created_at DESC);

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

-- Dropped first so the whole block stays re-runnable; CREATE POLICY has no
-- IF NOT EXISTS form.
DROP POLICY IF EXISTS "Users can view their own tickets" ON support_tickets;
CREATE POLICY "Users can view their own tickets"
  ON support_tickets FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own tickets" ON support_tickets;
CREATE POLICY "Users can insert their own tickets"
  ON support_tickets FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own tickets" ON support_tickets;
CREATE POLICY "Users can update their own tickets"
  ON support_tickets FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_support_tickets_updated_at ON support_tickets;
CREATE TRIGGER update_support_tickets_updated_at
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Notes left by support staff. Visible to the user who raised the ticket —
-- "internal" here means staff-authored, not hidden from the reporter.
CREATE TABLE IF NOT EXISTS support_ticket_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_ticket_notes_ticket_id
  ON support_ticket_notes(ticket_id);
CREATE INDEX IF NOT EXISTS idx_support_ticket_notes_created_at
  ON support_ticket_notes(created_at);

ALTER TABLE support_ticket_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view notes on their own tickets" ON support_ticket_notes;
CREATE POLICY "Users can view notes on their own tickets"
  ON support_ticket_notes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM support_tickets t
      WHERE t.id = support_ticket_notes.ticket_id AND t.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Remote Jobs: where a scan was started from
-- ---------------------------------------------------------------------------
-- Records whether an analysis began in the Remote Jobs list or from a manually
-- pasted job description. scan_usage is the right home for this because it gets
-- a row for EVERY scan (paid plans and free trial alike), whereas job_tracker
-- is only written for plans that include the tracker.
--
-- Existing rows backfill to 'manual', which is accurate: they all predate the
-- Remote Jobs feature.
--
-- Deliberately NO CHECK constraint. app/api/analyze only logs a failed
-- scan_usage insert and carries on, so a row rejected by a constraint would
-- silently skip quota counting and effectively grant free scans. The value is
-- restricted to a known set in lib/scan-sources.ts instead.
ALTER TABLE scan_usage
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';

CREATE INDEX IF NOT EXISTS idx_scan_usage_source ON scan_usage(source);

-- ---------------------------------------------------------------------------
-- Model cost controls
-- ---------------------------------------------------------------------------
-- Billing tables are written by the server only. scan_usage and subscriptions
-- were created with INSERT/UPDATE/DELETE policies for their owner, which let a
-- signed-in user write them straight from the browser with the public anon
-- key: delete their scan_usage rows to reset the weekly allowance, or insert
-- an 'active' subscription and get a paid plan for nothing. Every real write
-- goes through an API route using the service role, which RLS does not apply
-- to, so dropping these changes nothing for the app. Users keep read access to
-- their own rows.
DROP POLICY IF EXISTS "Users can insert their own scan usage" ON scan_usage;
DROP POLICY IF EXISTS "Users can delete their own scan usage" ON scan_usage;
DROP POLICY IF EXISTS "Users can insert their own subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Users can update their own subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Users can delete their own subscriptions" ON subscriptions;

-- Which job description a scan was for (a SHA-256 of its cleaned text,
-- organization and designation). A re-score after optimizing or editing is
-- only free for a job description the user already has a scan row for.
-- Nullable: rows from before this column simply never match.
ALTER TABLE scan_usage
  ADD COLUMN IF NOT EXISTS jd_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_scan_usage_user_jd_hash ON scan_usage(user_id, jd_hash);

-- Keywords extracted from a job description, shared by every scan of the same
-- posting, so each posting is paid for once rather than once per user.
-- cache_key is "<extraction version>:<model>:<jd hash>", so changing the
-- prompt or the model starts a fresh set of entries instead of serving stale
-- ones. Server-only: RLS on and no policies.
CREATE TABLE IF NOT EXISTS jd_keyword_cache (
  cache_key TEXT PRIMARY KEY,
  weighted_keywords JSONB NOT NULL,
  extraction_stats JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE jd_keyword_cache ENABLE ROW LEVEL SECURITY;

-- Token usage, one row per OpenAI call, written by lib/server/openai.js. The
-- source of truth for what each user and feature costs, and what the hourly
-- ceilings on unmetered routes are counted from. user_id is kept anonymous
-- rather than deleted with the account, so past spend still adds up.
-- Server-only: RLS on and no policies.
CREATE TABLE IF NOT EXISTS llm_usage (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  purpose TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  cached_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_llm_usage_user_purpose_created
  ON llm_usage(user_id, purpose, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_llm_usage_created_at ON llm_usage(created_at DESC);

ALTER TABLE llm_usage ENABLE ROW LEVEL SECURITY;

-- Spend per user and feature over the last 30 days. Prices are USD per million
-- tokens (input, cached input, output); check them against OpenAI's pricing
-- page before trusting the totals. `model` holds the name OpenAI reports,
-- sometimes a dated snapshot like gpt-4o-mini-2024-07-18, hence the prefix
-- match — the gpt-4o-mini line must come before gpt-4o.
--
-- SELECT user_id, purpose, COUNT(*) AS calls,
--   ROUND(SUM(CASE
--     WHEN model LIKE 'gpt-6-luna%' THEN
--       (prompt_tokens - cached_tokens) * 0.10 + cached_tokens * 0.01 + completion_tokens * 0.50
--     WHEN model LIKE 'gpt-4o-mini%' THEN
--       (prompt_tokens - cached_tokens) * 0.15 + cached_tokens * 0.075 + completion_tokens * 0.60
--     WHEN model LIKE 'gpt-4o%' THEN
--       (prompt_tokens - cached_tokens) * 2.50 + cached_tokens * 1.25 + completion_tokens * 10.00
--   END) / 1000000.0, 4) AS usd
-- FROM llm_usage
-- WHERE created_at > NOW() - INTERVAL '30 days'
-- GROUP BY user_id, purpose
-- ORDER BY usd DESC NULLS LAST;

-- ---------------------------------------------------------------------------
-- Payments: Razorpay → Dodo Payments
-- ---------------------------------------------------------------------------
-- New subscriptions are billed through Dodo Payments. A row is written by
-- app/api/dodo/webhook once Dodo reports the subscription (after its checkout
-- is paid): one row per Dodo subscription, with plan_id holding the Dodo
-- product id. Razorpay rows are left as they are, so subscribers from before
-- the move keep their plan; only those rows have a Razorpay id now.
ALTER TABLE subscriptions
  ALTER COLUMN razorpay_subscription_id DROP NOT NULL;

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS dodo_subscription_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS dodo_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS dodo_payment_id TEXT;
