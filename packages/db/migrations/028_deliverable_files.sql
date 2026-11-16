-- Files an expert uploads as the deliverable for a gig order or a contract milestone.
-- The bytes live in S3 (DELIVERABLE_BUCKET, browser PUT via presigned URL); downloads go
-- through the API, which checks the caller is a party before redirecting to S3.
CREATE TABLE IF NOT EXISTS deliverable_files (
  id            UUID          PRIMARY KEY,
  uploaded_by   UUID          NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
  order_id      VARCHAR(32)   REFERENCES gig_orders(id) ON DELETE CASCADE,
  contract_id   VARCHAR(32)   NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  milestone_id  UUID          REFERENCES contract_milestones(id) ON DELETE SET NULL,
  object_key    TEXT          NOT NULL UNIQUE,
  file_name     VARCHAR(200)  NOT NULL,
  content_type  VARCHAR(120)  NOT NULL,
  size_bytes    BIGINT        NOT NULL CHECK (size_bytes BETWEEN 1 AND 52428800),
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_deliverable_files_contract ON deliverable_files(contract_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deliverable_files_order ON deliverable_files(order_id, created_at DESC) WHERE order_id IS NOT NULL;
