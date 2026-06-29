-- Migration: Add Job Tracking Tables for Extraction and Enrichment
-- Run this in the Supabase SQL Editor to update your production database.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Ensure trigger function handle_update_timestamp exists
CREATE OR REPLACE FUNCTION handle_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Table: extraction_jobs
CREATE TABLE IF NOT EXISTS extraction_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid REFERENCES business_cards(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  raw_response text,
  result jsonb
);

-- Index on card_id for extraction_jobs
CREATE INDEX IF NOT EXISTS idx_extraction_jobs_card_id ON extraction_jobs(card_id);

-- Trigger for extraction_jobs updated_at
DROP TRIGGER IF EXISTS update_extraction_jobs_updated_at ON extraction_jobs;
CREATE TRIGGER update_extraction_jobs_updated_at
BEFORE UPDATE ON extraction_jobs
FOR EACH ROW
EXECUTE FUNCTION handle_update_timestamp();

-- Table: enrichment_jobs
CREATE TABLE IF NOT EXISTS enrichment_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid REFERENCES business_cards(id) ON DELETE CASCADE,
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'skipped')),
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  raw_response jsonb,
  skipped_reason text
);

-- Index on card_id for enrichment_jobs
CREATE INDEX IF NOT EXISTS idx_enrichment_jobs_card_id ON enrichment_jobs(card_id);

-- Trigger for enrichment_jobs updated_at
DROP TRIGGER IF EXISTS update_enrichment_jobs_updated_at ON enrichment_jobs;
CREATE TRIGGER update_enrichment_jobs_updated_at
BEFORE UPDATE ON enrichment_jobs
FOR EACH ROW
EXECUTE FUNCTION handle_update_timestamp();

-- Helper function to increment extraction job attempts via RPC
CREATE OR REPLACE FUNCTION increment_extraction_attempts(job_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE extraction_jobs
  SET attempts = attempts + 1
  WHERE id = job_id;
END;
$$ LANGUAGE plpgsql;

-- Helper function to increment enrichment job attempts via RPC
CREATE OR REPLACE FUNCTION increment_enrichment_attempts(job_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE enrichment_jobs
  SET attempts = attempts + 1
  WHERE id = job_id;
END;
$$ LANGUAGE plpgsql;
