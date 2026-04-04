/**
 * VibeShield — GitHub Scanner Service
 *
 * Fetches commits/diffs from a GitHub repo and runs secret detection.
 * Uses the GitHub REST API with optional GitHub App authentication.
 */

const fetch = require('node-fetch');
const config = require('../config');
const { scanDiff, calculateRiskScore } = require('./secretScanner');
const logger = require('../utils/logger');

const GITHUB_API = 'https://api.github.com';

/**
 * Build auth headers for GitHub API requests.
 * Uses a personal access token (passed per-request) or falls back to no auth (rate-limited).
 */
function buildHeaders(accessToken) {
  return {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'VibeShield/1.0',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };
}

/**
 * Fetch the last N commits from a repo and scan their diffs.
 *
 * @param {object} opts
 * @param {string} opts.owner - GitHub owner (user or org)
 * @param {string} opts.repo - Repository name
 * @param {string} [opts.accessToken] - GitHub PAT or installation token
 * @param {number} [opts.limit=20] - Number of commits to scan
 * @param {string} [opts.branch='main'] - Branch to scan
 * @returns {Promise<ScanResult>}
 */
async function scanRepo({ owner, repo, accessToken, limit = 20, branch = 'main' }) {
  const headers = buildHeaders(accessToken);
  const repoFullName = `${owner}/${repo}`;

  logger.info('Starting GitHub repo scan', { repo: repoFullName, limit, branch });

  // 1. Fetch commits list
  const commitsUrl = `${GITHUB_API}/repos/${owner}/${repo}/commits?sha=${branch}&per_page=${limit}`;
  const commitsRes = await fetch(commitsUrl, { headers });

  if (!commitsRes.ok) {
    const body = await commitsRes.text();
    throw Object.assign(new Error(`GitHub API error: ${commitsRes.status} ${body}`), {
      status: commitsRes.status === 404 ? 404 : 502,
    });
  }

  const commits = await commitsRes.json();
  if (!Array.isArray(commits) || !commits.length) {
    return { findings: [], commitsScanned: 0, riskScore: 0 };
  }

  // 2. Fetch and scan diffs for each commit
  const allFindings = [];
  let commitsScanned = 0;

  for (const commit of commits) {
    try {
      const diffUrl = `${GITHUB_API}/repos/${owner}/${repo}/commits/${commit.sha}`;
      const diffRes = await fetch(diffUrl, {
        headers: { ...headers, Accept: 'application/vnd.github.v3.diff' },
      });

      if (!diffRes.ok) {
        logger.warn('Skipping commit (fetch failed)', { sha: commit.sha, status: diffRes.status });
        continue;
      }

      const diffText = await diffRes.text();
      const findings = scanDiff(diffText, repoFullName);

      for (const f of findings) {
        allFindings.push({
          ...f,
          commitSha: commit.sha,
          commitMessage: commit.commit?.message?.split('\n')[0] || '',
          commitAuthor: commit.commit?.author?.name || '',
          repoName: repoFullName,
        });
      }

      commitsScanned++;

      // Respect GitHub rate limits (60 req/hr unauth, 5000/hr auth)
      if (commitsScanned < commits.length) {
        await new Promise((r) => setTimeout(r, accessToken ? 100 : 1000));
      }
    } catch (err) {
      logger.warn('Error scanning commit', { sha: commit.sha, error: err.message });
    }
  }

  const riskScore = calculateRiskScore(allFindings);

  logger.info('GitHub scan complete', {
    repo: repoFullName,
    commitsScanned,
    findingsCount: allFindings.length,
    riskScore,
  });

  return { findings: allFindings, commitsScanned, riskScore };
}

/**
 * Scan a single file by path (useful for IaC files: main.tf, etc.)
 */
async function scanFile({ owner, repo, filePath, ref = 'HEAD', accessToken }) {
  const headers = buildHeaders(accessToken);
  const url = `${GITHUB_API}/repos/${owner}/${repo}/contents/${filePath}?ref=${ref}`;

  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw Object.assign(new Error(`GitHub file fetch failed: ${res.status}`), {
      status: res.status === 404 ? 404 : 502,
    });
  }

  const data = await res.json();
  if (data.encoding !== 'base64' || !data.content) {
    throw new Error('Unexpected file encoding from GitHub API');
  }

  const content = Buffer.from(data.content, 'base64').toString('utf8');
  const { scanContent, calculateRiskScore } = require('./secretScanner');
  const findings = scanContent(content, `${owner}/${repo}/${filePath}`);

  return {
    findings,
    riskScore: calculateRiskScore(findings),
    filePath,
    sha: data.sha,
  };
}

/**
 * List all repos accessible with the given token.
 */
async function listRepos(accessToken) {
  const headers = buildHeaders(accessToken);
  const res = await fetch(`${GITHUB_API}/user/repos?per_page=100&sort=updated`, { headers });
  if (!res.ok) throw new Error(`GitHub list repos failed: ${res.status}`);
  const repos = await res.json();
  return repos.map((r) => ({
    id: r.id,
    fullName: r.full_name,
    private: r.private,
    defaultBranch: r.default_branch,
    pushedAt: r.pushed_at,
  }));
}

module.exports = { scanRepo, scanFile, listRepos };
