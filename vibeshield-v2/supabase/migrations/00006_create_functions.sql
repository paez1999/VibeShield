CREATE OR REPLACE FUNCTION auth.user_org_id()
RETURNS uuid AS $$
  SELECT org_id FROM public.org_members WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.vuln_summary_by_org(p_org_id uuid)
RETURNS jsonb AS $$
  SELECT jsonb_build_object(
    'critical', COUNT(*) FILTER (WHERE severity = 'critical' AND status = 'open'),
    'high',     COUNT(*) FILTER (WHERE severity = 'high' AND status = 'open'),
    'medium',   COUNT(*) FILTER (WHERE severity = 'medium' AND status = 'open'),
    'low',      COUNT(*) FILTER (WHERE severity = 'low' AND status = 'open'),
    'info',     COUNT(*) FILTER (WHERE severity = 'info' AND status = 'open')
  )
  FROM public.vulnerabilities
  WHERE org_id = p_org_id;
$$ LANGUAGE sql STABLE;
