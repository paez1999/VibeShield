# VibeShield — Architecture Design Spec

**Date:** 2026-04-05
**Status:** Approved
**Authors:** Daniel + Claude

---

## 1. Product Overview

VibeShield is a full security suite for vibe-coded applications — apps built rapidly with AI assistants (Cursor, Bolt, Replit, v0) where developers ship without deeply reviewing the generated code.

**Value proposition:** "You vibe-coded your app. We tell you what's broken before it gets exploited."

**Target users:** Solo developers, indie hackers, small teams shipping AI-generated code without a dedicated security person.

**Competitive positioning:** Lovable has built-in security features. Everyone else (Bolt, Replit, Cursor, v0) has nothing. VibeShield is the platform-agnostic security layer for the rest.

---

## 2. Business Model

- **Free scan (no signup):** Paste a GitHub repo URL, get a security score (A-F) and vulnerability count. Details are gated.
- **Free trial (post-signup):** 3 full scans with complete findings, AI analysis, and fix prompts.
- **Paid plan:** Unlimited scans, AI-powered analysis, fix prompts, continuous monitoring (Phase 2).
- **Score as hook:** The free score creates urgency ("D rating, 14 critical vulnerabilities"). The paywall is on actionable information.

---

## 3. Technology Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| **Frontend** | Next.js on Vercel | SSR for public scan page (SEO, link previews). React for dashboard. Free tier covers 1,000+ users. |
| **Auth** | Supabase Auth | Native RLS integration with Postgres. GitHub OAuth built in. No token translation layer needed. |
| **Database** | Supabase Postgres | Relational data, aggregations for dashboard, billing queries, RLS for multi-tenant isolation. |
| **Realtime** | Supabase Realtime | Scan progress pushed to frontend via Postgres change listeners. Polling fallback for reliability. |
| **Storage** | Supabase Storage | Scan reports, uploaded files. |
| **Scan Worker** | Firebase Cloud Functions v2 (TypeScript) | Long-running jobs up to 60 min. Scales to zero. Free tier covers 1,000+ users. ~$0/mo at launch. |
| **AI** | Claude API (Anthropic) | Deep code analysis, risk explanation, fix prompt generation. Called from Cloud Functions. |
| **Payments** | Stripe | Free trial tracking, subscription management. |
| **GitHub Integration** | GitHub App (Phase 2) | OAuth + installation tokens for private repo access. Webhooks for scan-on-push. |

### Cost Profile

| Stage | Monthly cost |
|-------|-------------|
| Launch (0 users) | ~$0 (all free tiers) |
| 1,000 users | ~$30-50 (mostly AI API costs, gated behind paid plans) |
| 50,000 users | ~$300-650 (AI costs scale with revenue) |

---

## 4. Product Roadmap

### Phase 1: MVP — "Paste and Scan"

**Goal:** User pastes a GitHub repo URL, gets a security score, sees vulnerability details behind a paywall.

**Features:**

- Public scan landing page (no signup): paste repo URL, get score (A-F) + summary
- Detailed findings gated behind signup
- Auth: sign up / log in with GitHub (Supabase Auth)
- Org creation on first login
- Free trial: 3 full scans with complete results
- Dashboard: vulnerability list, severity breakdown, scan history, security score
- Resolve / ignore actions on individual vulns
- Scanning engine:
  - Regex code scanner (30+ patterns, framework-aware for JS/TS and Python)
  - Secret scanner (40+ credential patterns)
  - Dependency scanner (OSV.dev API for real CVE data)
  - API scanner (probe deployed URLs for missing headers, HTTPS, misconfigs)
- AI layer (paid only):
  - Batched AI risk analysis per scan
  - Plain English vulnerability explanations
  - Fix prompts for vibe-coding tools (Cursor, Bolt, etc.)
- Retest button on every vulnerability
- Stripe integration: free trial (3 scans) then paid
- Target stacks: React + Express + Supabase/Firebase, React + Next.js + Prisma/Supabase

**Not in MVP:** GitHub App, private repos, team features, CLI, CI/CD integration.

### Phase 2: "Connect and Monitor"

- GitHub App integration (install on account/org, scan on every push)
- Private repo support via installation tokens
- Continuous monitoring dashboard (score trending, new vs resolved vulns)
- Framework-aware scanning (Next.js, Express, Supabase, React-specific checks)
- Re-scan diffing: before vs after comparison, "Fixed" badges, score history

### Phase 3: "Team and Scale"

