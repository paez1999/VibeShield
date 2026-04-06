CREATE INDEX idx_vulns_org_status ON vulnerabilities(org_id, status);
CREATE INDEX idx_vulns_org_severity ON vulnerabilities(org_id, severity);
CREATE INDEX idx_vulns_org_created ON vulnerabilities(org_id, first_seen_at);
CREATE INDEX idx_scans_org_created ON scans(org_id, created_at);
CREATE INDEX idx_scans_org_type ON scans(org_id, type);
CREATE INDEX idx_org_members_org ON org_members(org_id);
