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
  ADD COLUMN IF NOT EXISTS date_format TEXT;
