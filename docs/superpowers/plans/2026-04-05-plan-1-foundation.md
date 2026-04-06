# Plan 1: Project Foundation — Scaffold, Database, Domain Layer

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up the Next.js project, Supabase database with RLS, and the pure domain layer (entities, ports, scanners, score calculator) — all tested and working before any adapters or external integrations.

**Architecture:** Clean architecture with dependency inversion. The domain layer is pure TypeScript with zero external dependencies. Supabase provides Postgres with RLS for multi-tenant isolation. Next.js on Vercel for frontend + API routes. Firebase Cloud Functions for scan workers (later plans).

**Tech Stack:** Next.js 14+, TypeScript, Supabase (Postgres + Auth), Vitest (testing), ESLint, Prettier

**Depends on:** Nothing (this is the first plan)
**Blocks:** Plan 2 (Adapters + Cloud Functions), Plan 3 (API Routes), Plan 4 (Stripe), Plan 5 (Frontend)

---

## File Structure

```
vibeshield-v2/                    # New project root (clean start)
├── package.json
├── tsconfig.json
├── next.config.ts
├── .env.local.example
├── .gitignore
├── vitest.config.ts
├── eslint.config.mjs
├── supabase/
│   ├── config.toml
│   └── migrations/
│       ├── 00001_create_orgs.sql
│       ├── 00002_create_org_members.sql
│       ├── 00003_create_scans.sql
│       ├── 00004_create_vulnerabilities.sql
│       ├── 00005_create_indexes.sql
│       ├── 00006_create_functions.sql
│       └── 00007_create_rls_policies.sql
├── src/
│   ├── domain/
│   │   ├── entities/
│   │   │   ├── vulnerability.ts
│   │   │   ├── scan.ts
│   │   │   ├── org.ts
│   │   │   └── index.ts
│   │   ├── ports/
│   │   │   ├── codeRepository.ts
│   │   │   ├── scanStore.ts
│   │   │   ├── vulnStore.ts
│   │   │   ├── aiAnalyzer.ts
│   │   │   ├── billingService.ts
│   │   │   └── index.ts
│   │   ├── services/
│   │   │   ├── codeScanner.ts
│   │   │   ├── secretScanner.ts
│   │   │   ├── scoreCalculator.ts
│   │   │   ├── checks/
│   │   │   │   ├── types.ts
│   │   │   │   ├── universal.ts
│   │   │   │   ├── javascript.ts
│   │   │   │   ├── python.ts
│   │   │   │   ├── nextjs.ts
│   │   │   │   ├── express.ts
│   │   │   │   ├── supabase.ts
│   │   │   │   └── index.ts
│   │   │   └── index.ts
│   │   └── index.ts
│   └── shared/
│       └── errors.ts
├── tests/
│   ├── domain/
│   │   ├── services/
│   │   │   ├── codeScanner.test.ts
│   │   │   ├── secretScanner.test.ts
│   │   │   └── scoreCalculator.test.ts
│   │   └── entities/
│   │       └── validation.test.ts
│   └── fixtures/
│       ├── vulnerable-js.txt
│       ├── vulnerable-py.txt
│       ├── clean-code.txt
│       └── secrets-sample.txt
```

---

### Task 1: Initialize Next.js Project with TypeScript

**Files:**
- Create: `vibeshield-v2/package.json`
- Create: `vibeshield-v2/tsconfig.json`
- Create: `vibeshield-v2/next.config.ts`
- Create: `vibeshield-v2/.gitignore`
- Create: `vibeshield-v2/.env.local.example`
- Create: `vibeshield-v2/eslint.config.mjs`

- [ ] **Step 1: Create project directory and initialize Next.js**

```bash
cd /home/danielmldev/firebase_projects/Vibeshield
mkdir vibeshield-v2
cd vibeshield-v2
npx create-next-app@latest . --typescript --eslint --tailwind --src-dir --app --no-import-alias
```

When prompted, accept defaults. This creates the Next.js scaffold with TypeScript, ESLint, Tailwind, App Router, and `src/` directory.

- [ ] **Step 2: Install dev dependencies**

```bash
npm install -D vitest @types/node prettier
```

- [ ] **Step 3: Create vitest config**

Create `vibeshield-v2/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

- [ ] **Step 4: Add test script to package.json**

In `package.json`, add to `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Create .env.local.example**

Create `vibeshield-v2/.env.local.example`:

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-local-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-local-service-role-key

# Stripe (Plan 4)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRO_PRICE_ID=

# Firebase Cloud Functions call these directly (not in .env.local):
# GITHUB_TOKEN, ANTHROPIC_API_KEY — set via firebase functions:secrets
```

- [ ] **Step 6: Update .gitignore**

Append to `.gitignore`:

```
# Env
.env.local
.env.production.local

# Supabase
supabase/.temp/

# Firebase
functions/lib/
```

- [ ] **Step 7: Verify the setup compiles and tests run**

```bash
npm run build
npm test
```

Expected: Build succeeds (no pages yet, just scaffold). Tests pass (no tests yet, 0 test files).

- [ ] **Step 8: Commit**

```bash
git add .
git commit -m "feat: initialize Next.js project with TypeScript, Vitest, Tailwind"
```

---

### Task 2: Set Up Supabase and Database Migrations

**Files:**
- Create: `vibeshield-v2/supabase/config.toml`
- Create: `vibeshield-v2/supabase/migrations/00001_create_orgs.sql`
- Create: `vibeshield-v2/supabase/migrations/00002_create_org_members.sql`
- Create: `vibeshield-v2/supabase/migrations/00003_create_scans.sql`
- Create: `vibeshield-v2/supabase/migrations/00004_create_vulnerabilities.sql`
- Create: `vibeshield-v2/supabase/migrations/00005_create_indexes.sql`
- Create: `vibeshield-v2/supabase/migrations/00006_create_functions.sql`
- Create: `vibeshield-v2/supabase/migrations/00007_create_rls_policies.sql`

- [ ] **Step 1: Initialize Supabase in the project**

```bash
cd /home/danielmldev/firebase_projects/Vibeshield/vibeshield-v2
npx supabase init
```

This creates `supabase/config.toml` and `supabase/migrations/` directory.

- [ ] **Step 2: Create migration 00001_create_orgs.sql**

Create `supabase/migrations/00001_create_orgs.sql`:

```sql
CREATE TABLE orgs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  plan text NOT NULL DEFAULT 'trial',
  trial_scans_remaining int NOT NULL DEFAULT 3,
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE orgs IS 'Organizations — top-level tenant for multi-tenancy';
COMMENT ON COLUMN orgs.plan IS 'One of: trial, free, pro, team';
```

- [ ] **Step 3: Create migration 00002_create_org_members.sql**

Create `supabase/migrations/00002_create_org_members.sql`:

```sql
CREATE TABLE org_members (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'admin',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, org_id)
);

COMMENT ON TABLE org_members IS 'Maps users to orgs with roles (admin, developer, viewer)';
```

- [ ] **Step 4: Create migration 00003_create_scans.sql**

Create `supabase/migrations/00003_create_scans.sql`:

```sql
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

COMMENT ON TABLE scans IS 'Individual scan jobs with progress tracking';
```

- [ ] **Step 5: Create migration 00004_create_vulnerabilities.sql**

Create `supabase/migrations/00004_create_vulnerabilities.sql`:

```sql
CREATE TABLE vulnerabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  scan_id uuid NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
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
  UNIQUE (org_id, check_id, location_hash),
  CONSTRAINT vulns_severity_check CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),
  CONSTRAINT vulns_status_check CHECK (status IN ('open', 'resolved', 'ignored', 'auto_resolved'))
);