- Team management (invite members, roles: admin/developer/viewer)
- Vulnerability assignment to team members
- Notifications (email alerts, Slack integration, weekly digest)
- CI/CD integration (GitHub Action: block merge on critical vulns)
- Exportable PDF/HTML security reports
- "Secured by VibeShield" badge

### Phase 4: "Platform"

- CLI tool: `npx vibeshield scan` (runs locally, sends only findings)
- Platform plugins (Bolt, Lovable, Replit, VS Code extension)
- AI auto-generated fix PRs
- Benchmark: "Your app is safer than 73% of vibe-coded projects"
- Infrastructure scanning (Dockerfile, Terraform, cloud configs)
- Runtime monitoring (detect attacks in production)

---

## 5. Backend Architecture

### 5.1 Design Principles

- **Clean Architecture:** Dependencies point inward. Domain layer has zero external dependencies.
- **SOLID throughout:** Single responsibility per class, open/closed for scan checks, dependency inversion via ports/adapters.
- **Domain isolation:** Business logic (scanning, scoring, billing) is pure TypeScript with no framework or database coupling.
- **Thin entry points:** Cloud Functions and API routes are wiring only — they construct dependencies and delegate to domain services.

### 5.2 Project Structure

```
src/
├── domain/                 # Pure business logic. No frameworks, no DB, no HTTP.
│   ├── entities/           # Data types and validation
│   │   ├── vulnerability.ts
│   │   ├── scan.ts
│   │   ├── org.ts
│   │   └── plan.ts
│   ├── services/           # Business logic orchestration
│   │   ├── scanOrchestrator.ts
│   │   ├── codeScanner.ts      # Pure regex engine
│   │   ├── secretScanner.ts    # Pure credential detection
│   │   ├── scoreCalculator.ts  # Security score computation
│   │   └── checks/             # Scan check definitions (grouped by language/framework)
│   │       ├── universal.ts
│   │       ├── javascript.ts
│   │       ├── python.ts
│   │       ├── nextjs.ts
│   │       ├── express.ts
│   │       └── supabase.ts
│   └── ports/              # Interfaces that adapters implement
│       ├── codeRepository.ts
│       ├── scanStore.ts
│       ├── vulnStore.ts
│       ├── aiAnalyzer.ts
│       ├── billingService.ts
│       └── notifications.ts
│
├── adapters/               # External I/O implementations
│   ├── github/
│   │   └── githubCodeRepository.ts
│   ├── ai/
│   │   └── claudeAiAnalyzer.ts
│   ├── db/
│   │   ├── supabaseScanStore.ts
│   │   ├── supabaseVulnStore.ts
│   │   └── supabaseOrgStore.ts
│   ├── payments/
│   │   └── stripeBillingService.ts
│   └── notifications/
│       └── emailNotifier.ts
│
├── functions/              # Firebase Cloud Function entry points (thin)
│   ├── scanCode.ts
│   ├── scanApi.ts
│   ├── scanDeps.ts
│   └── scanText.ts
│
├── api/                    # Next.js API routes (thin) — server-side, runs on Vercel
│   ├── vulns/              # CRUD: list, resolve, ignore
│   ├── scans/              # Trigger scan (enqueues Cloud Function), get status
│   ├── orgs/               # Org settings, members
│   └── billing/            # Stripe webhooks, plan info, usage
│
└── shared/                 # Cross-cutting concerns
    ├── errors.ts           # Domain error hierarchy
    ├── logger.ts           # Structured logging
    ├── config.ts           # Environment configuration
    └── semaphore.ts        # Concurrency control utility
```

### 5.3 Domain Entities

```typescript
// domain/entities/vulnerability.ts
type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info'
type VulnStatus = 'open' | 'resolved' | 'ignored' | 'auto_resolved'

interface Vulnerability {
  id: string
  orgId: string
  scanId: string
  checkId: string
  locationHash: string        // hash(file_path + line_number) — dedup key
  title: string
  description: string
  category: string
  severity: Severity
  status: VulnStatus
  location: string            // file:line
  codeSnippet: string | null
  fixPrompt: string | null    // AI-generated prompt for vibe-coding tool
  aiExplanation: string | null
  source: string
  firstSeenAt: Date
  resolvedAt: Date | null
}

// domain/entities/scan.ts
type ScanType = 'code' | 'api' | 'text' | 'deps'
type ScanStatus = 'queued' | 'fetching' | 'scanning' | 'analyzing' | 'complete' | 'failed'

interface Scan {
  id: string
  orgId: string
  userId: string
  repo: string | null
  ref: string | null
  type: ScanType
  status: ScanStatus
  progress: { total: number; scanned: number; findings: number }
  treeSha: string | null      // for diff-based re-scanning
  score: string | null        // A-F
  summary: SeveritySummary | null
  durationMs: number | null
  createdAt: Date
  completedAt: Date | null
}

interface SeveritySummary {
  critical: number
  high: number
  medium: number
  low: number
  info: number
}

// domain/entities/org.ts
interface Org {
  id: string
  name: string
  plan: PlanType
  trialScansRemaining: number
  stripeCustomerId: string | null
  createdAt: Date
}

type PlanType = 'trial' | 'free' | 'pro' | 'team'
```

