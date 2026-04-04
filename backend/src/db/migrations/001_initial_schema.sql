-- VibeShield — Initial Schema
-- Migration 001

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Organizations (the vibecoding app itself)
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  api_key_hash VARCHAR(255) UNIQUE,
  webhook_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users (VibeShield dashboard admins)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'admin' CHECK (role IN ('owner', 'admin', 'viewer')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Integrations (Spotify, AWS, GitHub, etc.)
CREATE TABLE IF NOT EXISTS integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  display_name VARCHAR(255),
  scopes TEXT[] NOT NULL DEFAULT '{}',
  used_scopes TEXT[] NOT NULL DEFAULT '{}',
  risk_score INT NOT NULL DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 100),
  metadata JSONB DEFAULT '{}',
  last_rotated TIMESTAMPTZ,
  last_scanned TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, type)
);

-- Secrets Found (never store raw secrets)
CREATE TABLE IF NOT EXISTS secrets_found (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  secret_type VARCHAR(50) NOT NULL,
  secret_hash VARCHAR(255) NOT NULL,
  location VARCHAR(500),
  commit_sha VARCHAR(40),
  repo_name VARCHAR(255),
  severity VARCHAR(20) NOT NULL DEFAULT 'high' CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  remediated BOOLEAN NOT NULL DEFAULT FALSE,
  discovered_at TIMESTAMPTZ DEFAULT NOW(),
  remediated_at TIMESTAMPTZ
);

-- Users in Breaches
CREATE TABLE IF NOT EXISTS breached_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_email VARCHAR(255) NOT NULL,
  breach_source VARCHAR(255),
  breach_names TEXT[] DEFAULT '{}',
  breach_date TIMESTAMPTZ,
  action_taken VARCHAR(30) CHECK (action_taken IN ('notified', 'pw_reset_forced', 'mfa_enrolled', 'pending')),
  discovered_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, user_email)
);

-- Moderation Incidents
CREATE TABLE IF NOT EXISTS moderation_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  content_id VARCHAR(255),
  content_type VARCHAR(50) CHECK (content_type IN ('message', 'image', 'audio', 'video')),
  user_id VARCHAR(255),
  flagged_reason VARCHAR(100),
  confidence FLOAT CHECK (confidence BETWEEN 0 AND 1),
  raw_content TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'escalated')),
  mod_action VARCHAR(50),
  resolved_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- Audit Log (immutable)
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  action VARCHAR(255) NOT NULL,
  resource_type VARCHAR(50),
  resource_id VARCHAR(255),
  ip_address INET,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_integrations_org ON integrations(org_id);
CREATE INDEX IF NOT EXISTS idx_secrets_org ON secrets_found(org_id);
CREATE INDEX IF NOT EXISTS idx_secrets_remediated ON secrets_found(remediated);
CREATE INDEX IF NOT EXISTS idx_breached_users_org ON breached_users(org_id);
CREATE INDEX IF NOT EXISTS idx_incidents_org ON moderation_incidents(org_id);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON moderation_incidents(status);
CREATE INDEX IF NOT EXISTS idx_audit_org_ts ON audit_log(org_id, timestamp DESC);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE OR REPLACE TRIGGER trg_orgs_updated_at
  BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE OR REPLACE TRIGGER trg_integrations_updated_at
  BEFORE UPDATE ON integrations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
