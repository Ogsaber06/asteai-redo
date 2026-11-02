-- Migration: 001_initial_schema.sql
-- AsteAI Platform – AWS RDS (PostgreSQL 16)
-- Converted from Supabase schema; auth.users references replaced with local user_accounts.
-- Run with: psql $DATABASE_URL -f 001_initial_schema.sql

-- ─── Extensions ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- fuzzy text search

-- ─── Enums ───────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE user_role_enum AS ENUM ('Employer', 'Candidate', 'Freelancer', 'Buyer', 'Admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE account_status_enum AS ENUM ('active', 'deactivated', 'deleted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE engagement_model_enum AS ENUM ('hourly', 'fixed', 'sprint', 'daily', 'any');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE contract_status_enum AS ENUM (
    'pending', 'active', 'completed', 'cancelled', 'disputed', 'expired'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE delivery_status_enum AS ENUM (
    'not_started', 'in_progress', 'submitted', 'revision_requested', 'approved', 'rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE application_stage_enum AS ENUM (
    'Applied', 'Eligibility', 'Assessment Pending', 'Assessment Review',
    'Shortlisted', 'Interview', 'Offer', 'Joined', 'Rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE req_status_enum AS ENUM ('Draft', 'Open', 'Paused', 'Closed', 'Filled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE candidate_tier_enum AS ENUM ('Technical', 'Non-Technical', 'Frontline', 'Skilled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE project_stage_enum AS ENUM (
    'Open for Bids', 'Shortlisting', 'Contracted',
    'In Progress', 'Milestone Submitted', 'Completed', 'Disputed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE milestone_status_enum AS ENUM (
    'Pending', 'Funded', 'Submitted', 'Accepted', 'Released', 'Disputed', 'Revision requested'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE passport_status_enum AS ENUM ('Valid', 'Expired', 'Revoked');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Core Tables ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tenants (
  id             VARCHAR(64)   PRIMARY KEY,
  name           TEXT          NOT NULL,
  industry       TEXT          NOT NULL,
  plan           TEXT          NOT NULL DEFAULT 'Free',
  credits        INTEGER       NOT NULL DEFAULT 0,
  seats          INTEGER       NOT NULL DEFAULT 5,
  domain         TEXT,
  retention_months INTEGER     NOT NULL DEFAULT 12,
  sso_enabled    BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_accounts (
  id                    UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  email                 VARCHAR(255)  NOT NULL UNIQUE,
  email_canonical       VARCHAR(255),
  first_name            VARCHAR(100),
  last_name             VARCHAR(100),
  role                  user_role_enum NOT NULL DEFAULT 'Candidate',
  tenant_id             VARCHAR(64)   REFERENCES tenants(id) ON DELETE SET NULL,
  title                 TEXT,
  avatar_url            TEXT,
  banner_url            TEXT,
  phone                 VARCHAR(30),
  phone_verified        BOOLEAN       NOT NULL DEFAULT FALSE,
  email_verified        BOOLEAN       NOT NULL DEFAULT FALSE,
  preferred_language    TEXT          NOT NULL DEFAULT 'en',
  country               TEXT,
  city                  TEXT,
  state                 TEXT,
  timezone              TEXT,
  linkedin_url          TEXT,
  github_url            TEXT,
  password_hash         TEXT,                        -- bcrypt; null = OAuth only
  auth_provider         TEXT,                        -- 'local' | 'google' | 'linkedin'
  active_session_id     UUID,
  is_banned             BOOLEAN       NOT NULL DEFAULT FALSE,
  ban_reason            TEXT,
  is_suspended          BOOLEAN       NOT NULL DEFAULT FALSE,
  suspended_until       TIMESTAMPTZ,
  account_status        account_status_enum NOT NULL DEFAULT 'active',
  terms_accepted        BOOLEAN       NOT NULL DEFAULT FALSE,
  terms_accepted_at     TIMESTAMPTZ,
  two_factor_enabled    BOOLEAN       NOT NULL DEFAULT FALSE,
  two_factor_secret     TEXT,
  referral_code         VARCHAR(20)   UNIQUE,
  referred_by           UUID          REFERENCES user_accounts(id) ON DELETE SET NULL,
  settings              JSONB         NOT NULL DEFAULT '{}',
  deleted_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  last_login            TIMESTAMPTZ,
  last_logout           TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_user_accounts_email    ON user_accounts(email);
CREATE INDEX IF NOT EXISTS idx_user_accounts_tenant   ON user_accounts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_accounts_role     ON user_accounts(role);

-- ─── Requisitions ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS requisitions (
  id              VARCHAR(32)          PRIMARY KEY,
  tenant_id       VARCHAR(64)          NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  owner_id        UUID                 NOT NULL REFERENCES user_accounts(id),
  title           TEXT                 NOT NULL,
  industry        TEXT                 NOT NULL,
  func            TEXT                 NOT NULL,
  ech_level       SMALLINT             NOT NULL CHECK (ech_level BETWEEN 1 AND 6),
  tier            candidate_tier_enum  NOT NULL,
  weight_iq       SMALLINT             NOT NULL DEFAULT 33 CHECK (weight_iq BETWEEN 0 AND 100),
  weight_eq       SMALLINT             NOT NULL DEFAULT 33 CHECK (weight_eq BETWEEN 0 AND 100),
  weight_grit     SMALLINT             NOT NULL DEFAULT 34 CHECK (weight_grit BETWEEN 0 AND 100),
  language        TEXT                 NOT NULL DEFAULT 'English',
  location        TEXT,
  headcount       SMALLINT             NOT NULL DEFAULT 1,
  min_shortlist   SMALLINT             NOT NULL DEFAULT 5,
  threshold       NUMERIC(4,2)         NOT NULL DEFAULT 6.0,
  status          req_status_enum      NOT NULL DEFAULT 'Draft',
  sla_funded      BOOLEAN              NOT NULL DEFAULT FALSE,
  sla_start_at    TIMESTAMPTZ,
  sla_paused_at   TIMESTAMPTZ,
  sla_delivered_at TIMESTAMPTZ,
  stack           TEXT[]               NOT NULL DEFAULT '{}',
  brief           TEXT,
  created_at      TIMESTAMPTZ          NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ          NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_requisitions_tenant  ON requisitions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_requisitions_status  ON requisitions(status);

-- ─── Candidates ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS candidates (
  id          UUID    PRIMARY KEY REFERENCES user_accounts(id) ON DELETE CASCADE,
  lang        TEXT,
  age_band    TEXT,
  location    TEXT,
  experience  TEXT,
  source      TEXT,
  utm         JSONB   NOT NULL DEFAULT '{}'
);

-- ─── Applications ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS applications (
  id              VARCHAR(32)              PRIMARY KEY,
  candidate_id    UUID                     NOT NULL REFERENCES user_accounts(id),
  requisition_id  VARCHAR(32)              NOT NULL REFERENCES requisitions(id) ON DELETE CASCADE,
  tenant_id       VARCHAR(64)              NOT NULL REFERENCES tenants(id),
  stage           application_stage_enum   NOT NULL DEFAULT 'Applied',
  result_id       VARCHAR(32),
  notes           TEXT[]                   NOT NULL DEFAULT '{}',
  interview       JSONB,
  offer           JSONB,
  history         JSONB                    NOT NULL DEFAULT '[]',
  created_at      TIMESTAMPTZ              NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ              NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_applications_req    ON applications(requisition_id);
CREATE INDEX IF NOT EXISTS idx_applications_cand   ON applications(candidate_id);
CREATE INDEX IF NOT EXISTS idx_applications_stage  ON applications(stage);

CREATE TABLE IF NOT EXISTS scorecards (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id  VARCHAR(32) NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  scored_by       UUID        NOT NULL REFERENCES user_accounts(id),
  score           NUMERIC(4,2),
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Assessment Results ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS assessment_results (
  id              VARCHAR(32)    PRIMARY KEY,
  candidate_id    UUID           NOT NULL REFERENCES user_accounts(id),
  requisition_id  VARCHAR(32)    NOT NULL REFERENCES requisitions(id),
  theta_iq        NUMERIC(6,4),
  theta_eq        NUMERIC(6,4),
  theta_grit      NUMERIC(6,4),
  sten_iq         NUMERIC(4,2),
  sten_eq         NUMERIC(4,2),
  sten_grit       NUMERIC(4,2),
  fit_score       NUMERIC(5,2),
  ci_score        NUMERIC(4,2),
  integrity       VARCHAR(16)    NOT NULL DEFAULT 'Clear',
  integ_blur      SMALLINT       NOT NULL DEFAULT 0,
  integ_paste     SMALLINT       NOT NULL DEFAULT 0,
  integ_fast      SMALLINT       NOT NULL DEFAULT 0,
  n_iq            SMALLINT,
  n_eq            SMALLINT,
  n_grit          SMALLINT,
  duration_sec    SMALLINT,
  ev_data         JSONB,
  self_data       JSONB,
  safety_data     JSONB,
  sealed          BOOLEAN        NOT NULL DEFAULT TRUE,
  hash            TEXT,
  taken_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_results_candidate ON assessment_results(candidate_id);
CREATE INDEX IF NOT EXISTS idx_results_req       ON assessment_results(requisition_id);

-- ─── Integrity Queue ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS integrity_queue (
  id          VARCHAR(32)  PRIMARY KEY,
  result_id   VARCHAR(32)  NOT NULL REFERENCES assessment_results(id),
  reason      TEXT         NOT NULL,
  status      TEXT         NOT NULL DEFAULT 'Open',
  reviewed_by UUID         REFERENCES user_accounts(id),
  resolution  TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── Talent Passports ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS passports (
  id              VARCHAR(32)          PRIMARY KEY,
  user_id         UUID                 NOT NULL REFERENCES user_accounts(id),
  name            TEXT                 NOT NULL,
  tier            candidate_tier_enum  NOT NULL,
  scores          JSONB                NOT NULL DEFAULT '[]',
  sten_iq         NUMERIC(4,2),
  sten_eq         NUMERIC(4,2),
  sten_grit       NUMERIC(4,2),
  percentile      NUMERIC(5,2),
  hash            TEXT,
  issued_at       TIMESTAMPTZ          NOT NULL DEFAULT NOW(),
  valid_until     TIMESTAMPTZ,
  status          passport_status_enum NOT NULL DEFAULT 'Valid',
  discoverable    BOOLEAN              NOT NULL DEFAULT TRUE,
  show_identity   BOOLEAN              NOT NULL DEFAULT FALSE,
  verifications   JSONB                NOT NULL DEFAULT '[]',
  updated_at      TIMESTAMPTZ          NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_passports_user   ON passports(user_id);
CREATE INDEX IF NOT EXISTS idx_passports_status ON passports(status);

-- ─── Certificates ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS certificates (
  id          VARCHAR(32)  PRIMARY KEY,
  user_id     UUID         NOT NULL REFERENCES user_accounts(id),
  name        TEXT         NOT NULL,
  issued_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  hash        TEXT
);

-- ─── Projects ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS projects (
  id              VARCHAR(32)         PRIMARY KEY,
  buyer_id        UUID                NOT NULL REFERENCES user_accounts(id),
  tenant_id       VARCHAR(64)         REFERENCES tenants(id),
  title           TEXT                NOT NULL,
  domain          TEXT,
  budget          NUMERIC(12,2),
  stage           project_stage_enum  NOT NULL DEFAULT 'Open for Bids',
  description     TEXT,
  milestones      JSONB               NOT NULL DEFAULT '[]',
  nda_required    BOOLEAN             NOT NULL DEFAULT FALSE,
  awarded_to      UUID                REFERENCES user_accounts(id),
  rating          JSONB,
  packaged        BOOLEAN             NOT NULL DEFAULT FALSE,
  invited_users   UUID[],
  created_at      TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_buyer  ON projects(buyer_id);
CREATE INDEX IF NOT EXISTS idx_projects_stage  ON projects(stage);

-- ─── Proposals ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS proposals (
  id          VARCHAR(32)   PRIMARY KEY,
  project_id  VARCHAR(32)   NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  expert_id   UUID          NOT NULL REFERENCES user_accounts(id),
  price       NUMERIC(12,2) NOT NULL,
  days        SMALLINT      NOT NULL,
  note        TEXT,
  status      TEXT          NOT NULL DEFAULT 'Pending',
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proposals_project ON proposals(project_id);
CREATE INDEX IF NOT EXISTS idx_proposals_expert  ON proposals(expert_id);

-- ─── Ledger ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ledger_entries (
  id          VARCHAR(32)   PRIMARY KEY,
  tenant_id   VARCHAR(64)   REFERENCES tenants(id),
  user_id     UUID          REFERENCES user_accounts(id),
  type        TEXT          NOT NULL,
  description TEXT          NOT NULL,
  amount      NUMERIC(14,2) NOT NULL,
  unit        TEXT,
  payee_id    UUID          REFERENCES user_accounts(id),
  fee         NUMERIC(12,2),
  by          TEXT          NOT NULL,
  ref         TEXT,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ledger_tenant  ON ledger_entries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ledger_user    ON ledger_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_ledger_created ON ledger_entries(created_at DESC);

-- ─── Notifications ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID         NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
  text        TEXT         NOT NULL,
  link        TEXT         NOT NULL DEFAULT '#',
  read        BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id) WHERE read = FALSE;

-- ─── Audit Log ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_log (
  id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id    UUID         REFERENCES user_accounts(id),
  actor_name  TEXT,
  role        TEXT,
  action      TEXT         NOT NULL,
  entity      TEXT         NOT NULL,
  meta        TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_actor   ON audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);

-- ─── Talent Pools ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS talent_pools (
  id              VARCHAR(32)   PRIMARY KEY,
  tenant_id       VARCHAR(64)   NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            TEXT          NOT NULL,
  count           INTEGER       NOT NULL DEFAULT 0,
  consent_expiry  TIMESTAMPTZ,
  tags            TEXT[]        NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ─── Outreach Campaigns ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS outreach_campaigns (
  id          VARCHAR(32)  PRIMARY KEY,
  tenant_id   VARCHAR(64)  NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT         NOT NULL,
  channel     TEXT         NOT NULL,
  sent        INTEGER      NOT NULL DEFAULT 0,
  opened      INTEGER      NOT NULL DEFAULT 0,
  applied     INTEGER      NOT NULL DEFAULT 0,
  status      TEXT         NOT NULL DEFAULT 'Draft',
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── Disputes ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS disputes (
  id              VARCHAR(32)  PRIMARY KEY,
  project_id      VARCHAR(32)  REFERENCES projects(id),
  raised_by       UUID         NOT NULL REFERENCES user_accounts(id),
  raised_against  UUID         NOT NULL REFERENCES user_accounts(id),
  reason          TEXT         NOT NULL,
  status          TEXT         NOT NULL DEFAULT 'Open',
  resolution      TEXT,
  timeline        JSONB        NOT NULL DEFAULT '[]',
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── Consents ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS consents (
  id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID         NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
  purpose     TEXT         NOT NULL,
  status      TEXT         NOT NULL DEFAULT 'Active',
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  revoked_at  TIMESTAMPTZ
);

-- ─── Refresh Tokens ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID         NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
  token_hash  TEXT         NOT NULL UNIQUE,
  user_agent  TEXT,
  ip_address  INET,
  expires_at  TIMESTAMPTZ  NOT NULL,
  revoked     BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