### 5.4 Domain Ports (Interfaces)

```typescript
// domain/ports/codeRepository.ts
interface CodeRepository {
  resolveRef(repo: string, ref: string): Promise<string | null>
  fetchTree(repo: string, sha: string): Promise<FileEntry[]>
  fetchFileContent(repo: string, sha: string): Promise<string>
}

interface FileEntry {
  path: string
  sha: string
  size: number
  type: 'blob' | 'tree'
}

// domain/ports/scanStore.ts
interface ScanStore {
  create(scan: Omit<Scan, 'id'>): Promise<string>
  updateStatus(id: string, status: ScanStatus, progress?: Partial<Scan>): Promise<void>
  complete(id: string, score: string, summary: SeveritySummary, durationMs: number): Promise<void>
  fail(id: string, error: string): Promise<void>
  getById(id: string): Promise<Scan | null>
  listByOrg(orgId: string, opts: PaginationOpts): Promise<Paginated<Scan>>
  countByOrgSince(orgId: string, since: Date): Promise<number>
}

// domain/ports/vulnStore.ts
interface VulnStore {
  upsertMany(vulns: NewVulnerability[]): Promise<number>
  listByOrg(orgId: string, filters: VulnFilters, opts: PaginationOpts): Promise<Paginated<Vulnerability>>
  summaryByOrg(orgId: string): Promise<SeveritySummary>
  resolve(id: string, userId: string): Promise<void>
  ignore(id: string, userId: string): Promise<void>
  autoResolveStale(orgId: string, scanId: string, currentLocationHashes: string[]): Promise<number>
}

// domain/ports/aiAnalyzer.ts
interface AiAnalyzer {
  analyzeBatch(findings: Finding[], context: ScanContext): Promise<AiEnrichment[]>
}

interface AiEnrichment {
  checkId: string
  locationHash: string
  explanation: string
  fixPrompt: string
}

// domain/ports/billingService.ts
interface BillingService {
  canScan(orgId: string): Promise<{ allowed: boolean; reason?: string }>
  recordScan(orgId: string): Promise<void>
  getPlan(orgId: string): Promise<Plan>
}
```

### 5.5 Domain Services

#### ScanOrchestrator — Core Pipeline

The orchestrator coordinates the full scan lifecycle. It depends only on ports (interfaces), never on concrete implementations.