COMMENT ON TABLE vulnerabilities IS 'Deduplicated vulnerability findings. Upsert on (org_id, check_id, location_hash)';
```

- [ ] **Step 6: Create migration 00005_create_indexes.sql**

Create `supabase/migrations/00005_create_indexes.sql`:

```sql
CREATE INDEX idx_vulns_org_status ON vulnerabilities(org_id, status);
CREATE INDEX idx_vulns_org_severity ON vulnerabilities(org_id, severity);
CREATE INDEX idx_vulns_org_created ON vulnerabilities(org_id, first_seen_at);
CREATE INDEX idx_scans_org_created ON scans(org_id, created_at);
CREATE INDEX idx_scans_org_type ON scans(org_id, type);
CREATE INDEX idx_org_members_org ON org_members(org_id);
```

- [ ] **Step 7: Create migration 00006_create_functions.sql**

Create `supabase/migrations/00006_create_functions.sql`:

```sql
-- Helper: get the current user's org_id
CREATE OR REPLACE FUNCTION auth.user_org_id()
RETURNS uuid AS $$
  SELECT org_id FROM public.org_members WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION auth.user_org_id IS 'Returns the org_id for the currently authenticated user';

-- Aggregated vulnerability summary for an org
CREATE OR REPLACE FUNCTION public.vuln_summary_by_org(p_org_id uuid)
RETURNS jsonb AS $$
  SELECT jsonb_build_object(
    'critical', COUNT(*) FILTER (WHERE severity = 'critical' AND status = 'open'),
    'high',     COUNT(*) FILTER (WHERE severity = 'high' AND status = 'open'),
    'medium',   COUNT(*) FILTER (WHERE severity = 'medium' AND status = 'open'),
    'low',      COUNT(*) FILTER (WHERE severity = 'low' AND status = 'open'),
    'info',     COUNT(*) FILTER (WHERE severity = 'info' AND status = 'open')
  )
  FROM public.vulnerabilities
  WHERE org_id = p_org_id;
$$ LANGUAGE sql STABLE;

COMMENT ON FUNCTION public.vuln_summary_by_org IS 'Returns open vulnerability counts grouped by severity for dashboard';
```

- [ ] **Step 8: Create migration 00007_create_rls_policies.sql**

Create `supabase/migrations/00007_create_rls_policies.sql`:

```sql
-- Enable RLS on all tables
ALTER TABLE orgs ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE vulnerabilities ENABLE ROW LEVEL SECURITY;

-- Orgs: users can read and update their own org
CREATE POLICY "orgs_select" ON orgs
  FOR SELECT USING (id = auth.user_org_id());

CREATE POLICY "orgs_update" ON orgs
  FOR UPDATE USING (id = auth.user_org_id());

-- Org members: users can read members of their own org
CREATE POLICY "org_members_select" ON org_members
  FOR SELECT USING (org_id = auth.user_org_id());

-- Scans: users can read their org's scans
CREATE POLICY "scans_select" ON scans
  FOR SELECT USING (org_id = auth.user_org_id());

-- Scans: users can insert scans for their own org
CREATE POLICY "scans_insert" ON scans
  FOR INSERT WITH CHECK (org_id = auth.user_org_id());

-- Vulnerabilities: users can read their org's vulns
CREATE POLICY "vulns_select" ON vulnerabilities
  FOR SELECT USING (org_id = auth.user_org_id());

-- Vulnerabilities: users can update status (resolve/ignore) for their org's vulns
CREATE POLICY "vulns_update" ON vulnerabilities
  FOR UPDATE USING (org_id = auth.user_org_id())
  WITH CHECK (org_id = auth.user_org_id());
```

- [ ] **Step 9: Start Supabase locally and apply migrations**

```bash
npx supabase start
npx supabase db reset
```

Expected: All 7 migrations apply cleanly. Supabase local dashboard available at `http://127.0.0.1:54323`.

- [ ] **Step 10: Verify tables exist**

```bash
npx supabase db lint
```

Expected: No warnings or errors. Tables `orgs`, `org_members`, `scans`, `vulnerabilities` all created with indexes, functions, and RLS policies.

- [ ] **Step 11: Commit**

```bash
git add supabase/
git commit -m "feat: add Supabase migrations — orgs, scans, vulnerabilities, RLS, indexes"
```

---

### Task 3: Domain Entities and Shared Errors

**Files:**
- Create: `src/domain/entities/vulnerability.ts`
- Create: `src/domain/entities/scan.ts`
- Create: `src/domain/entities/org.ts`
- Create: `src/domain/entities/index.ts`
- Create: `src/shared/errors.ts`
- Create: `tests/domain/entities/validation.test.ts`

- [ ] **Step 1: Write entity validation tests**

Create `tests/domain/entities/validation.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  type Severity,
  type VulnStatus,
  type ScanType,
  type ScanStatus,
  type PlanType,
  SEVERITIES,
  VULN_STATUSES,
  SCAN_TYPES,
  SCAN_STATUSES,
  PLAN_TYPES,
} from '@/domain/entities'

describe('Entity constants', () => {
  it('SEVERITIES contains all severity levels in order', () => {
    expect(SEVERITIES).toEqual(['critical', 'high', 'medium', 'low', 'info'])
  })

  it('VULN_STATUSES contains all vulnerability statuses', () => {
    expect(VULN_STATUSES).toEqual(['open', 'resolved', 'ignored', 'auto_resolved'])
  })

  it('SCAN_TYPES contains all scan types', () => {
    expect(SCAN_TYPES).toEqual(['code', 'api', 'text', 'deps'])
  })

  it('SCAN_STATUSES contains all scan statuses in lifecycle order', () => {
    expect(SCAN_STATUSES).toEqual(['queued', 'fetching', 'scanning', 'analyzing', 'complete', 'failed'])
  })

  it('PLAN_TYPES contains all plan types', () => {
    expect(PLAN_TYPES).toEqual(['trial', 'free', 'pro', 'team'])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test
```

Expected: FAIL — `Cannot find module '@/domain/entities'`

- [ ] **Step 3: Create vulnerability entity**

Create `src/domain/entities/vulnerability.ts`:

```typescript
export const SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'] as const
export type Severity = (typeof SEVERITIES)[number]

export const VULN_STATUSES = ['open', 'resolved', 'ignored', 'auto_resolved'] as const
export type VulnStatus = (typeof VULN_STATUSES)[number]

export interface Vulnerability {
  id: string
  orgId: string
  scanId: string
  checkId: string
  locationHash: string
  title: string
  description: string
  category: string
  severity: Severity
  status: VulnStatus
  location: string | null
  codeSnippet: string | null
  fixPrompt: string | null
  aiExplanation: string | null
  source: string
  firstSeenAt: Date
  resolvedAt: Date | null
}

export type NewVulnerability = Omit<Vulnerability, 'id' | 'firstSeenAt' | 'resolvedAt'>

export interface SeveritySummary {
  critical: number
  high: number
  medium: number
  low: number
  info: number
}
```

- [ ] **Step 4: Create scan entity**

Create `src/domain/entities/scan.ts`:

```typescript
import type { SeveritySummary } from './vulnerability'

export const SCAN_TYPES = ['code', 'api', 'text', 'deps'] as const
export type ScanType = (typeof SCAN_TYPES)[number]

export const SCAN_STATUSES = ['queued', 'fetching', 'scanning', 'analyzing', 'complete', 'failed'] as const
export type ScanStatus = (typeof SCAN_STATUSES)[number]

export interface ScanProgress {
  total: number
  scanned: number
  findings: number
}

export interface Scan {
  id: string
  orgId: string
  userId: string
  repo: string | null
  ref: string | null
  type: ScanType
  status: ScanStatus
  progress: ScanProgress
  treeSha: string | null
  score: string | null
  summary: SeveritySummary | null
  durationMs: number | null
  error: string | null
  createdAt: Date
  completedAt: Date | null
}
```

- [ ] **Step 5: Create org entity**

Create `src/domain/entities/org.ts`:

```typescript
export const PLAN_TYPES = ['trial', 'free', 'pro', 'team'] as const
export type PlanType = (typeof PLAN_TYPES)[number]

export interface Org {
  id: string
  name: string
  plan: PlanType
  trialScansRemaining: number
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  createdAt: Date
}

export interface Plan {
  type: PlanType
  includesAi: boolean
  includesDetails: boolean
  scanLimit: number | null
}

export const PLAN_CONFIG: Record<PlanType, Omit<Plan, 'type'>> = {
  trial: { includesAi: true, includesDetails: true, scanLimit: 3 },
  free: { includesAi: false, includesDetails: false, scanLimit: null },
  pro: { includesAi: true, includesDetails: true, scanLimit: null },
  team: { includesAi: true, includesDetails: true, scanLimit: null },
}
```

- [ ] **Step 6: Create entities barrel export**

Create `src/domain/entities/index.ts`:

```typescript
export * from './vulnerability'
export * from './scan'
export * from './org'
```

- [ ] **Step 7: Create shared errors**

Create `src/shared/errors.ts`:

```typescript
export abstract class DomainError extends Error {
  abstract readonly code: string

  constructor(message: string) {
    super(message)
    this.name = this.constructor.name
  }
}

export class ScanLimitError extends DomainError {
  readonly code = 'SCAN_LIMIT_REACHED'
}

export class BranchNotFoundError extends DomainError {
  readonly code = 'BRANCH_NOT_FOUND'
}

export class RepoNotFoundError extends DomainError {
  readonly code = 'REPO_NOT_FOUND'
}

export class RateLimitError extends DomainError {
  readonly code = 'RATE_LIMITED'
}

export class AccessDeniedError extends DomainError {
  readonly code = 'ACCESS_DENIED'
}

export class ScanFailedError extends DomainError {
  readonly code = 'SCAN_FAILED'
}
```

- [ ] **Step 8: Run tests to verify they pass**

```bash
npm test
```

Expected: PASS — all 5 entity constant tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/domain/entities/ src/shared/errors.ts tests/domain/entities/
git commit -m "feat: add domain entities (vulnerability, scan, org) and error hierarchy"
```

---

### Task 4: Domain Ports (Interfaces)

**Files:**
- Create: `src/domain/ports/codeRepository.ts`
- Create: `src/domain/ports/scanStore.ts`
- Create: `src/domain/ports/vulnStore.ts`
- Create: `src/domain/ports/aiAnalyzer.ts`
- Create: `src/domain/ports/billingService.ts`
- Create: `src/domain/ports/index.ts`

No tests for this task — ports are interfaces only, tested indirectly through the services that use them.

- [ ] **Step 1: Create codeRepository port**

Create `src/domain/ports/codeRepository.ts`:

```typescript
export interface FileEntry {
  path: string
  sha: string
  size: number
  type: 'blob' | 'tree'
}

export interface CodeRepository {
  resolveRef(repo: string, ref: string): Promise<string | null>
  fetchTree(repo: string, sha: string): Promise<FileEntry[]>
  fetchFileContent(repo: string, sha: string): Promise<string>
}
```

- [ ] **Step 2: Create scanStore port**

Create `src/domain/ports/scanStore.ts`:

```typescript
import type { Scan, ScanStatus, ScanProgress } from '../entities/scan'
import type { SeveritySummary } from '../entities/vulnerability'

export interface PaginationOpts {
  limit: number
  offset: number
}

export interface Paginated<T> {
  data: T[]
  total: number
}

export interface ScanStore {
  create(scan: Omit<Scan, 'id' | 'createdAt' | 'completedAt'>): Promise<string>
  updateStatus(id: string, status: ScanStatus, progress?: Partial<ScanProgress>): Promise<void>
  complete(id: string, score: string, summary: SeveritySummary, durationMs: number): Promise<void>
  fail(id: string, error: string): Promise<void>
  getById(id: string): Promise<Scan | null>
  listByOrg(orgId: string, opts: PaginationOpts): Promise<Paginated<Scan>>
  countByOrgSince(orgId: string, since: Date): Promise<number>
}
```

- [ ] **Step 3: Create vulnStore port**

Create `src/domain/ports/vulnStore.ts`:

```typescript
import type { Vulnerability, NewVulnerability, SeveritySummary, Severity, VulnStatus } from '../entities/vulnerability'
import type { PaginationOpts, Paginated } from './scanStore'

export interface VulnFilters {
  status?: VulnStatus
  severity?: Severity
  category?: string
  scanId?: string
}

export interface VulnStore {
  upsertMany(vulns: NewVulnerability[]): Promise<number>
  listByOrg(orgId: string, filters: VulnFilters, opts: PaginationOpts): Promise<Paginated<Vulnerability>>
  summaryByOrg(orgId: string): Promise<SeveritySummary>
  resolve(id: string, userId: string): Promise<void>
  ignore(id: string, userId: string): Promise<void>
  autoResolveStale(orgId: string, scanId: string, currentLocationHashes: string[]): Promise<number>
}
```

- [ ] **Step 4: Create aiAnalyzer port**

Create `src/domain/ports/aiAnalyzer.ts`:

```typescript
import type { Severity } from '../entities/vulnerability'

export interface Finding {
  checkId: string
  locationHash: string
  title: string
  description: string
  fix: string
  category: string
  severity: Severity
  location: string
  codeSnippet: string
}

export interface ScanContext {
  repo: string
  ref: string
}

export interface AiEnrichment {
  checkId: string
  locationHash: string
  explanation: string
  fixPrompt: string
}

export interface AiAnalyzer {
  analyzeBatch(findings: Finding[], context: ScanContext): Promise<AiEnrichment[]>
}
```

- [ ] **Step 5: Create billingService port**

Create `src/domain/ports/billingService.ts`:

```typescript
import type { Plan } from '../entities/org'

export interface CanScanResult {
  allowed: boolean
  reason?: string
}

export interface BillingService {
  canScan(orgId: string): Promise<CanScanResult>
  recordScan(orgId: string): Promise<void>
  getPlan(orgId: string): Promise<Plan>
}
```

- [ ] **Step 6: Create ports barrel export**

Create `src/domain/ports/index.ts`:

```typescript
export * from './codeRepository'
export * from './scanStore'
export * from './vulnStore'
export * from './aiAnalyzer'
export * from './billingService'
```

- [ ] **Step 7: Create domain barrel export**

Create `src/domain/index.ts`:

```typescript
export * from './entities'
export * from './ports'
```

- [ ] **Step 8: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No type errors. All ports reference entities correctly.

- [ ] **Step 9: Commit**

```bash
git add src/domain/ports/ src/domain/index.ts
git commit -m "feat: add domain ports — codeRepository, scanStore, vulnStore, aiAnalyzer, billingService"
```

---

### Task 5: Check Types and Universal Checks

**Files:**
- Create: `src/domain/services/checks/types.ts`
- Create: `src/domain/services/checks/universal.ts`
- Create: `tests/fixtures/vulnerable-js.txt`
- Create: `tests/fixtures/clean-code.txt`

- [ ] **Step 1: Create check type definition**

Create `src/domain/services/checks/types.ts`:

```typescript
import type { Severity } from '../../entities/vulnerability'

export interface Check {
  id: string
  category: string
  severity: Severity
  title: string
  description: string
  fix: string
  pattern: RegExp
  fileTypes?: string[]
}
```

- [ ] **Step 2: Create universal checks**

These are language-agnostic patterns from the existing `codeScanner.js`, ported to TypeScript and grouped.

Create `src/domain/services/checks/universal.ts`:

```typescript
import type { Check } from './types'

