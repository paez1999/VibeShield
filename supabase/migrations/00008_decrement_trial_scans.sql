CREATE OR REPLACE FUNCTION public.decrement_trial_scans(p_org_id uuid)
RETURNS void AS $$
  UPDATE orgs
  SET trial_scans_remaining = GREATEST(0, trial_scans_remaining - 1)
  WHERE id = p_org_id AND trial_scans_remaining > 0;
$$ LANGUAGE sql VOLATILE SECURITY DEFINER;