```typescript
class ScanOrchestrator {
  constructor(
    private codeRepo: CodeRepository,
    private scanner: typeof scanCode,
    private secretScanner: typeof scanSecrets,
    private aiAnalyzer: AiAnalyzer,
    private scanStore: ScanStore,
    private vulnStore: VulnStore,
    private billing: BillingService,
  ) {}

  async runCodeScan(orgId: string, userId: string, repo: string, ref: string): Promise<string> {
    // 1. Check billing limits
    const access = await this.billing.canScan(orgId)
    if (!access.allowed) throw new ScanLimitError(access.reason)

    // 2. Create scan record (triggers realtime update to frontend)
    const scanId = await this.scanStore.create({ orgId, userId, repo, ref, type: 'code', status: 'queued', ... })

    // 3. Execute pipeline
    try {
      await this.executePipeline(scanId, orgId, userId, repo, ref)
    } catch (err) {
      await this.scanStore.fail(scanId, err.message)
      throw err
    }

    return scanId
  }

  private async executePipeline(scanId, orgId, userId, repo, ref) {
    const start = Date.now()

    // FETCH: Resolve branch and get file tree
    await this.scanStore.updateStatus(scanId, 'fetching')
    const sha = await this.codeRepo.resolveRef(repo, ref)
    if (!sha) throw new BranchNotFoundError(ref)
    const tree = await this.codeRepo.fetchTree(repo, sha)
    const scannable = filterScannable(tree)

    // SCAN: Fetch file contents and run scanners
    await this.scanStore.updateStatus(scanId, 'scanning', { progress: { total: scannable.length, scanned: 0, findings: 0 } })
    const findings = []
    for (const batch of chunk(scannable, 10)) {
      const contents = await Promise.all(batch.map(f => this.codeRepo.fetchFileContent(repo, f.sha)))
      for (let i = 0; i < batch.length; i++) {
        const codeFindings = this.scanner(contents[i], batch[i].path)
        const secretFindings = this.secretScanner(contents[i], batch[i].path)
        findings.push(...codeFindings, ...secretFindings.map(toVulnFormat))
      }
      await this.scanStore.updateStatus(scanId, 'scanning', { progress: { total: scannable.length, scanned: findings.length, findings: findings.length } })
    }

    // STORE: Upsert findings, auto-resolve stale ones
    const locationHashes = findings.map(f => f.locationHash)
    await this.vulnStore.upsertMany(findings.map(f => ({ ...f, orgId, scanId })))
    await this.vulnStore.autoResolveStale(orgId, scanId, locationHashes)

    // AI ENRICHMENT: Only for paid plans, only critical/high severity
    await this.scanStore.updateStatus(scanId, 'analyzing')
    const plan = await this.billing.getPlan(orgId)
    if (plan.includesAi) {
      const toAnalyze = findings.filter(f => f.severity === 'critical' || f.severity === 'high')
      if (toAnalyze.length > 0) {
        const enrichments = await this.aiAnalyzer.analyzeBatch(toAnalyze, { repo, ref })
        // Update vulns with AI explanations and fix prompts
      }
    }

    // COMPLETE: Calculate score and finalize
    const summary = await this.vulnStore.summaryByOrg(orgId)
    const score = calculateScore(summary)
    await this.scanStore.complete(scanId, score, summary, Date.now() - start)
    await this.billing.recordScan(orgId)
  }
}
```

#### CodeScanner — Pure Regex Engine

Pure function. No I/O, no side effects. Takes content and file path, returns findings.

Checks are grouped by language/framework. Adding a new check = adding to an array. No existing code changes (Open/Closed Principle).

```typescript
// domain/services/checks/ — one file per language/framework
// universal.ts   → SQL injection, command injection, SSRF, hardcoded secrets, weak crypto
// javascript.ts  → XSS (document.write, innerHTML), prototype pollution, eval()
// python.ts      → pickle deserialization, subprocess shell=True, yaml.load()
// nextjs.ts      → SSR data exposure, middleware bypass, API route auth
// express.ts     → missing helmet, unvalidated params, CORS misconfiguration
// supabase.ts    → open RLS, exposed service key, anon key misuse
```

#### ScoreCalculator — Security Score

```typescript
function calculateScore(summary: SeveritySummary): string {
  const weighted = summary.critical * 10 + summary.high * 5 + summary.medium * 2 + summary.low * 0.5
  if (weighted === 0) return 'A'
  if (weighted <= 5) return 'B'
  if (weighted <= 15) return 'C'
  if (weighted <= 30) return 'D'
  return 'F'
}
```

### 5.6 Adapter Implementations

#### GitHubCodeRepository

- Concurrency-limited fetching (semaphore, max 10 parallel requests)
- SHA-based caching (git blobs are immutable — fetch once, cache forever)
- 10-second timeout on all requests
- Explicit error types for 404 (repo not found), 403 (no access), 429 (rate limit)

#### ClaudeAiAnalyzer

- Batched: all findings from a scan sent in a single API call
- Structured output: JSON response with explanation + fix prompt per finding
- Pattern-level caching: same `check_id` explanation is reused across files
- Tiered: only critical/high findings sent to AI (medium/low get regex explanation only)

#### SupabaseVulnStore / SupabaseScanStore

- Upsert with `ON CONFLICT (org_id, check_id, location_hash)` for deduplication
- Bulk insert for findings (single round trip)
- Postgres functions for aggregation (vuln_summary_by_org)
- RLS policies enforce org isolation at the database level

#### StripeBillingService

- `canScan()`: checks trial scans remaining or active subscription status
- `recordScan()`: decrements trial counter or logs usage
- Webhook handler for subscription lifecycle events

### 5.7 Error Handling

Domain errors are transport-agnostic:

