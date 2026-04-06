# Plan 3: Next.js API Routes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the Next.js API routes that the frontend will call — scan triggers, vulnerability CRUD, scan history, org management, and auth callback. Plus a Supabase client helper and auth middleware.

**Architecture:** Next.js App Router API routes (Route Handlers) under `src/app/api/`. Server-side only. Supabase client is created per-request using the user's auth token (RLS enforced) or service role key (for privileged operations). Cloud Functions handle the heavy scan work — API routes just trigger them and serve CRUD.

**Tech Stack:** Next.js Route Handlers, Supabase JS client, Zod validation

**Depends on:** Plan 1 (domain layer), Plan 2 (adapters, orchestrator)
**Blocks:** Plan 5 (Frontend)

---

## File Structure

```
vibeshield-v2/src/
├── lib/
│   ├── supabase/
│   │   ├── server.ts          # Create Supabase client for server-side (API routes)
│   │   └── middleware.ts      # Auth helper — extract user from request
│   └── api-utils.ts           # Shared response helpers, error handling
├── app/api/
│   ├── auth/
│   │   └── callback/
│   │       └── route.ts       # POST: create org + org_member on first login
│   ├── scans/
│   │   ├── route.ts           # GET: list scans, POST: trigger new scan
│   │   └── [id]/
│   │       └── route.ts       # GET: single scan by id
│   ├── vulns/
│   │   ├── route.ts           # GET: list vulns with filters
│   │   ├── summary/
│   │   │   └── route.ts       # GET: severity summary for dashboard
│   │   └── [id]/
│   │       ├── resolve/
│   │       │   └── route.ts   # PATCH: resolve a vuln
│   │       └── ignore/
│   │           └── route.ts   # PATCH: ignore a vuln
│   ├── org/
│   │   └── route.ts           # GET: current user's org
│   └── scan-public/
│       └── route.ts           # POST: free public scan (no auth, score only)
```

---

### Task 1: Supabase Server Client and Auth Helper

**Files:**
- Create: `vibeshield-v2/src/lib/supabase/server.ts`
- Create: `vibeshield-v2/src/lib/supabase/middleware.ts`
- Create: `vibeshield-v2/src/lib/api-utils.ts`

- [ ] **Step 1: Install Supabase SSR helper**

```bash
cd /home/danielmldev/firebase_projects/Vibeshield/vibeshield-v2
npm install @supabase/ssr
```

- [ ] **Step 2: Create Supabase server client**

Create `src/lib/supabase/server.ts`:

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createSupabaseServer() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        },
      },
    }
  )
}

export function createSupabaseAdmin() {
  const { createClient } = require('@supabase/supabase-js')
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}
```

- [ ] **Step 3: Create auth middleware helper**

Create `src/lib/supabase/middleware.ts`:

```typescript
import { createSupabaseServer } from './server'

export interface AuthUser {
  id: string
  email: string
  orgId: string | null
}

export async function getAuthUser(): Promise<AuthUser | null> {
  const supabase = await createSupabaseServer()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null

  // Get org membership
  const { data: membership } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .single()

  return {
    id: user.id,
    email: user.email ?? '',
    orgId: membership?.org_id ?? null,
  }
}

export async function requireAuth(): Promise<AuthUser> {
  const user = await getAuthUser()
  if (!user) throw new Error('UNAUTHORIZED')
  if (!user.orgId) throw new Error('NO_ORG')
  return user
}
```

- [ ] **Step 4: Create API utilities**

Create `src/lib/api-utils.ts`:

```typescript
import { NextResponse } from 'next/server'

export function jsonOk(data: unknown, status = 200) {
  return NextResponse.json(data, { status })
}

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