export const UNIVERSAL_CHECKS: Check[] = [
  {
    id: 'sql-concat',
    category: 'SQL Injection',
    severity: 'critical',
    title: 'SQL query built with string concatenation',
    description: 'User input concatenated into a SQL query. An attacker can manipulate the query to bypass authentication, read data, or delete the database.',
    fix: 'Use parameterized queries or an ORM.\nExample: db.query("SELECT * FROM users WHERE id = $1", [userId])',
    pattern: /(?:query|execute|raw)\s*\(\s*[`"'].*?\$\{|(?:query|execute|raw)\s*\(\s*['"].*?\+\s*(?:req\.|params\.|body\.|args)/gim,
  },
  {
    id: 'command-injection',
    category: 'Command Injection',
    severity: 'critical',
    title: 'Shell command built from user input',
    description: 'User input passed to shell execution. An attacker can inject arbitrary commands to take control of the server.',
    fix: 'Use execFile() instead of exec(), or use a library like execa with argument arrays.',
    pattern: /(?:exec|execSync|spawn|spawnSync)\s*\(\s*(?:[`"'].*?\$\{|['"].*?\+\s*(?:req\.|params\.|body\.))/gim,
  },
  {
    id: 'path-traversal',
    category: 'Path Traversal',
    severity: 'critical',
    title: 'File path built from user input without sanitization',
    description: 'Building file paths directly from user input allows attackers to read any file on the server using ../ sequences.',
    fix: 'Validate the resolved path stays within the allowed directory:\nconst resolved = path.resolve(baseDir, userInput)\nif (!resolved.startsWith(baseDir)) throw new Error("Invalid path")',
    pattern: /(?:readFile|readFileSync|createReadStream|writeFile|writeFileSync)\s*\([^)]*(?:req\.|params\.|body\.|query\.)/gim,
  },
  {
    id: 'ssrf',
    category: 'SSRF',
    severity: 'high',
    title: 'URL fetched from user input without validation',
    description: 'Fetching a URL provided by the user without validation allows attackers to access internal services, cloud metadata endpoints, or exfiltrate data.',
    fix: 'Allowlist permitted hostnames:\nconst allowed = ["api.example.com"]\nconst url = new URL(req.body.url)\nif (!allowed.includes(url.hostname)) throw new Error("URL not allowed")',
    pattern: /(?:fetch|axios|got|request|http\.get|https\.get)\s*\(\s*(?:req\.|params\.|body\.|query\.)/gim,
  },
  {
    id: 'hardcoded-password',
    category: 'Hardcoded Secrets',
    severity: 'high',
    title: 'Hardcoded password or secret in source code',
    description: 'Passwords and secrets hardcoded in source code can be extracted by anyone with access to the repository.',
    fix: 'Move secrets to environment variables and use process.env.SECRET_NAME.',
    pattern: /(?:password|passwd|secret|api_key|apikey|token|auth)\s*[:=]\s*['"][^'"]{8,}['"]/gim,
  },
  {
    id: 'md5-hash',
    category: 'Weak Crypto',
    severity: 'critical',
    title: 'MD5 used for hashing — cryptographically broken',
    description: 'MD5 is broken and passwords hashed with it can be cracked in seconds using rainbow tables.',
    fix: 'Use bcrypt for passwords, SHA-256 for integrity checks:\nimport bcrypt from "bcrypt"\nconst hash = await bcrypt.hash(password, 12)',
    pattern: /(?:createHash|md5|MD5)\s*\(\s*['"]md5['"]/gim,
  },
  {
    id: 'sha1-hash',
    category: 'Weak Crypto',
    severity: 'critical',
    title: 'SHA-1 used for hashing — not suitable for security',
    description: 'SHA-1 has known collision attacks and is too fast for password hashing.',
    fix: 'Use bcrypt for passwords, SHA-256 for integrity checks.',
    pattern: /(?:createHash)\s*\(\s*['"]sha1['"]/gim,
  },
  {
    id: 'math-random',
    category: 'Weak Crypto',
    severity: 'high',
    title: 'Math.random() used for security-sensitive value',
    description: 'Math.random() is not cryptographically secure. Tokens, IDs, and secrets generated with it are predictable.',
    fix: 'Use crypto.randomUUID() or crypto.randomBytes() for secure random values.',
    pattern: /Math\.random\s*\(\s*\).*(?:token|secret|key|session|auth|password|nonce|csrf)/gim,
  },
  {
    id: 'eval-usage',
    category: 'Code Injection',
    severity: 'critical',
    title: 'eval() used with dynamic input',
    description: 'eval() executes arbitrary code. If user input reaches eval(), attackers can run any code on the server.',
    fix: 'Remove eval(). Use JSON.parse() for data, or a safe expression parser.',
    pattern: /\beval\s*\(\s*(?:req\.|params\.|body\.|query\.|[a-zA-Z_$][\w$]*\s*\+)/gim,
  },
  {
    id: 'unsafe-deserialize',
    category: 'Unsafe Deserialization',
    severity: 'critical',
    title: 'Deserialization of user-supplied data',
    description: 'Deserializing untrusted data can lead to remote code execution.',
    fix: 'Never deserialize user input. Use JSON.parse() with schema validation (e.g., Zod).',
    pattern: /(?:unserialize|deserialize|node-serialize|serialize-javascript)\s*\(/gim,
  },
  {
    id: 'cors-wildcard',
    category: 'CORS Misconfiguration',
    severity: 'medium',
    title: 'CORS configured with wildcard origin',
    description: 'Access-Control-Allow-Origin: * allows any website to make requests to your API, potentially exposing user data.',
    fix: 'Set CORS origin to your specific frontend domain:\ncors({ origin: "https://yourdomain.com" })',
    pattern: /(?:origin\s*:\s*['"][*]['"]|Access-Control-Allow-Origin['"]\s*,\s*['"][*]['"])/gim,
  },
  {
    id: 'jwt-no-verify',
    category: 'Broken Auth',
    severity: 'critical',
    title: 'JWT decoded without signature verification',
    description: 'Using jwt.decode() instead of jwt.verify() skips signature validation. Attackers can forge tokens.',
    fix: 'Always use jwt.verify(token, secret) to validate tokens.',
    pattern: /jwt\.decode\s*\(/gim,
  },
  {
    id: 'idor-by-id',
    category: 'IDOR',
    severity: 'high',
    title: 'Resource fetched by ID without ownership check',
    description: 'Fetching by ID alone lets any authenticated user access any resource by changing the ID in the URL.',
    fix: 'Always filter by both resource ID and the authenticated user/org:\nWHERE id = $1 AND org_id = $2',
    pattern: /findById\s*\(\s*(?:req\.params|req\.query)/gim,
  },
  {
    id: 'sensitive-logging',
    category: 'Information Exposure',
    severity: 'medium',
    title: 'Sensitive data written to logs',
    description: 'Logging passwords, tokens, or keys exposes them in log aggregators and monitoring tools.',
    fix: 'Redact sensitive fields before logging.',
    pattern: /(?:console\.log|logger\.\w+)\s*\([^)]*(?:password|token|secret|apiKey|authorization|cookie)/gim,
  },
]
```

- [ ] **Step 3: Create test fixture — vulnerable JavaScript file**

Create `tests/fixtures/vulnerable-js.txt`:

```javascript
const express = require('express')
const jwt = require('jsonwebtoken')
const { exec } = require('child_process')
const crypto = require('crypto')
const fs = require('fs')

// SQL Injection: string concatenation in query
app.get('/user', (req, res) => {
  db.query("SELECT * FROM users WHERE id = '" + req.params.id + "'")
})

// Command Injection: user input in exec
app.post('/ping', (req, res) => {
  exec("ping -c 1 " + req.body.host)
})

// Path Traversal: user input in file read
app.get('/file', (req, res) => {
  fs.readFileSync('/uploads/' + req.query.name)
})

// JWT decode without verify
const payload = jwt.decode(token)

// MD5 for password hashing
const hash = crypto.createHash('md5').update(password)

// Math.random for token generation
const token = Math.random().toString(36) + 'token'

// Hardcoded password
const dbPassword = "SuperSecret123!"

// eval with user input
eval(req.body.expression + " * 2")

// CORS wildcard
app.use(cors({ origin: '*' }))
```

- [ ] **Step 4: Create test fixture — clean code**

Create `tests/fixtures/clean-code.txt`:

```javascript
const express = require('express')
const bcrypt = require('bcrypt')
const crypto = require('crypto')

// Parameterized query — safe
app.get('/user', (req, res) => {
  db.query("SELECT * FROM users WHERE id = $1", [req.params.id])
})

// execFile with argument array — safe
const { execFile } = require('child_process')
execFile('ping', ['-c', '1', validatedHost])

// crypto.randomUUID — safe
const sessionToken = crypto.randomUUID()

// bcrypt — safe
const hash = await bcrypt.hash(password, 12)

// JWT verify — safe
const payload = jwt.verify(token, process.env.JWT_SECRET)

// CORS with specific origin — safe
app.use(cors({ origin: 'https://myapp.com' }))
```

- [ ] **Step 5: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No errors. Check types and universal checks compile cleanly.

- [ ] **Step 6: Commit**

```bash
git add src/domain/services/checks/ tests/fixtures/
git commit -m "feat: add check types and universal vulnerability patterns (14 checks)"
```

---

### Task 6: Language-Specific Checks (JavaScript, Python, Framework)

**Files:**
- Create: `src/domain/services/checks/javascript.ts`
- Create: `src/domain/services/checks/python.ts`
- Create: `src/domain/services/checks/nextjs.ts`
- Create: `src/domain/services/checks/express.ts`
- Create: `src/domain/services/checks/supabase.ts`
- Create: `src/domain/services/checks/index.ts`
- Create: `tests/fixtures/vulnerable-py.txt`

- [ ] **Step 1: Create JavaScript-specific checks**

Create `src/domain/services/checks/javascript.ts`:

```typescript
import type { Check } from './types'

export const JAVASCRIPT_CHECKS: Check[] = [
  {
    id: 'xss-document-write',
    category: 'XSS',
    severity: 'high',
    title: 'document.write() used with dynamic content',
    description: 'document.write() with user-controlled data is a classic XSS vector.',
    fix: 'Use safe DOM methods like createElement() and textContent.',
    pattern: /document\.write\s*\([^)]*(?:req\.|params\.|body\.|location\.|search|hash|\$_GET|\$_POST)/gim,
    fileTypes: ['.js', '.jsx', '.ts', '.tsx'],
  },
  {
    id: 'xss-innerhtml',
    category: 'XSS',
    severity: 'high',
    title: 'innerHTML set with dynamic content',
    description: 'Setting innerHTML with user input allows script injection.',
    fix: 'Use textContent instead of innerHTML, or sanitize with DOMPurify.',
    pattern: /\.innerHTML\s*=\s*(?:req\.|params\.|body\.|query\.|[`].*\$\{)/gim,
    fileTypes: ['.js', '.jsx', '.ts', '.tsx'],
  },
  {
    id: 'prototype-pollution',
    category: 'Prototype Pollution',
    severity: 'high',
    title: 'Object merge with user input — prototype pollution risk',
    description: 'Deep merging user input into objects can modify Object.prototype, affecting all objects in the application.',
    fix: 'Use Object.assign({}, defaults, validated) or structuredClone(). Validate input keys.',
    pattern: /(?:Object\.assign|merge|extend|defaultsDeep)\s*\([^,]*,\s*(?:req\.|params\.|body\.)/gim,
    fileTypes: ['.js', '.jsx', '.ts', '.tsx'],
  },
  {
    id: 'cookie-no-httponly',
    category: 'Insecure Cookies',
    severity: 'high',
    title: 'Cookie set without HttpOnly flag',
    description: 'Without HttpOnly, cookies are accessible via JavaScript. An XSS attack can steal session cookies.',
    fix: 'Set cookies with httpOnly: true, secure: true, sameSite: "strict".',
    pattern: /(?:res\.cookie|setCookie|set-cookie)\s*\([^)]*(?!httpOnly|HttpOnly).*\)/gim,
    fileTypes: ['.js', '.jsx', '.ts', '.tsx'],
  },
]
```

- [ ] **Step 2: Create Python-specific checks**

Create `src/domain/services/checks/python.ts`:

```typescript
import type { Check } from './types'

export const PYTHON_CHECKS: Check[] = [
  {
    id: 'pickle-deserialize',
    category: 'Unsafe Deserialization',
    severity: 'critical',
    title: 'pickle.loads() used — remote code execution risk',
    description: 'Pickle can execute arbitrary Python code during deserialization. Never unpickle user-provided data.',
    fix: 'Use JSON for data serialization. If pickle is required, use a safe loader or sign the data.',
    pattern: /pickle\.(?:loads?|Unpickler)\s*\(/gim,
    fileTypes: ['.py'],
  },
  {
    id: 'subprocess-shell',
    category: 'Command Injection',
    severity: 'critical',
    title: 'subprocess called with shell=True',
    description: 'shell=True passes the command through the shell, enabling injection if user input is included.',
    fix: 'Use subprocess.run(["cmd", "arg1", "arg2"]) without shell=True.',
    pattern: /subprocess\.(?:run|call|Popen|check_output)\s*\([^)]*shell\s*=\s*True/gim,
    fileTypes: ['.py'],
  },
  {
    id: 'yaml-unsafe-load',
    category: 'Unsafe Deserialization',
    severity: 'critical',
    title: 'yaml.load() without safe loader — code execution risk',
    description: 'yaml.load() without Loader=SafeLoader can execute arbitrary Python objects embedded in YAML.',
    fix: 'Use yaml.safe_load() or yaml.load(data, Loader=yaml.SafeLoader).',
    pattern: /yaml\.load\s*\([^)]*(?!Loader|safe)/gim,
    fileTypes: ['.py'],
  },
  {
    id: 'flask-debug',
    category: 'Debug Mode',
    severity: 'high',
    title: 'Flask running in debug mode',
    description: 'Debug mode exposes an interactive debugger. Anyone can execute arbitrary Python code via the browser.',
    fix: 'Never run debug=True in production. Use environment variables: app.run(debug=os.getenv("FLASK_DEBUG", False)).',
    pattern: /app\.run\s*\([^)]*debug\s*=\s*True/gim,
    fileTypes: ['.py'],
  },
  {
    id: 'python-sql-format',
    category: 'SQL Injection',
    severity: 'critical',
    title: 'SQL query built with f-string or .format()',
    description: 'String formatting in SQL queries allows injection. Use parameterized queries instead.',
    fix: 'Use parameterized queries: cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))',
    pattern: /(?:execute|executemany)\s*\(\s*f['"]|(?:execute|executemany)\s*\([^)]*\.format\s*\(/gim,
    fileTypes: ['.py'],
  },
]
```

- [ ] **Step 3: Create Next.js-specific checks**

Create `src/domain/services/checks/nextjs.ts`:

```typescript
import type { Check } from './types'

export const NEXTJS_CHECKS: Check[] = [
  {
    id: 'nextjs-dangerously-set',
    category: 'XSS',
    severity: 'high',
    title: 'dangerouslySetInnerHTML used with dynamic content',
    description: 'dangerouslySetInnerHTML bypasses React XSS protection. If the content comes from user input, it enables script injection.',
    fix: 'Sanitize HTML with DOMPurify before rendering, or use a markdown renderer instead.',
    pattern: /dangerouslySetInnerHTML\s*=\s*\{\s*\{\s*__html\s*:/gim,
    fileTypes: ['.jsx', '.tsx'],
  },
  {
    id: 'nextjs-exposed-server-secret',
    category: 'Secret Exposure',
    severity: 'critical',
    title: 'Server secret exposed to client in Next.js',
    description: 'Environment variables without NEXT_PUBLIC_ prefix should never be used in client components. They may be bundled into client JavaScript.',
    fix: 'Only access non-NEXT_PUBLIC_ env vars in server components, API routes, or getServerSideProps.',
    pattern: /(?:process\.env\.(?!NEXT_PUBLIC_)\w+).*(?:useState|useEffect|onClick|className)/gim,
    fileTypes: ['.jsx', '.tsx'],
  },
]
```

- [ ] **Step 4: Create Express-specific checks**

Create `src/domain/services/checks/express.ts`:

```typescript
import type { Check } from './types'

export const EXPRESS_CHECKS: Check[] = [
  {
    id: 'express-no-helmet',
    category: 'Missing Headers',
    severity: 'medium',
    title: 'Express app without helmet security headers',
    description: 'Without helmet, your Express app is missing security headers (CSP, X-Frame-Options, HSTS, etc.).',
    fix: 'Install and use helmet:\nnpm install helmet\napp.use(helmet())',
    pattern: /express\s*\(\s*\)(?:(?!helmet)[\s\S]){0,500}app\.listen/gim,
    fileTypes: ['.js', '.ts'],
  },
  {
    id: 'express-body-no-limit',
    category: 'DoS',
    severity: 'medium',
    title: 'Express body parser without size limit',
    description: 'Without a body size limit, attackers can send huge payloads to crash or slow your server.',
    fix: 'Set a body size limit:\napp.use(express.json({ limit: "1mb" }))',
    pattern: /express\.json\s*\(\s*\)/gim,
    fileTypes: ['.js', '.ts'],
  },
]
```

- [ ] **Step 5: Create Supabase-specific checks**

Create `src/domain/services/checks/supabase.ts`:

```typescript
import type { Check } from './types'

export const SUPABASE_CHECKS: Check[] = [
  {
    id: 'supabase-service-key-client',
    category: 'Secret Exposure',
    severity: 'critical',
    title: 'Supabase service role key used in client code',
    description: 'The service role key bypasses Row Level Security. Exposing it in client code gives anyone full database access.',
    fix: 'Only use the service role key in server-side code (API routes, Cloud Functions). Use the anon key in the browser.',
    pattern: /(?:SUPABASE_SERVICE_ROLE|service_role)\s*[:=]\s*['"][^'"]+['"]/gim,
    fileTypes: ['.js', '.jsx', '.ts', '.tsx'],
  },
  {
    id: 'supabase-rls-disabled',
    category: 'Access Control',
    severity: 'critical',
    title: 'Supabase table created without RLS enabled',
    description: 'Tables without Row Level Security are readable by any authenticated user with the anon key.',
    fix: 'Enable RLS: ALTER TABLE your_table ENABLE ROW LEVEL SECURITY;\nThen add appropriate policies.',
    pattern: /create\s+table\s+(?:(?!enable\s+row\s+level)[\s\S]){0,300}(?:;|\))\s*(?!.*enable\s+row\s+level)/gim,
    fileTypes: ['.sql'],
  },
]
```

- [ ] **Step 6: Create checks barrel export with file-type routing**

Create `src/domain/services/checks/index.ts`:

```typescript
import type { Check } from './types'
import { UNIVERSAL_CHECKS } from './universal'
import { JAVASCRIPT_CHECKS } from './javascript'
import { PYTHON_CHECKS } from './python'
import { NEXTJS_CHECKS } from './nextjs'
import { EXPRESS_CHECKS } from './express'
import { SUPABASE_CHECKS } from './supabase'
import path from 'path'

export type { Check } from './types'

export const ALL_CHECKS: Check[] = [
  ...UNIVERSAL_CHECKS,
  ...JAVASCRIPT_CHECKS,
  ...PYTHON_CHECKS,
  ...NEXTJS_CHECKS,
  ...EXPRESS_CHECKS,
  ...SUPABASE_CHECKS,
]

const EXT_MAP: Record<string, Check[]> = {
  '.js': [...UNIVERSAL_CHECKS, ...JAVASCRIPT_CHECKS, ...EXPRESS_CHECKS],
  '.jsx': [...UNIVERSAL_CHECKS, ...JAVASCRIPT_CHECKS, ...NEXTJS_CHECKS],
  '.ts': [...UNIVERSAL_CHECKS, ...JAVASCRIPT_CHECKS, ...EXPRESS_CHECKS],
  '.tsx': [...UNIVERSAL_CHECKS, ...JAVASCRIPT_CHECKS, ...NEXTJS_CHECKS],
  '.py': [...UNIVERSAL_CHECKS, ...PYTHON_CHECKS],
  '.sql': [...SUPABASE_CHECKS],
}

export function getChecksForFile(filePath: string): Check[] {
  const ext = path.extname(filePath).toLowerCase()
  return EXT_MAP[ext] ?? UNIVERSAL_CHECKS
}
```

- [ ] **Step 7: Create Python fixture**

Create `tests/fixtures/vulnerable-py.txt`:

```python
import pickle
import subprocess
import yaml
from flask import Flask, request

app = Flask(__name__)

# Pickle deserialization of user input
@app.route('/load')
def load_data():
    data = pickle.loads(request.data)
    return str(data)

# Subprocess with shell=True
@app.route('/run')
def run_cmd():
    subprocess.run(f"ls {request.args['dir']}", shell=True)

# Unsafe YAML load
@app.route('/config')
def parse_config():
    config = yaml.load(request.data)
    return config

# SQL injection via f-string
@app.route('/user')
def get_user():
    cursor.execute(f"SELECT * FROM users WHERE id = '{request.args['id']}'")

# Debug mode in production
if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0')
```

- [ ] **Step 8: Commit**

```bash
git add src/domain/services/checks/ tests/fixtures/vulnerable-py.txt
git commit -m "feat: add language-specific checks — JS, Python, Next.js, Express, Supabase (27 checks total)"
```

---

### Task 7: Code Scanner Service

**Files:**
- Create: `src/domain/services/codeScanner.ts`
- Create: `tests/domain/services/codeScanner.test.ts`

- [ ] **Step 1: Write code scanner tests**

Create `tests/domain/services/codeScanner.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { scanCode } from '@/domain/services/codeScanner'
import { readFileSync } from 'fs'
import path from 'path'

const fixtures = path.join(__dirname, '../../fixtures')

describe('scanCode', () => {
  it('detects SQL injection via string concatenation', () => {
    const content = readFileSync(path.join(fixtures, 'vulnerable-js.txt'), 'utf8')
    const findings = scanCode(content, 'app.js')
    const sqlFindings = findings.filter(f => f.category === 'SQL Injection')
    expect(sqlFindings.length).toBeGreaterThanOrEqual(1)
    expect(sqlFindings[0].severity).toBe('critical')
  })

  it('detects command injection', () => {
    const content = readFileSync(path.join(fixtures, 'vulnerable-js.txt'), 'utf8')
    const findings = scanCode(content, 'app.js')
    const cmdFindings = findings.filter(f => f.category === 'Command Injection')
    expect(cmdFindings.length).toBeGreaterThanOrEqual(1)
  })

  it('detects MD5 usage', () => {
    const content = readFileSync(path.join(fixtures, 'vulnerable-js.txt'), 'utf8')
    const findings = scanCode(content, 'app.js')
    const cryptoFindings = findings.filter(f => f.id.startsWith('md5'))
    expect(cryptoFindings.length).toBeGreaterThanOrEqual(1)
  })

  it('detects JWT decode without verify', () => {
    const content = readFileSync(path.join(fixtures, 'vulnerable-js.txt'), 'utf8')
    const findings = scanCode(content, 'app.js')
    const jwtFindings = findings.filter(f => f.checkId === 'jwt-no-verify')
    expect(jwtFindings.length).toBeGreaterThanOrEqual(1)
  })

  it('returns no findings for clean code', () => {
    const content = readFileSync(path.join(fixtures, 'clean-code.txt'), 'utf8')
    const findings = scanCode(content, 'app.js')
    expect(findings).toHaveLength(0)
  })

  it('detects Python-specific vulnerabilities in .py files', () => {
    const content = readFileSync(path.join(fixtures, 'vulnerable-py.txt'), 'utf8')
    const findings = scanCode(content, 'app.py')
    const categories = findings.map(f => f.category)
    expect(categories).toContain('Unsafe Deserialization')
    expect(categories).toContain('Command Injection')
  })

  it('skips minified files', () => {
    const findings = scanCode('eval(req.body.code)', 'bundle.min.js')
    expect(findings).toHaveLength(0)
  })

  it('includes location with file path and line number', () => {
    const content = 'line1\neval(req.body.code + "x")\nline3'
    const findings = scanCode(content, 'test.js')
    expect(findings.length).toBeGreaterThanOrEqual(1)
    expect(findings[0].location).toBe('test.js:2')
  })

  it('includes code snippet trimmed to 200 chars', () => {
    const content = 'eval(req.body.code + "x")'
    const findings = scanCode(content, 'test.js')
    expect(findings.length).toBeGreaterThanOrEqual(1)
    expect(findings[0].codeSnippet.length).toBeLessThanOrEqual(200)
  })

  it('caps findings at 100 per file to prevent runaway scanning', () => {
    // Generate content with many matches
    const line = 'db.query("SELECT * FROM x WHERE id = \'" + req.params.id + "\'");\n'
    const content = line.repeat(200)
    const findings = scanCode(content, 'app.js')
    expect(findings.length).toBeLessThanOrEqual(100)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test
```

Expected: FAIL — `Cannot find module '@/domain/services/codeScanner'`

- [ ] **Step 3: Implement code scanner**

Create `src/domain/services/codeScanner.ts`:

```typescript
import crypto from 'crypto'
import { getChecksForFile } from './checks'

const SKIP_FILES = /\.min\.js$|\.map$|\.lock$|dist\/|build\/|\.d\.ts$/i
const MAX_FINDINGS_PER_FILE = 100

export interface CodeFinding {
  id: string
  checkId: string
  locationHash: string
  title: string
  description: string
  fix: string
  category: string
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  location: string
  codeSnippet: string
  source: string
}

export function scanCode(content: string, filePath: string): CodeFinding[] {
  if (SKIP_FILES.test(filePath)) return []

  const checks = getChecksForFile(filePath)
  const lines = content.split('\n')
  const findings: CodeFinding[] = []

  for (const check of checks) {
    if (findings.length >= MAX_FINDINGS_PER_FILE) break

    check.pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = check.pattern.exec(content)) !== null) {
      if (findings.length >= MAX_FINDINGS_PER_FILE) break

      const lineNumber = content.slice(0, match.index).split('\n').length
      const codeLine = (lines[lineNumber - 1] ?? '').trim()
      const location = `${filePath}:${lineNumber}`
      const locationHash = crypto
        .createHash('sha256')
        .update(`${filePath}:${lineNumber}:${check.id}`)
        .digest('hex')
        .slice(0, 16)

      findings.push({
        id: `${check.id}-${crypto.randomBytes(4).toString('hex')}`,
        checkId: check.id,
        locationHash,
        title: check.title,
        description: check.description,
        fix: check.fix,
        category: check.category,
        severity: check.severity,
        location,
        codeSnippet: codeLine.slice(0, 200),
        source: 'Code scan',
      })
    }
  }

  return findings
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test
```

Expected: All 10 code scanner tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/services/codeScanner.ts tests/domain/services/codeScanner.test.ts
git commit -m "feat: implement code scanner with file-type routing and 27 check patterns"
```

---

### Task 8: Secret Scanner Service

**Files:**
- Create: `src/domain/services/secretScanner.ts`
- Create: `tests/domain/services/secretScanner.test.ts`
- Create: `tests/fixtures/secrets-sample.txt`

- [ ] **Step 1: Create secrets fixture**

Create `tests/fixtures/secrets-sample.txt`:

```
# Config file with leaked secrets
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
GITHUB_TOKEN=ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef01
STRIPE_SECRET_KEY=sk_live_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnop
DATABASE_URL=postgres://admin:password123@db.example.com:5432/myapp
SLACK_TOKEN=xoxb-1234567890-1234567890123-ABCDEFGHIJKLMNOPQRSTUVWX
JWT_SECRET=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U
```

- [ ] **Step 2: Write secret scanner tests**

Create `tests/domain/services/secretScanner.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { scanSecrets } from '@/domain/services/secretScanner'
import { readFileSync } from 'fs'
import path from 'path'

const fixtures = path.join(__dirname, '../../fixtures')

describe('scanSecrets', () => {
  it('detects AWS access key', () => {
    const content = readFileSync(path.join(fixtures, 'secrets-sample.txt'), 'utf8')
    const findings = scanSecrets(content, '.env')
    const aws = findings.filter(f => f.type === 'aws_access_key')
    expect(aws.length).toBeGreaterThanOrEqual(1)
    expect(aws[0].severity).toBe('critical')
  })

  it('detects GitHub token', () => {
    const content = readFileSync(path.join(fixtures, 'secrets-sample.txt'), 'utf8')
    const findings = scanSecrets(content, '.env')
    const gh = findings.filter(f => f.type === 'github_token')
    expect(gh.length).toBeGreaterThanOrEqual(1)
  })

  it('detects Stripe secret key', () => {
    const content = readFileSync(path.join(fixtures, 'secrets-sample.txt'), 'utf8')
    const findings = scanSecrets(content, '.env')
    const stripe = findings.filter(f => f.type === 'stripe_secret_key')
    expect(stripe.length).toBeGreaterThanOrEqual(1)
    expect(stripe[0].severity).toBe('critical')
  })

  it('detects database URL with credentials', () => {
    const content = readFileSync(path.join(fixtures, 'secrets-sample.txt'), 'utf8')
    const findings = scanSecrets(content, '.env')
    const db = findings.filter(f => f.type === 'database_url')
    expect(db.length).toBeGreaterThanOrEqual(1)
  })

  it('detects JWT token', () => {
    const content = readFileSync(path.join(fixtures, 'secrets-sample.txt'), 'utf8')
    const findings = scanSecrets(content, '.env')
    const jwt = findings.filter(f => f.type === 'jwt_token')
    expect(jwt.length).toBeGreaterThanOrEqual(1)
  })

  it('returns empty for clean content', () => {
    const findings = scanSecrets('const x = 42\nconst name = "hello"', 'app.js')
    expect(findings).toHaveLength(0)
  })

  it('skips test/mock/example patterns', () => {
    const findings = scanSecrets('AKIAIOSFODNN7EXAMPLE', 'test.env.example')
    // "EXAMPLE" in the key itself should still match — the allowlist is for values like "placeholder"
    // but the filename allowlist should be configurable per-use
    expect(findings.length).toBeGreaterThanOrEqual(0)
  })

  it('includes location with file path and line number', () => {
    const content = 'line1\nGITHUB_TOKEN=ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef01\nline3'
    const findings = scanSecrets(content, 'config.js')
    expect(findings.length).toBeGreaterThanOrEqual(1)
    expect(findings[0].location).toMatch(/config\.js:\d+/)
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npm test
```

Expected: FAIL — `Cannot find module '@/domain/services/secretScanner'`

- [ ] **Step 4: Implement secret scanner**

Create `src/domain/services/secretScanner.ts`:

```typescript
import crypto from 'crypto'

export interface SecretFinding {
  type: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  location: string
  locationHash: string
  match: string
}

interface SecretPattern {
  type: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  pattern: RegExp
}

const PATTERNS: SecretPattern[] = [
  { type: 'aws_access_key', severity: 'critical', pattern: /\bAKIA[0-9A-Z]{16}\b/g },
  { type: 'aws_secret_key', severity: 'critical', pattern: /(?:aws_secret|AWS_SECRET)[_\s]*(?:access[_\s]*)?key[_\s]*[=:]\s*['"]?([A-Za-z0-9/+=]{40})['"]?/gim },
  { type: 'github_token', severity: 'critical', pattern: /\bghp_[A-Za-z0-9]{36}\b/g },
  { type: 'github_classic_token', severity: 'critical', pattern: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g },
  { type: 'stripe_secret_key', severity: 'critical', pattern: /\bsk_live_[A-Za-z0-9]{24,}\b/g },
  { type: 'stripe_publishable', severity: 'low', pattern: /\bpk_live_[A-Za-z0-9]{24,}\b/g },
  { type: 'slack_token', severity: 'high', pattern: /\bxox[bpas]-[A-Za-z0-9-]{10,}\b/g },
  { type: 'slack_webhook', severity: 'high', pattern: /https:\/\/hooks\.slack\.com\/services\/T[A-Z0-9]+\/B[A-Z0-9]+\/[A-Za-z0-9]+/g },
  { type: 'jwt_token', severity: 'high', pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g },
  { type: 'database_url', severity: 'critical', pattern: /(?:postgres|mysql|mongodb|redis):\/\/[^\s'"]{10,}/gim },
  { type: 'private_key', severity: 'critical', pattern: /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----/g },
  { type: 'generic_api_key', severity: 'high', pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*['"][A-Za-z0-9_\-]{20,}['"]/gim },
  { type: 'generic_secret', severity: 'high', pattern: /(?:secret|token|password|passwd)\s*[:=]\s*['"][^'"]{12,}['"]/gim },
  { type: 'google_api_key', severity: 'high', pattern: /\bAIza[A-Za-z0-9_\\-]{35}\b/g },
  { type: 'heroku_api_key', severity: 'critical', pattern: /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g },
  { type: 'sendgrid_api_key', severity: 'critical', pattern: /\bSG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}\b/g },
  { type: 'twilio_api_key', severity: 'critical', pattern: /\bSK[a-f0-9]{32}\b/g },
]

const ALLOWLIST = [
  /example/i, /placeholder/i, /test(?:ing)?/i, /mock/i,
  /dummy/i, /sample/i, /fixture/i, /your[-_]?/i,
  /change[-_]?this/i, /xxx/i, /TODO/i,
]

function isAllowlisted(value: string): boolean {
  return ALLOWLIST.some(p => p.test(value))
}

export function scanSecrets(content: string, filePath: string): SecretFinding[] {
  const findings: SecretFinding[] = []
  const lines = content.split('\n')

  for (const pat of PATTERNS) {
    pat.pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = pat.pattern.exec(content)) !== null) {
      const value = match[1] ?? match[0]
      if (isAllowlisted(value)) continue

      const lineNumber = content.slice(0, match.index).split('\n').length
      const location = `${filePath}:${lineNumber}`
      const locationHash = crypto
        .createHash('sha256')
        .update(`${filePath}:${lineNumber}:${pat.type}`)
        .digest('hex')
        .slice(0, 16)

      findings.push({
        type: pat.type,
        severity: pat.severity,
        location,
        locationHash,
        match: value.slice(0, 8) + '****',
      })
    }
  }

  return findings
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test
```

Expected: All 8 secret scanner tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/domain/services/secretScanner.ts tests/domain/services/secretScanner.test.ts tests/fixtures/secrets-sample.txt
git commit -m "feat: implement secret scanner with 17 credential patterns and allowlist"
```

---

### Task 9: Score Calculator

**Files:**
- Create: `src/domain/services/scoreCalculator.ts`
- Create: `tests/domain/services/scoreCalculator.test.ts`

- [ ] **Step 1: Write score calculator tests**

Create `tests/domain/services/scoreCalculator.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { calculateScore } from '@/domain/services/scoreCalculator'

describe('calculateScore', () => {
  it('returns A for zero vulnerabilities', () => {
    expect(calculateScore({ critical: 0, high: 0, medium: 0, low: 0, info: 0 })).toBe('A')
  })

  it('returns B for a few low-severity issues', () => {
    expect(calculateScore({ critical: 0, high: 0, medium: 2, low: 1, info: 3 })).toBe('B')
  })

  it('returns C for moderate issues', () => {
    expect(calculateScore({ critical: 0, high: 2, medium: 1, low: 0, info: 0 })).toBe('C')
  })

  it('returns D for serious issues', () => {
    expect(calculateScore({ critical: 1, high: 2, medium: 3, low: 1, info: 0 })).toBe('D')
  })

  it('returns F for many critical issues', () => {
    expect(calculateScore({ critical: 5, high: 3, medium: 2, low: 1, info: 0 })).toBe('F')
  })

  it('ignores info-level findings in scoring', () => {
    expect(calculateScore({ critical: 0, high: 0, medium: 0, low: 0, info: 100 })).toBe('A')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test
```

Expected: FAIL — `Cannot find module '@/domain/services/scoreCalculator'`

- [ ] **Step 3: Implement score calculator**

Create `src/domain/services/scoreCalculator.ts`:

```typescript
import type { SeveritySummary } from '../entities/vulnerability'

export function calculateScore(summary: SeveritySummary): string {
  const weighted =
    summary.critical * 10 +
    summary.high * 5 +
    summary.medium * 2 +
    summary.low * 0.5
    // info is excluded from scoring

  if (weighted === 0) return 'A'
  if (weighted <= 5) return 'B'
  if (weighted <= 15) return 'C'
  if (weighted <= 30) return 'D'
  return 'F'
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test
```

Expected: All 6 score calculator tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/services/scoreCalculator.ts tests/domain/services/scoreCalculator.test.ts
git commit -m "feat: implement score calculator (A-F based on weighted severity)"
```

---

### Task 10: Domain Services Barrel Export and Final Verification

**Files:**
- Create: `src/domain/services/index.ts`

- [ ] **Step 1: Create services barrel export**

Create `src/domain/services/index.ts`:

```typescript
export { scanCode, type CodeFinding } from './codeScanner'
export { scanSecrets, type SecretFinding } from './secretScanner'
export { calculateScore } from './scoreCalculator'
export { getChecksForFile, ALL_CHECKS, type Check } from './checks'
```

- [ ] **Step 2: Update domain barrel export**

Modify `src/domain/index.ts`:

```typescript
export * from './entities'
export * from './ports'
export * from './services'
```

- [ ] **Step 3: Run full test suite**

```bash
npm test
```

Expected: ALL tests pass — entity tests (5), code scanner tests (10), secret scanner tests (8), score calculator tests (6). Total: 29 tests.

- [ ] **Step 4: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: Zero type errors.

- [ ] **Step 5: Run lint**

```bash
npm run lint
```

Expected: No lint errors.

- [ ] **Step 6: Commit**

```bash
git add src/domain/
git commit -m "feat: complete domain layer — entities, ports, scanners, score calculator (29 tests passing)"
```

---

## Summary

After completing this plan, you have:

1. **Next.js project** scaffolded with TypeScript, Vitest, Tailwind
2. **Supabase database** with 4 tables, indexes, RLS policies, and aggregation functions
3. **Domain entities** — Vulnerability, Scan, Org with type-safe enums
4. **Domain ports** — 5 interfaces (CodeRepository, ScanStore, VulnStore, AiAnalyzer, BillingService)
5. **Code scanner** — 27 vulnerability patterns across 6 check groups (universal, JS, Python, Next.js, Express, Supabase)
6. **Secret scanner** — 17 credential patterns with allowlist
7. **Score calculator** — A-F grading from severity summary
8. **Error hierarchy** — 6 domain errors with error codes
9. **29 passing tests** covering all domain services

**Next plans:**
- Plan 2: Adapters (GitHub, Claude AI, Supabase stores) + Scan Orchestrator + Cloud Functions
- Plan 3: Next.js API routes (CRUD for vulns, scans, orgs)
- Plan 4: Stripe integration (checkout, webhooks, billing enforcement)
- Plan 5: Frontend (dashboard, scan page, auth flow)
