-- Document intentional RLS design decisions for scans and vulnerabilities.
--
-- The existing policy set is correct for the current access pattern:
--   Users:           SELECT scans, INSERT scans (trigger)
--   Cloud Functions (service role): UPDATE scans (progress, complete, fail), INSERT/UPSERT vulns
--   Service role bypasses RLS entirely, so no policies needed for it.
--
-- No user-facing UPDATE policy on scans is needed because scan status updates
-- come exclusively from Cloud Functions via the service role key.
-- No INSERT policy on vulnerabilities is needed for the same reason.

COMMENT ON TABLE scans IS 'Scan jobs. Users can SELECT and INSERT via RLS. Status updates come from Cloud Functions (service role, bypasses RLS).';
COMMENT ON TABLE vulnerabilities IS 'Vulnerability findings. Users can SELECT and UPDATE (resolve/ignore) via RLS. INSERT/UPSERT comes from Cloud Functions (service role, bypasses RLS).';
