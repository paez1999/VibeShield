# VibeShield — Handoff

**Date:** 2026-04-06

---

## Project

Security scanning SaaS dashboard. Scans GitHub repos, APIs, dependencies, and pasted code for vulns (SQL injection, XSS, secrets, weak crypto, etc.). Stores findings in Firestore. React+Vite frontend, Node+Express backend, Firebase/Firestore, Docker Compose.

**Rules:** JSX only (no TS), inline styles, ES modules, `@octokit/rest` for GitHub API, install npm packages via `docker compose exec api npm install <pkg>`.

---

## Stack

- **Frontend:** React + Vite (`frontend/`), React Router v6, inline styles
- **Backend:** Node.js + Express (`backend/`), ES modules, Firebase Admin + Firestore, Zod validation
- **Auth:** Firebase Auth (ID token → `authenticate` middleware)
- **GitHub API:** `@octokit/rest` + native `fetch` for tarball downloads
- **No TypeScript anywhere**

---

## Session 1 completions (earlier sessions)

- POST `/api/vulns/bulk` — resolve/ignore multiple vulns, batched Firestore writes (`vulns.js`)
- `services/notifyService.js` — `notifySlack(findings, context)`, no-ops if `SLACK_WEBHOOK_URL` unset, only fires on critical/high

---

## Session 2 completions (this session)

### Backend

1. **`notifySlack` wired into scans** (`backend/src/routes/scan.js`)
   - Called after `completeScan` for `/code`, `/api`, `/deps` routes
   - `.catch(() => {})` so it never breaks a scan response

2. **`notifySlack` wired into webhooks** (`backend/src/routes/webhooks.js`)
   - Called after `scanRef.update()` in `triggerScan`

3. **`/health` endpoint** (`backend/src/index.js`)
   - Now returns `slackWebhook: !!process.env.SLACK_WEBHOOK_URL` in addition to `githubToken`

4. **Scalability fix — tarball fetching** (`backend/src/services/githubClient.js`)
   - Added `fetchRepoFiles(owner, repoName, sha, opts)` — downloads the repo as a single `.tar.gz` (1 API call) instead of `getTree` + `getBlob×N` (up to 151 calls)
   - Uses `tar.list()` file-based API (tar v7 Minipass streams are incompatible with Node.js stream `pipeline`; streaming approach stalls — use file-based API only)
   - Buffers response → writes to temp file in `/tmp/vs-*.tar.gz` → parses → deletes in `finally`
   - `tar` package v7.5.13 installed: `docker compose exec api npm install tar`
   - **API call reduction:** code scan ~154 → 4 calls; webhook scan ~151 → 1 call; ~1250 scans/hr possible vs ~32 before

5. **`scan.js` updated** — replaced `getTree` + `Promise.all(getBlob×N)` with `fetchRepoFiles`
   - Added `FETCH` constant (union of `RELEVANT` + `SECRET_RELEVANT`) as the tarball filter
   - `scannedFiles` count now comes from `fileContents.length`

6. **`webhooks.js` updated** — replaced `createOctokit` + `getTree` + `getBlob×N` with `fetchRepoFiles`
   - `createOctokit` import removed from webhooks (sha comes from push event, no Octokit needed)

### Frontend

7. **`SettingsPage.jsx`** — Notifications panel now shows Slack status dot (reads `slackWebhook` from `/health`)

8. **`DashboardPage.jsx`** — `load()` now calls `scansApi.history()` in parallel with `vulnsApi.list()`; added 5th MetricCard "Scans run"

9. **`ScanHistoryPage.jsx`** — New page created at `frontend/src/pages/ScanHistoryPage.jsx`
   - Lists scans with: type badge (colored), target, findings count, status dot, timestamp, duration

10. **`App.jsx`** — Added `<Route path="history" element={<ScanHistoryPage />} />`

11. **`Sidebar.jsx`** — Added "Scan history" link under OVERVIEW nav section

12. **`api.js`** — Added `vulnsApi.bulk(ids, action)` → `POST /api/vulns/bulk`

