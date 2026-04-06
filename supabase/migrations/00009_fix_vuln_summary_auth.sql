CREATE OR REPLACE FUNCTION public.vuln_summary_by_org(p_org_id uuid)
RETURNS jsonb AS $$
BEGIN
  -- Verify caller owns this org (returns null for service role, which is fine)
  IF public.user_org_id() IS NOT NULL AND public.user_org_id() != p_org_id THEN
    RETURN '{"critical":0,"high":0,"medium":0,"low":0,"info":0}'::jsonb;
  END IF;

  RETURN (
    SELECT jsonb_build_object(
      'critical', COUNT(*) FILTER (WHERE severity = 'critical' AND status = 'open'),
      'high',     COUNT(*) FILTER (WHERE severity = 'high' AND status = 'open'),
      'medium',   COUNT(*) FILTER (WHERE severity = 'medium' AND status = 'open'),
      'low',      COUNT(*) FILTER (WHERE severity = 'low' AND status = 'open'),
      'info',     COUNT(*) FILTER (WHERE severity = 'info' AND status = 'open')
    )
    FROM public.vulnerabilities
    WHERE org_id = p_org_id
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
