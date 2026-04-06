ALTER TABLE scans ADD CONSTRAINT scans_score_check CHECK (score IS NULL OR score IN ('A', 'B', 'C', 'D', 'F'));