export function handleApiError(err: unknown): NextResponse {
  if (err instanceof Error) {
    if (err.message === 'UNAUTHORIZED') return jsonError('Authentication required', 401)
    if (err.message === 'NO_ORG') return jsonError('No organization found. Complete setup first.', 403)
    if (err.message.includes('SCAN_LIMIT')) return jsonError(err.message, 429)
    if (err.message.includes('NOT_FOUND')) return jsonError(err.message, 404)
    console.error('[api]', err.message)
  }
  return jsonError('Internal server error', 500)
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
cd /home/danielmldev/firebase_projects/Vibeshield
git add vibeshield-v2/src/lib/ vibeshield-v2/package.json vibeshield-v2/package-lock.json
git commit -m "feat: add Supabase server client, auth helper, and API utilities"
```

---

### Task 2: Auth Callback Route

**Files:**
- Create: `vibeshield-v2/src/app/api/auth/callback/route.ts`

This route is called on first login to create an org and link the user.

- [ ] **Step 1: Create auth callback route**

Create `src/app/api/auth/callback/route.ts`:

```typescript
import { NextRequest } from 'next/server'
import { createSupabaseServer, createSupabaseAdmin } from '@/lib/supabase/server'
import { jsonOk, jsonError, handleApiError } from '@/lib/api-utils'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServer()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return jsonError('Not authenticated', 401)

    // Check if user already has an org
    const { data: existing } = await supabase
      .from('org_members')
      .select('org_id')
      .eq('user_id', user.id)
      .single()

    if (existing) {
      return jsonOk({ orgId: existing.org_id, created: false })
    }

    // Create new org and membership using admin client (bypasses RLS for INSERT)
    const admin = createSupabaseAdmin()
    const body = await req.json().catch(() => ({}))
    const orgName = body.orgName || user.email?.split('@')[0] || 'My Org'

    const { data: org, error: orgError } = await admin
      .from('orgs')
      .insert({ name: orgName })
      .select('id')
      .single()

    if (orgError) return jsonError('Failed to create organization', 500)

    const { error: memberError } = await admin
      .from('org_members')
      .insert({ user_id: user.id, org_id: org.id, role: 'admin' })

    if (memberError) return jsonError('Failed to create membership', 500)

    return jsonOk({ orgId: org.id, created: true }, 201)
  } catch (err) {
    return handleApiError(err)
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

- [ ] **Step 3: Commit**

```bash
cd /home/danielmldev/firebase_projects/Vibeshield
git add vibeshield-v2/src/app/api/auth/
git commit -m "feat: add auth callback route — org creation on first login"
```

---

### Task 3: Scans API Routes

**Files:**
- Create: `vibeshield-v2/src/app/api/scans/route.ts`
- Create: `vibeshield-v2/src/app/api/scans/[id]/route.ts`

- [ ] **Step 1: Create scans list + trigger route**

Create `src/app/api/scans/route.ts`:

```typescript
import { NextRequest } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/supabase/middleware'
import { jsonOk, jsonError, handleApiError } from '@/lib/api-utils'
import { z } from 'zod'

// GET /api/scans — list scans for the current org
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth()
    const supabase = await createSupabaseServer()

    const url = new URL(req.url)
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '20'), 100)
    const offset = parseInt(url.searchParams.get('offset') ?? '0')

    const { data, error, count } = await supabase
      .from('scans')
      .select('*', { count: 'exact' })
      .eq('org_id', user.orgId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) return jsonError('Failed to fetch scans', 500)
    return jsonOk({ data, total: count ?? 0 })
  } catch (err) {
    return handleApiError(err)
  }
}

const TriggerScanSchema = z.object({
  repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
  ref: z.string().default('main'),
  type: z.enum(['code', 'api', 'text', 'deps']).default('code'),
})

// POST /api/scans — trigger a new scan
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await req.json()
    const parsed = TriggerScanSchema.safeParse(body)
    if (!parsed.success) return jsonError('Invalid scan parameters', 400)

    const { repo, ref, type } = parsed.data

    // Check trial/plan limits
    const supabase = await createSupabaseServer()
    const { data: org } = await supabase
      .from('orgs')
      .select('plan, trial_scans_remaining')
      .eq('id', user.orgId)
      .single()

    if (!org) return jsonError('Organization not found', 404)
    if (org.plan === 'trial' && org.trial_scans_remaining <= 0) {
      return jsonError('Free trial exhausted. Upgrade to continue scanning.', 429)
    }

    // Create scan record (status: queued)
    const { data: scan, error: scanError } = await supabase
      .from('scans')
      .insert({
        org_id: user.orgId,
        user_id: user.id,
        repo,
        ref,
        type,
        status: 'queued',
        progress: { total: 0, scanned: 0, findings: 0 },
      })
      .select('id')
      .single()

    if (scanError) return jsonError('Failed to create scan', 500)

    // TODO: Trigger Cloud Function to process scan asynchronously
    // For now, return the scan ID so frontend can poll for progress

    return jsonOk({ scanId: scan.id, status: 'queued' }, 201)
  } catch (err) {
    return handleApiError(err)
  }
}
```

- [ ] **Step 2: Create single scan route**

Create `src/app/api/scans/[id]/route.ts`:

```typescript
import { NextRequest } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/supabase/middleware'
import { jsonOk, jsonError, handleApiError } from '@/lib/api-utils'

// GET /api/scans/:id — get scan details (progress, score, summary)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth()
    const { id } = await params
    const supabase = await createSupabaseServer()

    const { data, error } = await supabase
      .from('scans')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) return jsonError('Scan not found', 404)
    return jsonOk(data)
  } catch (err) {
    return handleApiError(err)
  }
}
```

- [ ] **Step 3: Install zod in the main project** (if not already installed)

```bash
cd /home/danielmldev/firebase_projects/Vibeshield/vibeshield-v2
npm install zod
```

- [ ] **Step 4: Verify TypeScript compiles**

- [ ] **Step 5: Commit**

```bash
cd /home/danielmldev/firebase_projects/Vibeshield
git add vibeshield-v2/src/app/api/scans/ vibeshield-v2/package.json vibeshield-v2/package-lock.json
git commit -m "feat: add scans API routes — list, trigger, get by id"
```

---

### Task 4: Vulnerabilities API Routes

**Files:**
- Create: `vibeshield-v2/src/app/api/vulns/route.ts`
- Create: `vibeshield-v2/src/app/api/vulns/summary/route.ts`
- Create: `vibeshield-v2/src/app/api/vulns/[id]/resolve/route.ts`
- Create: `vibeshield-v2/src/app/api/vulns/[id]/ignore/route.ts`

- [ ] **Step 1: Create vulns list route**

Create `src/app/api/vulns/route.ts`:

```typescript
import { NextRequest } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/supabase/middleware'
import { jsonOk, jsonError, handleApiError } from '@/lib/api-utils'

// GET /api/vulns — list vulnerabilities with optional filters
export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth()
    const supabase = await createSupabaseServer()

    const url = new URL(req.url)
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50'), 200)
    const offset = parseInt(url.searchParams.get('offset') ?? '0')
    const status = url.searchParams.get('status')
    const severity = url.searchParams.get('severity')
    const category = url.searchParams.get('category')
    const scanId = url.searchParams.get('scanId')

    let query = supabase
      .from('vulnerabilities')
      .select('*', { count: 'exact' })
      .eq('org_id', user.orgId)

    if (status) query = query.eq('status', status)
    if (severity) query = query.eq('severity', severity)
    if (category) query = query.eq('category', category)
    if (scanId) query = query.eq('scan_id', scanId)

    const { data, error, count } = await query
      .order('first_seen_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) return jsonError('Failed to fetch vulnerabilities', 500)
    return jsonOk({ data, total: count ?? 0 })
  } catch (err) {
    return handleApiError(err)
  }
}
```

- [ ] **Step 2: Create vulnerability summary route**

Create `src/app/api/vulns/summary/route.ts`:

```typescript
import { createSupabaseServer } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/supabase/middleware'
import { jsonOk, jsonError, handleApiError } from '@/lib/api-utils'

// GET /api/vulns/summary — severity breakdown for dashboard
export async function GET() {
  try {
    const user = await requireAuth()
    const supabase = await createSupabaseServer()

    const { data, error } = await supabase
      .rpc('vuln_summary_by_org', { p_org_id: user.orgId })

    if (error) return jsonError('Failed to fetch summary', 500)
    return jsonOk(data ?? { critical: 0, high: 0, medium: 0, low: 0, info: 0 })
  } catch (err) {
    return handleApiError(err)
  }
}
```

- [ ] **Step 3: Create resolve route**

Create `src/app/api/vulns/[id]/resolve/route.ts`:

```typescript
import { NextRequest } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/supabase/middleware'
import { jsonOk, jsonError, handleApiError } from '@/lib/api-utils'

// PATCH /api/vulns/:id/resolve
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params
    const supabase = await createSupabaseServer()

    const { error } = await supabase
      .from('vulnerabilities')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        resolved_by: user.id,
      })
      .eq('id', id)

    if (error) return jsonError('Failed to resolve vulnerability', 500)
    return jsonOk({ ok: true })
  } catch (err) {
    return handleApiError(err)
  }
}
```

- [ ] **Step 4: Create ignore route**

Create `src/app/api/vulns/[id]/ignore/route.ts`:

```typescript
import { NextRequest } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/supabase/middleware'
import { jsonOk, jsonError, handleApiError } from '@/lib/api-utils'

// PATCH /api/vulns/:id/ignore
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params
    const supabase = await createSupabaseServer()

    const { error } = await supabase
      .from('vulnerabilities')
      .update({
        status: 'ignored',
        resolved_at: new Date().toISOString(),
        resolved_by: user.id,
      })
      .eq('id', id)

    if (error) return jsonError('Failed to ignore vulnerability', 500)
    return jsonOk({ ok: true })
  } catch (err) {
    return handleApiError(err)
  }
}
```

- [ ] **Step 5: Verify TypeScript compiles**

- [ ] **Step 6: Commit**

```bash
cd /home/danielmldev/firebase_projects/Vibeshield
git add vibeshield-v2/src/app/api/vulns/
git commit -m "feat: add vulns API routes — list, summary, resolve, ignore"
```

---

### Task 5: Org API Route

**Files:**
- Create: `vibeshield-v2/src/app/api/org/route.ts`

- [ ] **Step 1: Create org route**

Create `src/app/api/org/route.ts`:

```typescript
import { createSupabaseServer } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/supabase/middleware'
import { jsonOk, jsonError, handleApiError } from '@/lib/api-utils'

// GET /api/org — get current user's org details
export async function GET() {
  try {
    const user = await requireAuth()
    const supabase = await createSupabaseServer()

    const { data, error } = await supabase
      .from('orgs')
      .select('*')
      .eq('id', user.orgId)
      .single()

    if (error || !data) return jsonError('Organization not found', 404)
    return jsonOk(data)
  } catch (err) {
    return handleApiError(err)
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

- [ ] **Step 3: Commit**

```bash
cd /home/danielmldev/firebase_projects/Vibeshield
git add vibeshield-v2/src/app/api/org/
git commit -m "feat: add org API route — get current org details"
```

---

### Task 6: Public Scan Route (No Auth)

**Files:**
- Create: `vibeshield-v2/src/app/api/scan-public/route.ts`

This is the free scan endpoint — no signup required. Returns score + summary only. Detailed findings are gated behind auth.

- [ ] **Step 1: Create public scan route**

Create `src/app/api/scan-public/route.ts`:

```typescript
import { NextRequest } from 'next/server'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { jsonOk, jsonError, handleApiError } from '@/lib/api-utils'
import { scanCode } from '@/domain/services/codeScanner'
import { scanSecrets } from '@/domain/services/secretScanner'
import { calculateScore } from '@/domain/services/scoreCalculator'
import type { SeveritySummary } from '@/domain/entities/vulnerability'
import { z } from 'zod'

const PublicScanSchema = z.object({
  repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
  ref: z.string().default('main'),
})

const SKIP = /node_modules|\.git|dist\/|build\/|\.png$|\.jpg$|\.gif$|\.ico$|\.lock$|\.min\.js$/i
const RELEVANT = /\.(js|jsx|ts|tsx|py|rb|php|go|java|cs|env|json|ya?ml|toml|tf|sh|sql)$|^\.env/i
const MAX_FILES = 50  // Fewer files for free scan
const MAX_FILE_SIZE = 128 * 1024  // 128KB for free scan

// POST /api/scan-public — free scan, no auth, returns score only
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = PublicScanSchema.safeParse(body)
    if (!parsed.success) return jsonError('Invalid parameters. Expected: { repo: "owner/repo" }', 400)

    const { repo, ref } = parsed.data
    const githubToken = process.env.GITHUB_TOKEN
    if (!githubToken) return jsonError('Scanning service not configured', 503)

    const base = 'https://api.github.com'
    const headers = {
      Authorization: `Bearer ${githubToken}`,
      Accept: 'application/vnd.github+json',
    }

    // Resolve ref
    const refRes = await fetch(`${base}/repos/${repo}/git/ref/heads/${ref}`, { headers })
    if (!refRes.ok) {
      if (refRes.status === 404) return jsonError(`Repository or branch not found: ${repo}@${ref}`, 404)
      return jsonError('GitHub API error', 502)
    }
    const refData = await refRes.json()
    const sha = refData.object.sha

    // Fetch tree
    const treeRes = await fetch(`${base}/repos/${repo}/git/trees/${sha}?recursive=1`, { headers })
    if (!treeRes.ok) return jsonError('Failed to fetch repository tree', 502)
    const treeData = await treeRes.json()

    const scannable = treeData.tree
      .filter((f: any) =>
        f.type === 'blob'
        && !SKIP.test(f.path)
        && RELEVANT.test(f.path)
        && (f.size ?? 0) <= MAX_FILE_SIZE
      )
      .slice(0, MAX_FILES)

    // Fetch and scan files
    const summary: SeveritySummary = { critical: 0, high: 0, medium: 0, low: 0, info: 0 }
    let totalFindings = 0

    for (const file of scannable) {
      const blobRes = await fetch(`${base}/repos/${repo}/git/blobs/${file.sha}`, { headers })
      if (!blobRes.ok) continue
      const blobData = await blobRes.json()
      const content = Buffer.from(blobData.content, 'base64').toString('utf8')

      const codeFindings = scanCode(content, file.path)
      const secretFindings = scanSecrets(content, file.path)
      const all = [...codeFindings, ...secretFindings]

      for (const f of all) {
        const sev = f.severity as keyof SeveritySummary
        if (sev in summary) summary[sev]++
        totalFindings++
      }
    }

    const score = calculateScore(summary)

    return jsonOk({
      score,
      summary,
      totalFindings,
      filesScanned: scannable.length,
      repo,
      ref,
      // No detailed findings — sign up to see those
    })
  } catch (err) {
    return handleApiError(err)
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

- [ ] **Step 3: Commit**

```bash
cd /home/danielmldev/firebase_projects/Vibeshield
git add vibeshield-v2/src/app/api/scan-public/
git commit -m "feat: add public scan route — free score without signup"
```

---

### Task 7: Full Verification

**Files:** None new — verification only.

- [ ] **Step 1: Run full test suite**

```bash
cd /home/danielmldev/firebase_projects/Vibeshield/vibeshield-v2
npm test
```

Expected: All 49 existing tests still pass (API routes don't have unit tests — they're integration-tested against Supabase).

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Build Next.js**

```bash
npm run build
```

This verifies all routes compile and the Next.js app builds successfully.

- [ ] **Step 4: Verify commit history**

```bash
git log --oneline main-v2 | head -10
```

- [ ] **Step 5: Fix any issues and commit**

---

## Summary

After completing this plan, you have:

1. **Supabase server client** — per-request client with RLS enforcement via user's auth cookie
2. **Auth helper** — `getAuthUser()` and `requireAuth()` extracting user + org from session
3. **API utilities** — `jsonOk()`, `jsonError()`, `handleApiError()` for consistent responses
4. **Auth callback** — POST `/api/auth/callback` creates org + membership on first login
5. **Scans routes** — GET list, POST trigger, GET by id
6. **Vulns routes** — GET list with filters, GET summary, PATCH resolve, PATCH ignore
7. **Org route** — GET current org details
8. **Public scan** — POST free scan returning score + summary only (no auth required)

**API Summary:**

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| POST | `/api/auth/callback` | Yes | Create org on first login |
| GET | `/api/scans` | Yes | List scan history |
| POST | `/api/scans` | Yes | Trigger new scan |
| GET | `/api/scans/:id` | Yes | Get scan status/progress |
| GET | `/api/vulns` | Yes | List vulns with filters |
| GET | `/api/vulns/summary` | Yes | Severity breakdown |
| PATCH | `/api/vulns/:id/resolve` | Yes | Mark vuln as resolved |
| PATCH | `/api/vulns/:id/ignore` | Yes | Mark vuln as ignored |
| GET | `/api/org` | Yes | Get current org |
| POST | `/api/scan-public` | No | Free scan, score only |

**Next plans:**
- Plan 4: Stripe integration (checkout, webhooks, billing page)
- Plan 5: Frontend (dashboard, scan page, auth flow, realtime)
