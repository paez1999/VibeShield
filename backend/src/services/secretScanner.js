import crypto from 'crypto';

export const SECRET_PATTERNS = [
  { type: 'aws_access_key', severity: 'critical', pattern: /(?:^|[^A-Z0-9])(AKIA[0-9A-Z]{16})(?:[^A-Z0-9]|$)/gm },
  { type: 'aws_secret_key', severity: 'critical', pattern: /(?:aws_secret|AWS_SECRET)[_\s]*(?:access[_\s]*)?key[_\s]*[=:]\s*['"]?([A-Za-z0-9/+=]{40})['"]?/gim },
  { type: 'jwt_secret', severity: 'critical', pattern: /(?:jwt[_\s]*secret|JWT_SECRET)\s*[=:]\s*['"]?([A-Za-z0-9_\-\.+/]{20,})['"]?/gim },
  { type: 'jwt_token', severity: 'high', pattern: /(eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})/gm },
  { type: 'spotify_client_secret', severity: 'high', pattern: /(?:spotify[_\s]*(?:client[_\s]*)?secret)\s*[=:]\s*['"]?([A-Za-z0-9]{32})['"]?/gim },
  { type: 'spotify_token', severity: 'high', pattern: /(?:spotify[_\s]*(?:access[_\s]*)?token)\s*[=:]\s*['"]?(BQ[A-Za-z0-9_\-]{80,})['"]?/gim },
  { type: 'github_token', severity: 'critical', pattern: /(gh[pousr]_[A-Za-z0-9_]{36,})/gm },
  { type: 'github_classic_token', severity: 'critical', pattern: /(ghp_[A-Za-z0-9]{36})/gm },
  { type: 'stripe_secret_key', severity: 'critical', pattern: /(sk_live_[A-Za-z0-9]{24,})/gm },
  { type: 'stripe_publishable', severity: 'low', pattern: /(pk_live_[A-Za-z0-9]{24,})/gm },
  { type: 'slack_token', severity: 'high', pattern: /(xox[baprs]-[A-Za-z0-9\-]{10,})/gm },
  { type: 'slack_webhook', severity: 'high', pattern: /(https:\/\/hooks\.slack\.com\/services\/T[A-Z0-9]+\/B[A-Z0-9]+\/[A-Za-z0-9]+)/gm },
  { type: 'sendgrid_api_key', severity: 'high', pattern: /(SG\.[A-Za-z0-9_\-]{22}\.[A-Za-z0-9_\-]{43})/gm },
  { type: 'private_key', severity: 'critical', pattern: /(-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/gm },
  { type: 'generic_api_key', severity: 'medium', pattern: /(?:api[_\s]*key|apikey|api_secret)\s*[=:]\s*['"]?([A-Za-z0-9_\-]{20,64})['"]?/gim },
  { type: 'hardcoded_password', severity: 'medium', pattern: /(?:password|passwd|pwd)\s*[=:]\s*['"]([^'"]{8,})['"](?!\s*#\s*example)/gim },
];

const ALLOWLIST = [
  /example/i, /placeholder/i, /your[_-]?(?:api[_-]?)?key[_-]?here/i,
  /xxxx/i, /changeme/i, /\$\{[^}]+\}/, /process\.env\./, /os\.environ/, /getenv/i,
];

const isAllowlisted = (v) => ALLOWLIST.some((p) => p.test(v));
const hashSecret = (v) => crypto.createHash('sha256').update(v).digest('hex');

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

  // Step 1: fetch repo metadata (validates access + gets default branch)
  const repoRes = await fetch(`${base}/repos/${repoFullName}`, { headers });
  if (repoRes.status === 404) {
    throw Object.assign(
      new Error(`Repo not found: ${repoFullName}. Check the name and that your GITHUB_TOKEN has access.`),
      { status: 404 },
    );
  }
  if (repoRes.status === 401) {
    throw Object.assign(new Error('GitHub token is invalid or expired. Regenerate your GITHUB_TOKEN.'), { status: 401 });
  }
  if (repoRes.status === 403) {
    throw Object.assign(new Error('GitHub token lacks permission. Add the "repo" scope to your token.'), { status: 403 });
  }
  if (!repoRes.ok) {
    throw Object.assign(new Error(`GitHub API error: ${repoRes.status}`), { status: 502 });
  }

  const repoData = await repoRes.json();
  const defaultBranch = repoData.default_branch;

  // Step 2: try user-specified ref, auto-fallback to default branch
  const tryBranch = async (branch) => {
    const r = await fetch(`${base}/repos/${repoFullName}/git/ref/heads/${branch}`, { headers });
    if (r.ok) return (await r.json()).object.sha;
    return null;
  };

  let sha = await tryBranch(ref);
  if (!sha && ref !== defaultBranch) {
    sha = await tryBranch(defaultBranch);
  }
  if (!sha) {
    throw Object.assign(
      new Error(`Branch "${ref}" not found. The default branch is "${defaultBranch}" — try that instead.`),
      { status: 404 },
    );
  }

  // Step 3: fetch file tree
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