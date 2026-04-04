-- VibeShield MVP — Initial Schema

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE organizations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(255) NOT NULL,
  api_key_hash  VARCHAR(255) UNIQUE,
  webhook_url   TEXT,
  created_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(20) DEFAULT 'admin',
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE integrations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type          VARCHAR(50) NOT NULL,
  scopes        TEXT[] NOT NULL DEFAULT '{}',
  used_scopes   TEXT[] NOT NULL DEFAULT '{}',
  risk_score    INT DEFAULT 0,
  last_rotated  TIMESTAMP,
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW(),
  UNIQUE(org_id, type)
);

CREATE TABLE secrets_found (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  secret_type   VARCHAR(50),
  secret_hash   VARCHAR(255) NOT NULL,
  location      VARCHAR(512),
  severity      VARCHAR(20) NOT NULL,
  remediated    BOOLEAN DEFAULT FALSE,
  discovered_at TIMESTAMP DEFAULT NOW(),
  remediated_at TIMESTAMP
);

CREATE TABLE breached_users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_email    VARCHAR(255) NOT NULL,
  breach_source VARCHAR(255),
  breach_date   TIMESTAMP,
  action_taken  VARCHAR(20),
  discovered_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE moderation_incidents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  content_id    VARCHAR(255),
  content_type  VARCHAR(50),
  user_id       VARCHAR(255),
  flagged_reason VARCHAR(255),
  confidence    FLOAT CHECK (confidence >= 0 AND confidence <= 1),
  status        VARCHAR(20) DEFAULT 'pending',
  mod_action    VARCHAR(50),
  created_at    TIMESTAMP DEFAULT NOW(),
  resolved_at   TIMESTAMP
);

CREATE TABLE audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  action        VARCHAR(255) NOT NULL,
  resource_type VARCHAR(50),
  resource_id   VARCHAR(255),
  ip_address    INET,
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_integrations_org      ON integrations(org_id);
CREATE INDEX idx_secrets_org           ON secrets_found(org_id);
CREATE INDEX idx_secrets_remediated    ON secrets_found(org_id, remediated);
CREATE INDEX idx_breached_org          ON breached_users(org_id);
CREATE INDEX idx_incidents_org_status  ON moderation_incidents(org_id, status);
CREATE INDEX idx_audit_org_time        ON audit_log(org_id, created_at DESC);
CREATE INDEX idx_users_email           ON users(email);
