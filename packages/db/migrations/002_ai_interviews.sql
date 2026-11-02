-- Migration: 002_ai_interviews.sql
-- AI mock interviews, their Part 1 EQ / Resilience / Grit scores, and certificates.
--
-- The interview itself runs on deeptech_ai: the browser talks to it directly over a
-- WebSocket. The platform creates the row when the interview starts and deeptech_ai
-- posts the result back when it finishes (deeptech_ai/results_sink.py ->
-- POST /api/v1/internal/ai-results), so every column below is written by this API.
--
-- Run with: psql $DATABASE_URL -f 002_ai_interviews.sql

-- ─── Mock interviews ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mock_interviews (
  -- The id deeptech_ai issued at /mock-interview/start; the WebSocket and every
  -- posted result are keyed on it.
  id                        UUID          PRIMARY KEY,
  user_id                   UUID          NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
  category                  TEXT          NOT NULL CHECK (category IN ('tech', 'non-tech', 'frontline')),
  skill                     TEXT          NOT NULL,
  domain                    TEXT          NOT NULL,
  summary                   TEXT          NOT NULL DEFAULT '',
  language                  TEXT          NOT NULL DEFAULT 'en',
  -- frontline_roles key (e.g. 'ship_bosun') when category = 'frontline'.
  frontline_role_id         TEXT,
  status                    TEXT          NOT NULL DEFAULT 'in_progress'
                                          CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  turns                     SMALLINT      NOT NULL DEFAULT 0,
  ended_reason              TEXT,
  conversation              JSONB         NOT NULL DEFAULT '[]',
  proctoring_summary        JSONB         NOT NULL DEFAULT '{}',
  interview_details         JSONB         NOT NULL DEFAULT '{}',
  ai_audio_url              TEXT,
  candidate_audio_url       TEXT,
  -- Filled on first certificate download (or by an admin), then reused.
  certificate_content       JSONB,
  certificate_source        TEXT          CHECK (certificate_source IN ('ai', 'assessment')),
  certificate_generated_at  TIMESTAMPTZ,
  started_at                TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  completed_at              TIMESTAMPTZ,
  created_at                TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mock_interviews_user    ON mock_interviews(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_mock_interviews_status  ON mock_interviews(status);

-- ─── Part 1: EQ / Resilience / Grit ─────────────────────────────────────────
-- One row per interview. interview_type is deeptech_ai's PRE_ASSESSMENT_TYPE ('mock'
-- for a mock interview; frontline and enterprise interviews will add their own).
CREATE TABLE IF NOT EXISTS candidate_assessments (
  id                UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  interview_type    TEXT          NOT NULL,
  interview_ref_id  TEXT          NOT NULL,
  user_id           UUID          REFERENCES user_accounts(id) ON DELETE CASCADE,
  ai_assessment_id  TEXT,
  status            TEXT          NOT NULL,
  language          TEXT,
  eq_score          NUMERIC(5,2),
  resilience_score  NUMERIC(5,2),
  grit_score        NUMERIC(5,2),
  result            JSONB         NOT NULL DEFAULT '{}',
  scored_at         TIMESTAMPTZ,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (interview_type, interview_ref_id)
);

CREATE INDEX IF NOT EXISTS idx_candidate_assessments_user ON candidate_assessments(user_id);

-- ─── Results received from deeptech_ai ───────────────────────────────────────
-- Every post is kept as it arrived, so a result that could not be applied (for
-- example an interview id this platform never started) can be inspected or replayed.
CREATE TABLE IF NOT EXISTS ai_result_events (
  id           BIGSERIAL     PRIMARY KEY,
  event        TEXT          NOT NULL,
  ref_id       TEXT,
  applied      BOOLEAN       NOT NULL DEFAULT FALSE,
  error        TEXT,
  payload      JSONB         NOT NULL,
  received_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_result_events_ref ON ai_result_events(ref_id);
