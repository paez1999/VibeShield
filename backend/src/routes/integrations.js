import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/client.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { scanGitHubRepo, scanText } from '../services/secretScanner.js';
import { scoreIntegration, scoreAll } from '../services/riskScorer.js';

const router = Router();
router.use(authenticate);

const ScanGitHubSchema = z.object({
  repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/, 'Format: owner/repo'),
  ref:  z.string().default('main'),
});

const ScanTextSchema = z.object({
  content:  z.string().min(1),
  filename: z.string().default('pasted-content'),
});

async function persistFindings(orgId, findings) {
  if (!findings.length) return;
  const values = findings.map((_, i) =>
    `($1, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4}, $${i * 4 + 5})`
  ).join(', ');
  const params = [orgId, ...findings.flatMap((f) => [f.type, f.hash, f.location, f.severity])];
  await query(
    `INSERT INTO secrets_found (org_id, secret_type, secret_hash, location, severity)
     VALUES ${values} ON CONFLICT DO NOTHING`,
    params,
  );
}

// GET /integrations — list all with live risk scores
router.get('/', asyncHandler(async (req, res) => {
  const { orgId } = req.user;
  const { rows } = await query(
    `SELECT i.*, COUNT(s.id) FILTER (WHERE s.remediated = FALSE) AS open_secrets
     FROM integrations i
     LEFT JOIN secrets_found s ON s.org_id = i.org_id
       AND s.secret_type ILIKE '%' || i.type || '%' AND s.remediated = FALSE
     WHERE i.org_id = $1
     GROUP BY i.id ORDER BY i.risk_score DESC`,
    [orgId],
  );
  const scored = scoreAll(rows.map((i) => ({
    ...i, usedScopes: i.used_scopes, lastRotated: i.last_rotated,
    secretsFound: Number(i.open_secrets),
  })));
  res.json({ data: scored });
}));

// GET /integrations/secrets/open — all unresolved secrets
router.get('/secrets/open', asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT id, secret_type, location, severity, discovered_at
     FROM secrets_found WHERE org_id = $1 AND remediated = FALSE
     ORDER BY CASE severity
       WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
       discovered_at DESC`,
    [req.user.orgId],
  );
  res.json({ data: rows, count: rows.length });
}));

// POST /integrations/scan/github — trigger GitHub repo scan
router.post('/scan/github', asyncHandler(async (req, res) => {
  const { repo, ref } = ScanGitHubSchema.parse(req.body);
  const { orgId, userId } = req.user;

  const result = await scanGitHubRepo(repo, ref);
  await persistFindings(orgId, result.findings);
  await query(
    `INSERT INTO audit_log (org_id, user_id, action, resource_type, resource_id, ip_address, metadata)
     VALUES ($1, $2, 'github_scan', 'repository', $3, $4, $5)`,
    [orgId, userId, repo, req.ip, JSON.stringify({
      ref, scannedFiles: result.scannedFiles, findingsCount: result.findings.length,
    })],
  );

  res.json({
    message:  `Scanned ${result.scannedFiles} files in ${repo}@${result.commit}`,
    findings: result.findings.length,
    critical: result.findings.filter((f) => f.severity === 'critical').length,
    high:     result.findings.filter((f) => f.severity === 'high').length,
    details:  result.findings,
  });
}));

// POST /integrations/scan/text — scan pasted text
router.post('/scan/text', asyncHandler(async (req, res) => {
  const { content, filename } = ScanTextSchema.parse(req.body);
  const findings = scanText(content, filename);
  await persistFindings(req.user.orgId, findings);
  res.json({ findings: findings.length, details: findings });
}));

// GET /integrations/:type — single integration detail
router.get('/:type', asyncHandler(async (req, res) => {
  const { orgId } = req.user;
  const { rows } = await query(
    'SELECT * FROM integrations WHERE org_id = $1 AND type = $2',
    [orgId, req.params.type],
  );
  if (!rows.length) return res.status(404).json({ error: 'Integration not found' });

  const i = rows[0];
  const scored = scoreIntegration({
    type: i.type, scopes: i.scopes, usedScopes: i.used_scopes,
    lastRotated: i.last_rotated, secretsFound: 0,
  });
  const { rows: secrets } = await query(
    `SELECT id, secret_type, location, severity, remediated, discovered_at
     FROM secrets_found WHERE org_id = $1 AND secret_type ILIKE '%' || $2 || '%'
     ORDER BY discovered_at DESC LIMIT 10`,
    [orgId, i.type],
  );
  res.json({ data: { ...i, ...scored, recentSecrets: secrets } });
}));

// PATCH /integrations/:id/rotate — mark integration as rotated
router.patch('/:id/rotate', asyncHandler(async (req, res) => {
  const { orgId, userId } = req.user;
  const rotatedAt = req.body.rotatedAt ? new Date(req.body.rotatedAt) : new Date();

  const { rows } = await query(
    `UPDATE integrations SET last_rotated = $1, updated_at = NOW()
     WHERE id = $2 AND org_id = $3 RETURNING *`,
    [rotatedAt, req.params.id, orgId],
  );
  if (!rows.length) return res.status(404).json({ error: 'Integration not found' });

  await query(
    `INSERT INTO audit_log (org_id, user_id, action, resource_type, resource_id)
     VALUES ($1, $2, 'integration_rotated', 'integration', $3)`,
    [orgId, userId, req.params.id],
  );
  res.json({ data: rows[0] });
}));

// PATCH /integrations/secrets/:id/remediate
router.patch('/secrets/:id/remediate', asyncHandler(async (req, res) => {
  const { orgId, userId } = req.user;
  const { rows } = await query(
    `UPDATE secrets_found SET remediated = TRUE, remediated_at = NOW()
     WHERE id = $1 AND org_id = $2 RETURNING *`,
    [req.params.id, orgId],
  );
  if (!rows.length) return res.status(404).json({ error: 'Secret not found' });

  await query(
    `INSERT INTO audit_log (org_id, user_id, action, resource_type, resource_id)
     VALUES ($1, $2, 'secret_remediated', 'secret', $3)`,
    [orgId, userId, req.params.id],
  );
  res.json({ data: rows[0] });
}));

export default router;
