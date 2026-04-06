ALTER TABLE orgs ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE vulnerabilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orgs_select" ON orgs
  FOR SELECT USING (id = auth.user_org_id());
CREATE POLICY "orgs_update" ON orgs
  FOR UPDATE USING (id = auth.user_org_id());

CREATE POLICY "org_members_select" ON org_members
  FOR SELECT USING (org_id = auth.user_org_id());

CREATE POLICY "scans_select" ON scans
  FOR SELECT USING (org_id = auth.user_org_id());
CREATE POLICY "scans_insert" ON scans
  FOR INSERT WITH CHECK (org_id = auth.user_org_id());

CREATE POLICY "vulns_select" ON vulnerabilities
  FOR SELECT USING (org_id = auth.user_org_id());
CREATE POLICY "vulns_update" ON vulnerabilities
  FOR UPDATE USING (org_id = auth.user_org_id())
  WITH CHECK (org_id = auth.user_org_id());