```typescript
class DomainError extends Error { abstract code: string }
class ScanLimitError extends DomainError { code = 'SCAN_LIMIT_REACHED' }
class BranchNotFoundError extends DomainError { code = 'BRANCH_NOT_FOUND' }
class RepoNotFoundError extends DomainError { code = 'REPO_NOT_FOUND' }
class RateLimitError extends DomainError { code = 'RATE_LIMITED' }
class AccessDeniedError extends DomainError { code = 'ACCESS_DENIED' }
```

Entry points (Cloud Functions, API routes) translate domain errors to HTTP/function errors. Domain never knows about HTTP status codes.

---

## 6. Database Schema

```sql
-- Organizations
CREATE TABLE orgs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  plan text NOT NULL DEFAULT 'trial',  -- trial, free, pro, team
  trial_scans_remaining int NOT NULL DEFAULT 3,
  stripe_customer_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- User-org membership
CREATE TABLE org_members (
  user_id uuid REFERENCES auth.users(id),
  org_id uuid REFERENCES orgs(id),
  role text NOT NULL DEFAULT 'admin',  -- admin, developer, viewer
  PRIMARY KEY (user_id, org_id)
);

-- Scans
CREATE TABLE scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  repo text,
  ref text,
  type text NOT NULL,               -- code, api, text, deps
  status text NOT NULL DEFAULT 'queued',
  progress jsonb DEFAULT '{"total":0,"scanned":0,"findings":0}',
  tree_sha text,
  score char(1),
  summary jsonb,
  duration_ms int,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

-- Vulnerabilities (deduplicated)
CREATE TABLE vulnerabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  scan_id uuid NOT NULL REFERENCES scans(id),
  check_id text NOT NULL,
  location_hash text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  severity text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  location text,
  code_snippet text,
  fix_prompt text,
  ai_explanation text,
  source text NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id),
  UNIQUE (org_id, check_id, location_hash)
);

-- Indexes for dashboard performance
CREATE INDEX idx_vulns_org_status ON vulnerabilities(org_id, status);
CREATE INDEX idx_vulns_org_severity ON vulnerabilities(org_id, severity);
CREATE INDEX idx_vulns_org_created ON vulnerabilities(org_id, first_seen_at);
CREATE INDEX idx_scans_org_created ON scans(org_id, created_at);
CREATE INDEX idx_scans_org_type ON scans(org_id, type);

-- Postgres function for aggregated summary
CREATE OR REPLACE FUNCTION vuln_summary_by_org(p_org_id uuid)
RETURNS jsonb AS $$
  SELECT jsonb_build_object(
    'critical', COUNT(*) FILTER (WHERE severity = 'critical' AND status = 'open'),
    'high',     COUNT(*) FILTER (WHERE severity = 'high' AND status = 'open'),
    'medium',   COUNT(*) FILTER (WHERE severity = 'medium' AND status = 'open'),
    'low',      COUNT(*) FILTER (WHERE severity = 'low' AND status = 'open'),
    'info',     COUNT(*) FILTER (WHERE severity = 'info' AND status = 'open')
  )
  FROM vulnerabilities
  WHERE org_id = p_org_id;
$$ LANGUAGE sql STABLE;
```

### Row-Level Security

```sql
-- Users can only access their own org's data
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE vulnerabilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON scans
  FOR ALL USING (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );

CREATE POLICY "org_isolation" ON vulnerabilities
  FOR ALL USING (
    org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())
  );
```

---

## 7. Performance Targets

| Operation | Target | Strategy |
|-----------|--------|----------|
| Dashboard load | <500ms | Indexed queries, pre-computed summary in scans table |
| Regex scan (100 files) | <10s | Pre-filtered patterns by file type, concurrency-limited fetching |
| AI enrichment | <30s | Batched single API call, cached pattern explanations |
| Re-scan (5 changed files) | <3s | Tree SHA diffing, only scan changed files |
| Score calculation | <100ms | Pre-computed in scans.summary |
| Public scan (free, no auth) | <15s | Regex only (no AI), no auth overhead |

---

## 8. Supabase Setup

### 8.1 Project Structure

```
supabase/
├── migrations/
│   ├── 00001_create_orgs.sql
│   ├── 00002_create_org_members.sql
│   ├── 00003_create_scans.sql
│   ├── 00004_create_vulnerabilities.sql
│   ├── 00005_create_indexes.sql
│   ├── 00006_create_functions.sql
│   └── 00007_create_rls_policies.sql
├── seed.sql                # Dev seed data
└── config.toml             # Local dev config
```

