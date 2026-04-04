const DANGEROUS_SCOPES = {
  '*': 50, 'iam:*': 40, 'delete_repo': 40,
  'iam:CreateUser': 30, 'iam:AttachPolicy': 30, 'write:org': 30, 'admin:org': 35,
  's3:*': 25, 'ec2:*': 20, 'lambda:*': 20, 'admin:repo_hook': 20, 'delete': 20,
  'repo': 20, 'admin': 30, 'read_write': 15, 'write': 10,
  'user-modify-playback-state': 10, 'playlist-modify-private': 10, 'user-read-private': 5,
};

export function scoreIntegration({ type, scopes, usedScopes, lastRotated, secretsFound = 0 }) {
  let score = 0;
  const factors = [];

  // Dangerous scopes
  for (const scope of scopes) {
    const penalty = DANGEROUS_SCOPES[scope] ?? 0;
    if (penalty > 0) {
      score += penalty;
      factors.push({ label: `Dangerous scope: ${scope}`, penalty });
    }
  }

  // Unused scopes
  const unusedScopes = scopes.filter((s) => !usedScopes.includes(s));
  if (unusedScopes.length > 0) {
    const penalty = Math.min(unusedScopes.length * 5, 25);
    score += penalty;
    factors.push({ label: `${unusedScopes.length} unused scope(s)`, penalty });
  }

  // Rotation age
  if (!lastRotated) {
    score += 20;
    factors.push({ label: 'Never rotated', penalty: 20 });
  } else {
    const days = (Date.now() - new Date(lastRotated).getTime()) / 86_400_000;
    if (days > 365) { score += 20; factors.push({ label: `Not rotated in ${Math.floor(days)}d`, penalty: 20 }); }
    else if (days > 90) { score += 10; factors.push({ label: `Not rotated in ${Math.floor(days)}d`, penalty: 10 }); }
  }

  // Unresolved secrets
  if (secretsFound > 0) {
    const penalty = Math.min(secretsFound * 15, 40);
    score += penalty;
    factors.push({ label: `${secretsFound} unresolved secret(s)`, penalty });
  }

  const finalScore = Math.min(score, 100);
  const severity = finalScore >= 70 ? 'critical' : finalScore >= 40 ? 'high' : finalScore >= 20 ? 'medium' : 'low';
  return { score: finalScore, severity, factors, unusedScopes };
}

export function scoreAll(integrations) {
  return integrations
    .map((i) => ({ ...i, ...scoreIntegration(i) }))
    .sort((a, b) => b.score - a.score);
}
