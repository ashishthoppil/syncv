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
-- match — the gpt-4o-mini lines must come before gpt-4o. The mock interview's
-- voice (purpose mock_interview_voice) is logged as text tokens in and audio
-- tokens out, priced on the gpt-4o-mini-tts line. Transcribing spoken answers
-- (purpose mock_interview_transcription) is logged with audio and text input
-- together; pricing it all at the audio rate overstates it by about a third.
--
-- SELECT user_id, purpose, COUNT(*) AS calls,
--   ROUND(SUM(CASE
--     WHEN model LIKE 'gpt-6-luna%' THEN
--       (prompt_tokens - cached_tokens) * 0.10 + cached_tokens * 0.01 + completion_tokens * 0.50
--     WHEN model LIKE 'gpt-4o-mini-tts%' THEN
--       prompt_tokens * 0.60 + completion_tokens * 12.00
--     WHEN model LIKE 'gpt-4o-mini-transcribe%' THEN
--       prompt_tokens * 3.00 + completion_tokens * 5.00
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

-- ---------------------------------------------------------------------------
-- Interview prep and mock interviews
-- ---------------------------------------------------------------------------
-- Prep material is generated once per tracked job, the first time it is
-- opened, and served from here afterwards: app/api/interview/prep never calls
-- the model for a job that already has it.
ALTER TABLE job_tracker
  ADD COLUMN IF NOT EXISTS interview_prep JSONB,
  ADD COLUMN IF NOT EXISTS interview_prep_generated_at TIMESTAMPTZ;

-- One row per mock interview. `questions` carries the rubric each answer is
-- scored against, so it stays server-side until the interview is over.
-- `script` is what the interviewer says, fixed when the interview starts so the
-- voice route only ever speaks lines that belong to the caller's interview.
-- `answers` fills in one question at a time, so an interview that is cut off
-- keeps what was said. Written by the server only: owners can read their rows.
CREATE TABLE IF NOT EXISTS mock_interviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES job_tracker(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress', 'completed')),
  experience_years INTEGER,
  questions JSONB NOT NULL,
  script JSONB,
  answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  evaluation JSONB,
  overall_score INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_mock_interviews_user_job
  ON mock_interviews(user_id, job_id, created_at DESC);

ALTER TABLE mock_interviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own mock interviews" ON mock_interviews;
CREATE POLICY "Users can view their own mock interviews"
  ON mock_interviews FOR SELECT USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_mock_interviews_updated_at ON mock_interviews;
CREATE TRIGGER update_mock_interviews_updated_at
  BEFORE UPDATE ON mock_interviews
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Remote Jobs: daily ingest
-- ---------------------------------------------------------------------------
-- A Vercel cron (vercel.json) pulls remote and hybrid jobs from every source
-- once a day at 23:59 IST and stores them here. The Remote Jobs screen searches
-- these tables instead of calling the job APIs on every search. Jobs posted
-- more than 14 days ago are deleted by the same cron.
--
-- RLS is enabled with no policies, so only the service role (the API routes)
-- can read or write. Several sources' terms ask that we make reasonable efforts
-- to stop third parties pulling their listings in bulk, which rules out letting
-- the anon key select from these tables.

-- One row per hiring company, shared by all of its jobs. Startup status, size
-- and industry are looked up once per company (lib/jobs-ingest/enrich-companies)
-- rather than once per job. NULL means "not known", never "no".
CREATE TABLE IF NOT EXISTS job_companies (
  key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  website TEXT,
  is_startup BOOLEAN,
  size_band TEXT CHECK (size_band IN ('1-50', '51-200', '201-1000', '1001-5000', '5000+')),
  industry TEXT,
  enrichment_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (enrichment_status IN ('pending', 'done', 'failed')),
  enrichment_attempts INTEGER NOT NULL DEFAULT 0,
  enriched_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_companies_pending
  ON job_companies(created_at) WHERE enrichment_status = 'pending';

ALTER TABLE job_companies ENABLE ROW LEVEL SECURITY;

-- One row per posting. `id` is "<source>:<external id>" (ATS boards add the
-- company: "greenhouse:stripe~123"), the same id the Remote Jobs URL carries.
-- `board` is the ATS company slug, so a board that was read in full can have
-- its taken-down postings deleted without touching the other boards.
-- `description_html` is stored as the source sent it and sanitized when read.
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  external_id TEXT NOT NULL,
  board TEXT,
  source_url TEXT NOT NULL,
  application_url TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  company_name TEXT NOT NULL,
  company_key TEXT NOT NULL,
  company_logo TEXT NOT NULL DEFAULT '',
  description_html TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  -- ISO 3166-1 alpha-2 codes. For a remote job: where a candidate may live.
  -- For a hybrid job: where the office is.
  countries TEXT[] NOT NULL DEFAULT '{}',
  -- 'worldwide', 'europe', 'emea', 'apac', 'asia', 'americas',
  -- 'north-america', 'latam', 'africa', 'middle-east', 'oceania'.
  regions TEXT[] NOT NULL DEFAULT '{}',
  workplace_type TEXT NOT NULL CHECK (workplace_type IN ('remote', 'hybrid')),
  employment_type TEXT
    CHECK (employment_type IN ('full-time', 'part-time', 'contract', 'internship')),
  seniority TEXT CHECK (seniority IN ('entry', 'mid', 'senior', 'lead', 'executive')),
  salary_text TEXT NOT NULL DEFAULT '',
  salary_min NUMERIC,
  salary_max NUMERIC,
  salary_currency TEXT,
  salary_period TEXT,
  -- The lower bound, annualised and converted to USD at a fixed rate. Only
  -- used by the minimum-salary filter.
  salary_usd_annual NUMERIC,
  tech_stack TEXT[] NOT NULL DEFAULT '{}',
  categories TEXT[] NOT NULL DEFAULT '{}',
  -- Industry as the source states it (SmartRecruiters, Workable). Falls back to
  -- the company lookup when NULL.
  source_industry TEXT,
  -- Set when the source itself only lists startups (startup.jobs).
  source_is_startup BOOLEAN,
  posted_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ,
  -- Normalised "title|company", for dropping the same role listed by two sources.
  dedupe_key TEXT NOT NULL,
  -- Lowercased title, company, categories and tech stack: what keyword search
  -- matches against.
  search_text TEXT NOT NULL DEFAULT '',
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jobs_posted_at ON jobs(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_source_board ON jobs(source, board);
CREATE INDEX IF NOT EXISTS idx_jobs_source_posted_at ON jobs(source, posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_company_key ON jobs(company_key);
CREATE INDEX IF NOT EXISTS idx_jobs_countries ON jobs USING GIN (countries);
CREATE INDEX IF NOT EXISTS idx_jobs_regions ON jobs USING GIN (regions);
CREATE INDEX IF NOT EXISTS idx_jobs_tech_stack ON jobs USING GIN (tech_stack);

ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- What the search reads: a job plus what is known about its company, without
-- the description. security_invoker keeps the tables' RLS in force through the
-- view; without it the view would run as its owner and expose the rows.
CREATE OR REPLACE VIEW job_listings
WITH (security_invoker = true) AS
SELECT
  j.id,
  j.source,
  j.external_id,
  j.source_url,
  j.application_url,
  j.title,
  j.company_name,
  j.company_logo,
  j.location,
  j.countries,
  j.regions,
  j.workplace_type,
  j.employment_type,
  j.seniority,
  j.salary_text,
  j.salary_usd_annual,
  j.tech_stack,
  j.categories,
  COALESCE(j.source_is_startup, c.is_startup) AS is_startup,
  c.size_band AS company_size,
  COALESCE(j.source_industry, c.industry) AS industry,
  j.posted_at,
  j.dedupe_key,
  j.search_text
FROM jobs j
LEFT JOIN job_companies c ON c.key = j.company_key;

-- Search. Applies every filter, then keeps the newest `p_per_source` matches
-- from EACH source, so the app can rank by relevance and interleave sources
-- (lib/remote-jobs/search.ts). A plain newest-first cut would hand the whole
-- result to Himalayas, which posts ~3,000 jobs a day to everyone else's few
-- hundred.
--
-- `p_keyword_groups` is a JSON array of word lists, e.g. [["react"],["vue"]]:
-- a job matches when every word of ANY list appears in its search_text. It is
-- a deliberately loose pre-filter; the app re-checks matches word by word.
-- An unstated employment type or seniority passes those filters, as it did
-- when filtering happened in the app: the posting simply didn't say.
CREATE OR REPLACE FUNCTION search_job_listings(
  p_workplace TEXT DEFAULT NULL,
  p_countries TEXT[] DEFAULT NULL,
  p_regions TEXT[] DEFAULT NULL,
  p_employment TEXT DEFAULT NULL,
  p_seniority TEXT DEFAULT NULL,
  p_startup BOOLEAN DEFAULT NULL,
  p_sizes TEXT[] DEFAULT NULL,
  p_tech TEXT[] DEFAULT NULL,
  p_industry TEXT DEFAULT NULL,
  p_posted_since TIMESTAMPTZ DEFAULT NULL,
  p_salary_listed BOOLEAN DEFAULT FALSE,
  p_min_salary_usd NUMERIC DEFAULT NULL,
  p_keyword_groups JSONB DEFAULT NULL,
  p_per_source INTEGER DEFAULT 150
)
RETURNS SETOF job_listings
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT (ranked.l).*
  FROM (
    SELECT
      l,
      ROW_NUMBER() OVER (PARTITION BY l.source ORDER BY l.posted_at DESC) AS rn
    FROM job_listings l
    WHERE (p_workplace IS NULL OR l.workplace_type = p_workplace)
      AND (
        (p_countries IS NULL AND p_regions IS NULL)
        OR l.countries && COALESCE(p_countries, '{}'::TEXT[])
        OR l.regions && COALESCE(p_regions, '{}'::TEXT[])
      )
      AND (p_employment IS NULL OR l.employment_type IS NULL OR l.employment_type = p_employment)
      AND (p_seniority IS NULL OR l.seniority IS NULL OR l.seniority = p_seniority)
      AND (p_startup IS NULL OR l.is_startup = p_startup)
      AND (p_sizes IS NULL OR l.company_size = ANY(p_sizes))
      AND (p_tech IS NULL OR l.tech_stack && p_tech)
      AND (p_industry IS NULL OR l.industry = p_industry)
      AND (p_posted_since IS NULL OR l.posted_at >= p_posted_since)
      AND (NOT COALESCE(p_salary_listed, FALSE) OR l.salary_text <> '')
      AND (p_min_salary_usd IS NULL OR l.salary_usd_annual >= p_min_salary_usd)
      AND (
        p_keyword_groups IS NULL
        OR EXISTS (
          SELECT 1
          FROM jsonb_array_elements(p_keyword_groups) AS g(words)
          WHERE NOT EXISTS (
            SELECT 1
            FROM jsonb_array_elements_text(g.words) AS w(word)
            WHERE POSITION(w.word IN l.search_text) = 0
          )
        )
      )
  ) ranked
  WHERE ranked.rn <= p_per_source
  ORDER BY (ranked.l).posted_at DESC;
$$;

REVOKE EXECUTE ON FUNCTION search_job_listings(
  TEXT, TEXT[], TEXT[], TEXT, TEXT, BOOLEAN, TEXT[], TEXT[], TEXT, TIMESTAMPTZ,
  BOOLEAN, NUMERIC, JSONB, INTEGER
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION search_job_listings(
  TEXT, TEXT[], TEXT[], TEXT, TEXT, BOOLEAN, TEXT[], TEXT[], TEXT, TIMESTAMPTZ,
  BOOLEAN, NUMERIC, JSONB, INTEGER
) TO service_role;

-- One row per cron run, and one per source within it. The daily report email
-- is built from these, and they stay as a history of what each source yielded.
CREATE TABLE IF NOT EXISTS job_ingest_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  jobs_expired INTEGER NOT NULL DEFAULT 0,
  companies_enriched INTEGER NOT NULL DEFAULT 0,
  jobs_total INTEGER,
  report_sent_at TIMESTAMPTZ,
  error TEXT
);

CREATE TABLE IF NOT EXISTS job_ingest_source_runs (
  run_id UUID NOT NULL REFERENCES job_ingest_runs(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'ok', 'partial', 'failed', 'skipped')),
  fetched INTEGER NOT NULL DEFAULT 0,
  new_jobs INTEGER NOT NULL DEFAULT 0,
  removed INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  PRIMARY KEY (run_id, source)
);

ALTER TABLE job_ingest_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_ingest_source_runs ENABLE ROW LEVEL SECURITY;