### 8.2 RLS Policies

Every table with org-scoped data enforces isolation at the database level. Even if the API has a bug, users cannot access another org's data.

```sql
-- Helper: get the user's org_id from their membership
CREATE OR REPLACE FUNCTION auth.user_org_id()
RETURNS uuid AS $$
  SELECT org_id FROM org_members WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Scans: users can read their org's scans, create scans in their org
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scans_select" ON scans
  FOR SELECT USING (org_id = auth.user_org_id());

CREATE POLICY "scans_insert" ON scans
  FOR INSERT WITH CHECK (org_id = auth.user_org_id());

-- Only the system (service role) updates scan status — not users directly
-- Cloud Functions use the service role key to update scan progress/completion

-- Vulnerabilities: users can read and update status (resolve/ignore) for their org
ALTER TABLE vulnerabilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vulns_select" ON vulnerabilities
  FOR SELECT USING (org_id = auth.user_org_id());

CREATE POLICY "vulns_update" ON vulnerabilities
  FOR UPDATE USING (org_id = auth.user_org_id())
  WITH CHECK (org_id = auth.user_org_id());

-- Only Cloud Functions insert/upsert vulns (service role)
-- Users cannot create fake vulnerabilities

-- Orgs: users can read their own org
ALTER TABLE orgs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orgs_select" ON orgs
  FOR SELECT USING (id = auth.user_org_id());

CREATE POLICY "orgs_update" ON orgs
  FOR UPDATE USING (id = auth.user_org_id());
```

**Key principle:** Users read and update via RLS-protected access. Cloud Functions (using the Supabase service role key) handle all writes for scans and vulnerabilities — this ensures data integrity since only the scan pipeline creates findings.

### 8.3 Realtime Subscriptions

Used for scan progress updates. Frontend subscribes to changes on the scan record.

```typescript
// Frontend: subscribe to scan progress
const channel = supabase
  .channel(`scan:${scanId}`)
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'scans',
    filter: `id=eq.${scanId}`,
  }, (payload) => {
    setScanStatus(payload.new.status)
    setScanProgress(payload.new.progress)
  })
  .subscribe()

// Cleanup on unmount
return () => supabase.removeChannel(channel)
```

**Fallback:** If Realtime disconnects, the frontend falls back to polling `GET /api/scans/:id` every 3 seconds. A `useEffect` monitors the channel status and switches to polling on disconnect.

### 8.4 Auth Flow

```
1. User clicks "Sign in with GitHub"
2. Supabase Auth redirects to GitHub OAuth consent screen
3. GitHub redirects back with auth code
4. Supabase exchanges code for session (access token + refresh token)
5. Frontend stores session via supabase.auth.onAuthStateChange()
6. On first login: API route creates org + org_member record
7. All subsequent requests include the access token
   → Next.js API routes: supabase.auth.getUser(token)
   → RLS: auth.uid() is automatically available in every query
```

### 8.5 Service Role vs Client Access

