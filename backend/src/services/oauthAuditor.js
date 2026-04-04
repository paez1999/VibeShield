/**
 * VibeShield — OAuth Scope Auditor
 *
 * Audits integrations for overprivileged or unused OAuth scopes.
 * Risk scoring based on permission sensitivity.
 */

// ─── Scope Risk Definitions ───────────────────────────────────────────────────

const SCOPE_RISK = {
  // Spotify
  'user-read-email': { weight: 5, label: 'Read user email' },
  'user-read-private': { weight: 5, label: 'Read private profile' },
  'user-read-playback-state': { weight: 3, label: 'Read playback state' },
  'user-modify-playback-state': { weight: 10, label: 'Control playback' },
  'user-library-read': { weight: 5, label: 'Read saved tracks' },
  'user-library-modify': { weight: 15, label: 'Modify saved tracks' },
  'playlist-modify-public': { weight: 15, label: 'Modify public playlists' },
  'playlist-modify-private': { weight: 15, label: 'Modify private playlists' },
  'streaming': { weight: 20, label: 'Full streaming access' },

  // GitHub
  'repo': { weight: 40, label: 'Full repo access (read/write)' },
  'repo:status': { weight: 5, label: 'Commit status access' },
  'repo:read': { weight: 10, label: 'Read repo contents' },
  'admin:org': { weight: 50, label: 'Full org admin' },
  'admin:repo_hook': { weight: 20, label: 'Manage webhooks' },
  'delete_repo': { weight: 45, label: 'Delete repositories' },
  'read:org': { weight: 10, label: 'Read org membership' },
  'user:email': { weight: 5, label: 'Read user emails' },
  'workflow': { weight: 30, label: 'Manage GitHub Actions' },

  // AWS IAM (simplified policy actions)
  's3:*': { weight: 35, label: 'Full S3 access' },
  's3:GetObject': { weight: 10, label: 'Read S3 objects' },
  's3:PutObject': { weight: 15, label: 'Write S3 objects' },
  's3:DeleteObject': { weight: 25, label: 'Delete S3 objects' },
  'iam:*': { weight: 50, label: 'Full IAM admin' },
  'iam:PassRole': { weight: 35, label: 'Pass IAM roles' },
  'ec2:*': { weight: 40, label: 'Full EC2 access' },
  'lambda:*': { weight: 35, label: 'Full Lambda access' },
  'rds:*': { weight: 40, label: 'Full RDS access' },
  '*': { weight: 100, label: 'Full AWS access (AdministratorAccess)' },

  // YouTube
  'https://www.googleapis.com/auth/youtube': { weight: 40, label: 'Full YouTube account' },
  'https://www.googleapis.com/auth/youtube.readonly': { weight: 10, label: 'Read YouTube data' },
  'https://www.googleapis.com/auth/youtube.upload': { weight: 25, label: 'Upload videos' },

  // Stripe
  'charges:read': { weight: 10, label: 'Read charges' },
  'charges:write': { weight: 30, label: 'Create/modify charges' },
  'customers:read': { weight: 15, label: 'Read customer data' },
  'customers:write': { weight: 30, label: 'Modify customers' },
  'payouts:read': { weight: 10, label: 'Read payouts' },
};

const DEFAULT_SCOPE_WEIGHT = 15;

/**
 * Calculate risk score for an integration based on its scopes.
 *
 * @param {string[]} scopes - All OAuth scopes requested
 * @param {string[]} usedScopes - Scopes actually exercised in last 30 days
 * @returns {{ score: number, breakdown: object[], unusedHighRisk: string[] }}
 */
function auditScopes(scopes = [], usedScopes = []) {
  const usedSet = new Set(usedScopes);
  const breakdown = [];
  let totalWeight = 0;

  for (const scope of scopes) {
    const risk = SCOPE_RISK[scope] || { weight: DEFAULT_SCOPE_WEIGHT, label: scope };
    const isUsed = usedSet.has(scope);
    const effectiveWeight = isUsed ? risk.weight : risk.weight * 1.5; // Unused scopes = higher risk

    breakdown.push({
      scope,
      label: risk.label,
      baseWeight: risk.weight,
      effectiveWeight: Math.round(effectiveWeight),
      used: isUsed,
      recommendation: !isUsed && risk.weight >= 10 ? 'Remove — not in use' : null,
    });

    totalWeight += effectiveWeight;
  }

  const score = Math.min(100, Math.round(totalWeight));
  const unusedHighRisk = breakdown
    .filter((s) => !s.used && s.baseWeight >= 20)
    .map((s) => s.scope);

  return { score, breakdown, unusedHighRisk };
}

/**
 * Get human-readable severity label for a risk score.
 */
function scoreSeverity(score) {
  if (score >= 70) return 'critical';
  if (score >= 40) return 'high';
  if (score >= 20) return 'medium';
  return 'low';
}

/**
 * Generate actionable recommendations for an integration.
 */
function getRecommendations(integrationType, scopes, usedScopes) {
  const { breakdown, unusedHighRisk } = auditScopes(scopes, usedScopes);
  const recs = [];

  if (unusedHighRisk.length) {
    recs.push({
      priority: 'high',
      action: 'Remove unused high-risk scopes',
      scopes: unusedHighRisk,
      detail: `These scopes haven't been used but grant significant access. Revoke them immediately.`,
    });
  }

  const writeScopes = breakdown.filter((s) => /write|modify|delete|admin|\*/i.test(s.scope));
  if (writeScopes.length > 0) {
    recs.push({
      priority: 'medium',
      action: 'Review write permissions',
      scopes: writeScopes.map((s) => s.scope),
      detail: 'Write scopes should be used sparingly. Confirm each is strictly required.',
    });
  }

  if (scopes.some((s) => s === '*' || s === 'iam:*' || s === 'admin:org')) {
    recs.push({
      priority: 'critical',
      action: 'Replace wildcard permissions with least-privilege',
      scopes: scopes.filter((s) => s === '*' || s.endsWith(':*')),
      detail: 'Wildcard permissions violate least-privilege. Enumerate only what your app needs.',
    });
  }

  return recs;
}

module.exports = { auditScopes, scoreSeverity, getRecommendations, SCOPE_RISK };