13. **`VulnsPage.jsx`** — Added checkboxes on each row + "Select all" in panel header + bulk action bar (Resolve all / Ignore all) that appears when items are selected

---

## File map (key files)

```
backend/
├── src/
│   ├── index.js                   — Express app, /health endpoint
│   ├── routes/
│   │   ├── scan.js                — /api/scan/* (code, text, api, deps, history)
│   │   ├── vulns.js               — /api/vulns/* (list, resolve, ignore, bulk)
│   │   ├── webhooks.js            — /api/webhooks/* + /webhook/github receiver
│   │   └── endpoints.js           — /api/endpoints/*
│   ├── services/
│   │   ├── githubClient.js        — createOctokit, parseRepo, fetchRepoFiles
│   │   ├── notifyService.js       — notifySlack(findings, context)
│   │   ├── codeScanner.js         — regex-based code scanner
│   │   ├── secretScanner.js       — secret/credential scanner
│   │   └── semgrepScanner.js      — Semgrep integration
│   └── middleware/
│       ├── auth.js                — Firebase token → req.user { uid, orgId }
│       └── errorHandler.js        — asyncHandler + global error handler
frontend/
├── src/
│   ├── App.jsx                    — Routes
│   ├── lib/api.js                 — vulnsApi, scansApi, endpointsApi, webhooksApi
│   ├── components/
│   │   ├── layout/Sidebar.jsx     — Nav links
│   │   └── ui/index.jsx           — Panel, MetricCard, Badge, Btn, Spinner, etc.
│   └── pages/
│       ├── DashboardPage.jsx      — Overview + quick scan + MetricCards
│       ├── VulnsPage.jsx          — Vuln list + bulk actions + checkboxes
│       ├── ScanPage.jsx           — Scanner UIs (code/api/deps)
│       ├── ScanHistoryPage.jsx    — Scan history list (NEW)
│       ├── SettingsPage.jsx       — Settings + GitHub/Slack status
│       ├── WebhooksPage.jsx       — Webhook management
│       └── EndpointsPage.jsx      — Endpoint results
```

---

## Firestore collections

- `organizations/{uid}` — org doc
- `users/{uid}` — user doc
- `vulnerabilities/{id}` — findings (orgId, scanId, status, severity, title, etc.)
- `scans/{id}` — scan records (orgId, type, meta, status, findings, startedAt, completedAt)
- `endpoints/{id}` — probed endpoint results
- `webhooks/{id}` — webhook configs (orgId, repo, secret, active)

---

## Env vars

```
GITHUB_TOKEN=          # optional, unauthenticated fallback for public repos (60 req/hr)
SLACK_WEBHOOK_URL=     # optional, Slack notifications on critical/high findings
CORS_ORIGIN=http://localhost:5173
PORT=3000
```

---

## Known issues / next steps

- **Scan caching by SHA** — if two users scan the same repo+SHA, GitHub is hit twice. Could cache `scans` where `meta.repo+meta.ref` already has a `complete` scan for the org, and skip re-fetching from GitHub. Medium effort, high value.
- **Rate limiting per org** — currently one org could burn all 5000 req/hr. Consider per-org request queue / limit.
- **Sidebar badge counts** — hardcoded `badge:26` and `badge:8` in `Sidebar.jsx`. Should be dynamic from live data.
- **Settings save** — "Save settings" button in SettingsPage currently only sets local state (no persistence). Fields like default GitHub repo / API URL could be stored in Firestore org doc.
- **Dep scan coverage** — `KNOWN_VULNS` in `scan.js` is a small hardcoded list. Could integrate `npm audit` or OSV API for real CVE data.
- **Semgrep** — `semgrepScanner.js` may no-op if Semgrep binary not in container. Scan still works via regex fallback.

---

## Install notes

```bash
# Install new npm packages inside container (not on host):
docker compose exec api npm install <pkg>

# tar was installed this session:
# "tar": "^7.5.13" in backend/package.json
```