| Operation | Who does it | Key used |
|-----------|-------------|----------|
| Dashboard reads (vulns, scans, org) | Frontend / Next.js API routes | **anon key** (RLS enforced) |
| Resolve/ignore a vuln | Next.js API route | **anon key** (RLS enforced) |
| Create scan record | Cloud Function | **service role key** (bypasses RLS) |
| Write scan findings | Cloud Function | **service role key** (bypasses RLS) |
| Update scan progress/status | Cloud Function | **service role key** (bypasses RLS) |
| Stripe webhook handling | Next.js API route | **service role key** (needs to update any org's plan) |

The service role key is **never exposed to the frontend**. It lives only in Cloud Functions environment variables and server-side Next.js API routes.

---

## 9. Stripe Integration

### 9.1 Plan Structure

| Plan | Price | Includes |
|------|-------|----------|
| **Trial** | Free | 3 full scans with AI analysis. Auto-converts to Free after exhausted. |
| **Free** | $0/mo | Unlimited public scans → score only (A-F + summary counts). No details, no AI. |
| **Pro** | $19/mo (TBD) | Unlimited full scans, AI analysis, fix prompts, scan history, retest. |
| **Team** | $49/mo (TBD, Phase 3) | Pro features + team members, vuln assignment, Slack/email notifications, reports. |

### 9.2 Checkout Flow

```
1. User hits scan limit or wants AI features
2. Frontend shows upgrade prompt with plan comparison
3. User clicks "Upgrade to Pro"
4. Next.js API route creates Stripe Checkout Session:
   - stripe.checkout.sessions.create({
       customer: org.stripeCustomerId,  // created on first signup
       mode: 'subscription',
       line_items: [{ price: STRIPE_PRO_PRICE_ID, quantity: 1 }],
       success_url: '/dashboard?upgraded=true',
       cancel_url: '/dashboard/billing',
     })
5. User completes payment on Stripe-hosted checkout page
6. Stripe sends webhook → our API updates org.plan to 'pro'
7. User redirected back to dashboard with full access
```

### 9.3 Webhook Handling

```typescript
// api/billing/webhook.ts (Next.js API route)
// Handles Stripe lifecycle events

Events to handle:
- checkout.session.completed    → Set org plan to 'pro', clear trial limits
- customer.subscription.updated → Update plan if changed (upgrade/downgrade)
- customer.subscription.deleted → Revert org plan to 'free'
- invoice.payment_failed        → Flag org, send warning email, grace period

Webhook verification:
- Verify Stripe signature using webhook secret
- Idempotent: check if event already processed (store event ID in processed_events table)
```

### 9.4 Billing Enforcement

The `BillingService` port is checked at the start of every scan:

```typescript
async canScan(orgId: string): Promise<{ allowed: boolean; reason?: string }> {
  const org = await this.getOrg(orgId)

  if (org.plan === 'trial') {
    if (org.trialScansRemaining > 0) return { allowed: true }
    return { allowed: false, reason: 'Trial exhausted. Upgrade to continue scanning.' }
  }

  if (org.plan === 'free') {
    // Free plan: always allowed but results are limited (score only)
    return { allowed: true }
  }

  if (org.plan === 'pro' || org.plan === 'team') {
    // Check subscription is active (not past_due or canceled)
    const subscription = await this.stripe.subscriptions.retrieve(org.stripeSubscriptionId)
    if (subscription.status === 'active') return { allowed: true }
    return { allowed: false, reason: 'Subscription inactive. Please update payment method.' }
  }
}
```

### 9.5 Stripe Customer Lifecycle

- **On signup:** Create Stripe customer (`stripe.customers.create({ email, metadata: { orgId } })`)
- **Store `stripeCustomerId`** on the org record
- **On upgrade:** Create Checkout Session linked to existing customer
- **On cancellation:** Webhook sets plan back to 'free', retains data

---

## 10. Deployment & DevOps

### 10.1 Environments

| Environment | Purpose | Services |
|-------------|---------|----------|
| **Local** | Development | Supabase CLI (local Postgres + Auth + Realtime), Firebase Emulator (Cloud Functions), Next.js dev server |
| **Preview** | PR review | Vercel preview deployment (auto per PR), Supabase project (shared staging), Firebase staging project |
| **Production** | Live | Vercel production, Supabase production project, Firebase production project |

### 10.2 Service Configuration

**Vercel (Next.js frontend + API routes):**
```
Environment variables:
  NEXT_PUBLIC_SUPABASE_URL        — Supabase project URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY   — Supabase public anon key (safe for frontend)
  SUPABASE_SERVICE_ROLE_KEY       — Server-only, for webhook handlers
  STRIPE_SECRET_KEY               — Server-only
  STRIPE_WEBHOOK_SECRET           — Server-only
  STRIPE_PRO_PRICE_ID             — Stripe price ID for Pro plan
```

**Firebase Cloud Functions:**
```
Environment variables (set via firebase functions:secrets):
  SUPABASE_URL                    — Supabase project URL
  SUPABASE_SERVICE_ROLE_KEY       — Bypasses RLS for scan writes
  GITHUB_TOKEN                    — For public repo scanning (MVP)
  ANTHROPIC_API_KEY               — Claude API for AI analysis
```

**Supabase:**
```
Configured via Supabase dashboard / CLI:
  - Auth providers: GitHub OAuth (client ID + secret)
  - Auth redirect URLs: localhost:3000 (dev), vibeshield.com (prod)
  - Database: migrations applied via supabase db push
  - RLS policies: applied via migrations
  - Realtime: enabled on scans table
```

### 10.3 CI/CD Pipeline

**GitHub Actions workflow:**

```yaml
# On push to main-v2:
jobs:
  test:
    - Lint (eslint)
    - Type check (tsc --noEmit)
    - Unit tests (domain logic — scanners, score calculator, billing checks)
    - Integration tests (adapter tests against Supabase local)

  deploy-preview:
    - Vercel auto-deploys preview for every push/PR (built-in, no config needed)

  deploy-production:
    - On merge to main:
      - Vercel deploys frontend + API routes automatically
      - supabase db push — applies any new migrations to production
      - firebase deploy --only functions — deploys updated Cloud Functions
```

### 10.4 Local Development Setup

```bash
# Prerequisites: Node 20+, Docker (for Supabase CLI)

# 1. Clone and install
git clone <repo> && cd vibeshield
npm install

# 2. Start Supabase locally (Postgres + Auth + Realtime)
npx supabase start
# → Outputs local URLs and keys

# 3. Apply migrations
npx supabase db push

# 4. Start Firebase emulator (Cloud Functions)
cd functions && npm install && cd ..
firebase emulators:start --only functions

# 5. Start Next.js dev server
npm run dev
# → http://localhost:3000

# Environment variables for local dev:
# .env.local (auto-generated by supabase start output)
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<local-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<local-service-key>
```

### 10.5 Monitoring & Observability

| Concern | Tool | Notes |
|---------|------|-------|
| **Error tracking** | Sentry (free tier) | Frontend + API routes + Cloud Functions. Alerts on new errors. |
| **Function logs** | Firebase Console / Google Cloud Logging | Structured logs from Cloud Functions. Scan duration, file count, finding count. |
| **Database monitoring** | Supabase Dashboard | Query performance, connection count, storage usage. Built-in. |
| **Uptime** | Vercel Analytics (free) | Frontend performance, response times, error rates. |
| **Billing alerts** | Stripe Dashboard | Failed payments, churn, MRR tracking. |

### 10.6 Secrets Management

| Secret | Stored in | Accessed by |
|--------|-----------|-------------|
| Supabase service role key | Vercel env vars (encrypted) + Firebase secrets | API routes, Cloud Functions |
| Stripe secret key | Vercel env vars (encrypted) | API routes only |
| Stripe webhook secret | Vercel env vars (encrypted) | Webhook handler only |
| Anthropic API key | Firebase secrets | Cloud Functions only |
| GitHub token | Firebase secrets | Cloud Functions only |
| Supabase anon key | Vercel env vars (public) | Frontend (safe — RLS enforced) |

No secrets in git. No `.env` files committed. All secrets injected via platform-level environment variables.

---

## 11. SOLID Compliance Summary

| Principle | Application |
|-----------|------------|
| **Single Responsibility** | Each class does one thing. GitHubCodeRepository fetches code. ClaudeAiAnalyzer calls AI. ScanOrchestrator coordinates. scanCode() runs regex. |
| **Open/Closed** | New scan check = new entry in a checks array. New code host = new class implementing CodeRepository. No existing code modified. |
| **Liskov Substitution** | Every adapter is interchangeable via its port interface. GitHubCodeRepository swaps for GitLabCodeRepository transparently. |
| **Interface Segregation** | Ports are small and specific. CodeRepository has no billing methods. AiAnalyzer has no storage methods. |
| **Dependency Inversion** | Domain depends on abstractions (ports), not concretions (adapters). ScanOrchestrator depends on CodeRepository interface, not GitHubCodeRepository. |

---

## 12. Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Supabase for Auth + DB + Realtime + Storage | Consolidation for a 2-dev team. RLS provides multi-tenant security at the DB level. Aggregation queries are trivial in Postgres. |
| Firebase Cloud Functions for scan worker | Scales to zero (free when idle). 60-min timeout handles any scan. Free tier covers 1,000+ users. |
| TypeScript everywhere | Same language across frontend, API, and Cloud Functions. Anthropic SDK has full TS types. No Python needed — AI features are API calls, not ML. |
| Ports/adapters pattern | Enables testing domain logic with in-memory fakes. Allows swapping GitHub for GitLab, Claude for GPT, Supabase for any Postgres host. |
| Regex first, AI second | Regex is fast, cheap, deterministic. AI enriches critical findings only. This controls API costs while providing immediate value. |
| Upsert for deduplication | Re-scanning updates existing findings instead of creating duplicates. Auto-resolves findings that no longer appear. |
| Batched AI calls | One Claude API call per scan, not one per finding. 10-50x reduction in latency and cost. |
| Score as free hook | The A-F score is computed from regex results (free). Detailed explanations and fix prompts are AI-powered (paid). Free value drives signups. |
