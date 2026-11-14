-- Migration: 0001_auto_sync_module.sql
-- Purpose: Extend lottery_results, api_providers, sync_logs and add sync_sessions
-- for the Automatic Lottery API Synchronization Module (Asia/Ho_Chi_Minh).

ALTER TABLE "lottery_results"
  ADD COLUMN IF NOT EXISTS "sync_status" text NOT NULL DEFAULT 'COMPLETED',
  ADD COLUMN IF NOT EXISTS "prizes_found" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "prizes_expected" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "payload_hash" text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "version" integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "verified_at" timestamp;

ALTER TABLE "api_providers"
  ADD COLUMN IF NOT EXISTS "adapter_type" text NOT NULL DEFAULT 'xosovnm',
  ADD COLUMN IF NOT EXISTS "auth_header" text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS "rate_limit_per_min" integer NOT NULL DEFAULT 30;

ALTER TABLE "sync_logs"
  ADD COLUMN IF NOT EXISTS "sync_mode" text NOT NULL DEFAULT 'AUTO_SCHEDULER',
  ADD COLUMN IF NOT EXISTS "endpoint_url" text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "http_status" integer,
  ADD COLUMN IF NOT EXISTS "prizes_found" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "prizes_expected" integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "sync_sessions" (
  "id" serial PRIMARY KEY NOT NULL,
  "draw_date" text NOT NULL,
  "region" text NOT NULL,
  "status" text NOT NULL DEFAULT 'PENDING',
  "scheduled_start" text NOT NULL,
  "draw_start" text NOT NULL,
  "scheduled_end" text NOT NULL,
  "provinces_expected" integer NOT NULL DEFAULT 0,
  "provinces_completed" integer NOT NULL DEFAULT 0,
  "poll_count" integer NOT NULL DEFAULT 0,
  "api_requests_count" integer NOT NULL DEFAULT 0,
  "last_poll_at" timestamp,
  "completed_at" timestamp,
  "locked_by" text NOT NULL DEFAULT '',
  "locked_until" timestamp,
  "last_error" text NOT NULL DEFAULT '',
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "sync_sessions_date_region_idx"
  ON "sync_sessions" ("draw_date", "region");
