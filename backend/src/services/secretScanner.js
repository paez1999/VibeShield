import crypto from 'crypto';

export const SECRET_PATTERNS = [
  { type: 'aws_access_key',        severity: 'critical', pattern: /(?:^|[^A-Z0-9])(AKIA[0-9A-Z]{16})(?:[^A-Z0-9]|$)/gm },
  { type: 'aws_secret_key',        severity: 'critical', pattern: /(?:aws_secret|AWS_SECRET)[_\s]*(?:access[_\s]*)?key[_\s]*[=:]\s*['"]?([A-Za-z0-9/+=]{40})['"]?/gim },
  { type: 'jwt_secret',            severity: 'critical', pattern: /(?:jwt[_\s]*secret|JWT_SECRET)\s*[=:]\s*['"]?([A-Za-z0-9_\-\.+/]{20,})['"]?/gim },
  { type: 'jwt_token',             severity: 'high',     pattern: /(eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})/gm },
  { type: 'spotify_client_secret', severity: 'high',     pattern: /(?:spotify[_\s]*(?:client[_\s]*)?secret)\s*[=:]\s*['"]?([A-Za-z0-9]{32})['"]?/gim },
  { type: 'spotify_token',         severity: 'high',     pattern: /(?:spotify[_\s]*(?:access[_\s]*)?token)\s*[=:]\s*['"]?(BQ[A-Za-z0-9_\-]{80,})['"]?/gim },
  { type: 'github_token',          severity: 'critical', pattern: /(gh[pousr]_[A-Za-z0-9_]{36,})/gm },
  { type: 'github_classic_token',  severity: 'critical', pattern: /(ghp_[A-Za-z0-9]{36})/gm },
  { type: 'stripe_secret_key',     severity: 'critical', pattern: /(sk_live_[A-Za-z0-9]{24,})/gm },
  { type: 'stripe_publishable',    severity: 'low',      pattern: /(pk_live_[A-Za-z0-9]{24,})/gm },
  { type: 'slack_token',           severity: 'high',     pattern: /(xox[baprs]-[A-Za-z0-9\-]{10,})/gm },
  { type: 'slack_webhook',         severity: 'high',     pattern: /(https:\/\/hooks\.slack\.com\/services\/T[A-Z0-9]+\/B[A-Z0-9]+\/[A-Za-z0-9]+)/gm },
  { type: 'sendgrid_api_key',      severity: 'high',     pattern: /(SG\.[A-Za-z0-9_\-]{22}\.[A-Za-z0-9_\-]{43})/gm },
  { type: 'private_key',           severity: 'critical', pattern: /(-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/gm },
  { type: 'generic_api_key',       severity: 'medium',   pattern: /(?:api[_\s]*key|apikey|api_secret)\s*[=:]\s*['"]?([A-Za-z0-9_\-]{20,64})['"]?/gim },
  { type: 'hardcoded_password',    severity: 'medium',   pattern: /(?:password|passwd|pwd)\s*[=:]\s*['"]([^'"]{8,})['"](?!\s*#\s*example)/gim },
];

const ALLOWLIST = [
  /example/i, /placeholder/i, /your[_-]?(?:api[_-]?)?key[_-]?here/i,
  /xxxx/i, /changeme/i, /\$\{[^}]+\}/, /process\.env\./, /os\.environ/, /getenv/i,
];

const isAllowlisted = (v) => ALLOWLIST.some((p) => p.test(v));
const hashSecret    = (v) => crypto.createHash('sha256').update(v).digest('hex');

export function scanText(content, location = 'unknown') {
  const findings = [];
  const seen = new Set();

  for (const { type, severity, pattern } of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const raw = match[1] ?? match[0];
      if (!raw || isAllowlisted(raw)) continue;
      const hash = hashSecret(raw);
      if (seen.has(hash)) continue;
      seen.add(hash);
      const line = content.slice(0, match.index).split('\n').length;
      findings.push({ type, severity, hash, location: `${location}:${line}` });
    }
  }
  return findings;
}

export function scanFiles(files) {
  return files.flatMap(({ path, content }) => scanText(content, path));
}

export async function scanGitHubRepo(repoFullName, ref = 'main') {
  if (!process.env.GITHUB_TOKEN) {
    throw Object.assign(new Error('GITHUB_TOKEN not configured'), { status: 503 });
  }

  const headers = {
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'VibeShield/1.0',
  };
  const base = 'https://api.github.com';

  // Resolve ref to SHA
  let sha;
  const refRes = await fetch(`${base}/repos/${repoFullName}/git/ref/heads/${ref}`, { headers });
  if (refRes.ok) {
    sha = (await refRes.json()).object.sha;
  } else {
    const repoRes = await fetch(`${base}/repos/${repoFullName}`, { headers });
    if (!repoRes.ok) throw Object.assign(new Error(`Repo not found: ${repoFullName}`), { status: 404 });
    const defaultBranch = (await repoRes.json()).default_branch;
    const branchRes = await fetch(`${base}/repos/${repoFullName}/git/ref/heads/${defaultBranch}`, { headers });
    sha = (await branchRes.json()).object.sha;
  }

  // Fetch file tree
  const treeRes = await fetch(`${base}/repos/${repoFullName}/git/trees/${sha}?recursive=1`, { headers });
  if (!treeRes.ok) throw new Error('Failed to fetch repository tree');
  const { tree } = await treeRes.json();

  const SKIP = /node_modules|\.git|dist\/|build\/|\.png$|\.jpg$|\.gif$|\.ico$|\.lock$/i;
  const toScan = tree
    .filter((f) => f.type === 'blob' && !SKIP.test(f.path) && (f.size ?? 0) <= 512 * 1024)
    .slice(0, 200);

  const findings = [];
  const scannedFiles = [];

  await Promise.all(toScan.map(async (file) => {
    try {
      const blobRes = await fetch(`${base}/repos/${repoFullName}/git/blobs/${file.sha}`, { headers });
      if (!blobRes.ok) return;
      const blob = await blobRes.json();
      const content = Buffer.from(blob.content, 'base64').toString('utf8');
      findings.push(...scanText(content, `${repoFullName}:${sha.slice(0, 7)}:${file.path}`));
      scannedFiles.push(file.path);
    } catch { /* skip undecodable files */ }
  }));

  return { repo: repoFullName, commit: sha.slice(0, 7), scannedFiles: scannedFiles.length, findings };
}
