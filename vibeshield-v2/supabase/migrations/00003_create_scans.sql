CREATE TABLE scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  repo text,
  ref text,
  type text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  progress jsonb NOT NULL DEFAULT '{"total":0,"scanned":0,"findings":0}',
  tree_sha text,
  score char(1),
  summary jsonb,
  duration_ms int,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT scans_type_check CHECK (type IN ('code', 'api', 'text', 'deps')),
  CONSTRAINT scans_status_check CHECK (status IN ('queued', 'fetching', 'scanning', 'analyzing', 'complete', 'failed'))
);
