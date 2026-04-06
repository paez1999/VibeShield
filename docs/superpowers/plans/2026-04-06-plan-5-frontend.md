# Plan 5: Frontend — Next.js Dashboard, Auth, Scanning UI

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full frontend for VibeShield v2 — public landing/scan page, Supabase Auth (GitHub OAuth), dashboard with vuln management, scan pages, scan history, billing, and settings. Dark theme inspired by Juan's v1 UI design.

**Architecture:** Next.js App Router with server and client components. Supabase Auth handles sessions via cookies. Tailwind CSS for styling (replacing v1's inline styles). API calls go to our Next.js API routes (`/api/*`).

**Tech Stack:** Next.js 16+ (App Router), React 19, Tailwind CSS, Supabase Auth (SSR), TypeScript

**Depends on:** Plans 1-4 (backend complete), Plan 4.5 (port features)

**Design reference:** Juan's v1 frontend pages and components (dark theme, sidebar nav, metric cards, severity badges, scan forms)

---

## Pages Overview

| Route | Component | Auth | Description |
|-------|-----------|------|-------------|
| `/` | Landing page | No | Public scan input + marketing copy |
| `/auth` | Auth page | Guest only | GitHub OAuth login/signup |
| `/auth/callback` | Auth callback | No | Supabase auth callback handler |
| `/dashboard` | Dashboard | Yes | Security score, metric cards, quick scan, recent vulns |
| `/dashboard/vulns` | Vulnerabilities | Yes | Filterable vuln list, resolve/ignore, expand details, fix panel |
| `/dashboard/scan/code` | Code scan | Yes | GitHub repo scanner form + results |
| `/dashboard/scan/api` | API scan | Yes | URL prober form + results |
| `/dashboard/scan/deps` | Deps scan | Yes | Dependency scanner form + results |
| `/dashboard/history` | Scan history | Yes | List of past scans with status/findings |
| `/dashboard/settings` | Settings | Yes | Org settings, connected services |
| `/dashboard/billing` | Billing | Yes | Plan status, upgrade, manage subscription |

---

## File Structure

```
vibeshield-v2/src/
├── app/
│   ├── layout.tsx                          # Root layout (fonts, metadata)
│   ├── globals.css                         # Tailwind + CSS variables (dark theme)
│   ├── page.tsx                            # Landing page (public scan)
│   ├── auth/
│   │   ├── page.tsx                        # Login/signup with GitHub OAuth
│   │   └── callback/
│   │       └── route.ts                    # Supabase auth callback (already exists from Plan 3)
│   └── dashboard/
│       ├── layout.tsx                      # Dashboard shell (sidebar + main)
│       ├── page.tsx                        # Dashboard overview
│       ├── vulns/
│       │   └── page.tsx                    # Vulnerabilities list
│       ├── scan/
│       │   ├── code/page.tsx               # Code scanner
│       │   ├── api/page.tsx                # API scanner
│       │   └── deps/page.tsx               # Deps scanner
│       ├── history/
│       │   └── page.tsx                    # Scan history
│       ├── billing/
│       │   └── page.tsx                    # Billing & plan management
│       └── settings/
│           └── page.tsx                    # Settings
├── components/
│   ├── ui/
│   │   ├── badge.tsx                       # Severity badge (critical/high/medium/low)
│   │   ├── panel.tsx                       # Card container with optional title
│   │   ├── metric-card.tsx                 # Dashboard metric card
│   │   ├── spinner.tsx                     # Loading spinner
│   │   ├── btn.tsx                         # Button variants (default/primary/danger)
│   │   ├── empty.tsx                       # Empty state message
│   │   └── score-bar.tsx                   # Security score progress bar
│   ├── layout/
│   │   ├── sidebar.tsx                     # Navigation sidebar
│   │   └── page-header.tsx                 # Page title + subtitle pattern
│   ├── scan/
│   │   ├── scan-form.tsx                   # Reusable scan input form
│   │   ├── scan-results.tsx                # Scan results display
│   │   └── quick-text-scan.tsx             # Paste code/config scanner
│   ├── vulns/
│   │   ├── vuln-row.tsx                    # Single vulnerability row
│   │   ├── vuln-filters.tsx                # Status/severity/category filters
│   │   └── fix-panel.tsx                   # AI fix suggestion panel (before/after code)
│   └── auth/
│       └── auth-provider.tsx               # Supabase auth context provider
├── lib/
│   ├── supabase/
│   │   ├── client.ts                       # Browser Supabase client
│   │   ├── server.ts                       # (already exists from Plan 3)
│   │   └── middleware.ts                   # (already exists from Plan 3)
│   └── hooks/
│       ├── use-auth.ts                     # Auth state hook
│       ├── use-api.ts                      # API fetch wrapper with auth
│       └── use-realtime.ts                 # Supabase Realtime subscription for scan progress
└── middleware.ts                            # Next.js middleware — auth redirect logic
```

---

## Design System (Tailwind Config)

The dark theme from Juan's v1 translated to Tailwind CSS custom properties:

```
Colors:
  bg:      #08090b       (page background)
  surface: #0e1117       (cards, sidebar)
  surface2:#141720       (elevated surfaces)
  border:  #1c2030       (subtle borders)
  border2: #252c3e       (emphasized borders)
  text:    #bcc6d8       (body text)
  muted:   #4a5168       (secondary text)
  white:   #f0f4ff       (headings)
  red:     #f04444       (critical, primary accent)
  amber:   #f5a623       (high severity, warnings)
  green:   #22c55e       (success, resolved)
  blue:    #4f8ef7       (medium severity, info)
  purple:  #9b72f8       (accent)

Fonts:
  mono: 'IBM Plex Mono'  (body, code, UI)
  display: 'Cabinet Grotesk' (headings, scores)

Radius:
  sm: 6px   (buttons, inputs)
  lg: 10px  (cards, panels)
```

---

### Task 1: Tailwind Theme, Global Styles, Root Layout

**Files:**
- Modify: `src/app/globals.css` — dark theme CSS variables + Tailwind directives
- Modify: `src/app/layout.tsx` — fonts, metadata, body styles
- Modify: `tailwind.config.ts` — extend theme with custom colors

Set up the design system. Import IBM Plex Mono and Cabinet Grotesk via Google Fonts (use `next/font/google` for Cabinet Grotesk, fallback `next/font/local` or CDN for IBM Plex Mono if not available). Define all CSS custom variables matching Juan's theme. Add Tailwind theme extensions.

Add the keyframe animations from v1: `fadeIn`, `pulse`, `spin`.

Commit: `feat: set up dark theme, fonts, and Tailwind config`

---

### Task 2: UI Components

**Files:**
- Create: `src/components/ui/badge.tsx`
- Create: `src/components/ui/panel.tsx`
- Create: `src/components/ui/metric-card.tsx`
- Create: `src/components/ui/spinner.tsx`
- Create: `src/components/ui/btn.tsx`
- Create: `src/components/ui/empty.tsx`
- Create: `src/components/ui/score-bar.tsx`

Port Juan's UI components from inline-style JSX to Tailwind TypeScript components. Each should be a client component (`'use client'`) with typed props.

**Badge:** Severity-colored chip. Props: `variant: 'critical' | 'high' | 'medium' | 'low' | 'ok' | 'info'`, `children`.

**Panel:** Card container. Props: `title?: string`, `action?: ReactNode`, `children`, `className?`.

**MetricCard:** Dashboard stat card. Props: `label: string`, `value: string | number`, `sub?: string`, `color?: string`.

**Spinner:** Animated loading circle. Props: `size?: number`.

**Btn:** Button with variants. Props: `variant?: 'default' | 'primary' | 'danger'`, `small?: boolean`, `disabled?: boolean`, `onClick`, `children`.

**Empty:** Empty state placeholder. Props: `message?: string`.

**ScoreBar:** Security score progress bar. Props: `score: number`. Red <40, amber <70, green >=70.

Commit: `feat: add UI component library — badge, panel, metric-card, btn, spinner, score-bar`

---

### Task 3: Supabase Browser Client, Auth Provider, Middleware

**Files:**
- Create: `src/lib/supabase/client.ts` — browser-side Supabase client
- Create: `src/components/auth/auth-provider.tsx` — auth context with onAuthStateChange
- Create: `src/lib/hooks/use-auth.ts` — useAuth hook
- Create: `src/middleware.ts` — Next.js middleware for auth redirects

**Browser client** (`lib/supabase/client.ts`):
```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createSupabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
```

**Auth provider** — wraps the app, listens to `onAuthStateChange`, provides user/session/loading state via React context.

**useAuth hook** — `const { user, session, loading, signInWithGitHub, signOut } = useAuth()`

**Middleware** (`src/middleware.ts`):
- If user is not authenticated and tries to access `/dashboard/*`, redirect to `/auth`
- If user is authenticated and tries to access `/auth`, redirect to `/dashboard`
- Refresh Supabase session on every request (cookie-based)

Commit: `feat: add Supabase browser client, auth provider, and Next.js middleware`

---

### Task 4: Auth Page (GitHub OAuth)

**Files:**
- Create: `src/app/auth/page.tsx`
- Modify: `src/app/auth/callback/route.ts` — handle Supabase OAuth callback

**Auth page** — centered card with VibeShield logo, "Sign in with GitHub" button. On click, calls `supabase.auth.signInWithOAuth({ provider: 'github' })`. No email/password for MVP — GitHub only.

Design reference: Juan's AuthPage layout (centered card, logo, clean typography) but simplified to just GitHub OAuth.

After successful OAuth callback, call `POST /api/auth/callback` to create org if first login, then redirect to `/dashboard`.

Commit: `feat: add auth page with GitHub OAuth login`

---

### Task 5: Dashboard Layout (Sidebar + Shell)

**Files:**
- Create: `src/app/dashboard/layout.tsx` — sidebar + main content area
- Create: `src/components/layout/sidebar.tsx` — navigation sidebar
- Create: `src/components/layout/page-header.tsx` — reusable page title

**Dashboard layout** — flex container. Sidebar (200px fixed) on left, scrollable main content on right. Same structure as Juan's v1.

**Sidebar** — VibeShield logo, 3 nav sections (Overview, Scanners, Config) with active state indicators. Bottom section shows user email and logout button. Use `next/link` with `usePathname()` for active state.

Nav structure:
```
OVERVIEW
  Dashboard        /dashboard
  Vulnerabilities  /dashboard/vulns
  Scan history     /dashboard/history

SCANNERS
  Code scan        /dashboard/scan/code
  API scan         /dashboard/scan/api
  Dependencies     /dashboard/scan/deps

CONFIG
  Billing          /dashboard/billing
  Settings         /dashboard/settings
```

**PageHeader** — reusable component with uppercase subtitle + bold title. Props: `subtitle: string`, `title: string`, `action?: ReactNode`.

Commit: `feat: add dashboard layout with sidebar navigation`

---

### Task 6: Dashboard Overview Page

**Files:**
- Create: `src/app/dashboard/page.tsx`
- Create: `src/lib/hooks/use-api.ts` — API fetch wrapper

**API hook** — `useApi()` returns helpers that automatically include auth cookies:
```typescript
const api = useApi()
const { data } = await api.get('/api/vulns/summary')
const { data } = await api.post('/api/scans', { repo, ref, type: 'code' })
```

**Dashboard page** — client component that fetches:
- `GET /api/vulns/summary` — severity breakdown
- `GET /api/scans?limit=5` — recent scans
- `GET /api/org` — org details + plan

Displays:
1. Security score (calculated from summary, large number + ScoreBar)
2. Metric cards row: Critical, High, Medium, Low, Scans run
3. Quick scan input (auto-detect URL vs repo vs text, same as Juan's)
4. Recent vulnerabilities panel (top 5 open, sorted by severity)
5. Recent scans panel (last 5 scans with status badges)

Commit: `feat: add dashboard overview page with metrics and quick scan`

---

### Task 7: Vulnerabilities Page

**Files:**
- Create: `src/app/dashboard/vulns/page.tsx`
- Create: `src/components/vulns/vuln-row.tsx`
- Create: `src/components/vulns/vuln-filters.tsx`
- Create: `src/components/vulns/fix-panel.tsx`

**Vulns page** — fetches `GET /api/vulns` with filter params. Displays:
1. Severity summary cards (clickable to filter)
2. Filter bar: status tabs (open/resolved/ignored/all) + severity filter + category dropdown
3. Vuln list: expandable rows with severity dot, title, category badge, location, resolve/ignore buttons
4. When expanded: description, code snippet, fix suggestion
5. Fix panel: AI explanation + fix prompt with copy button (when available)

**VulnRow** — expandable row. Click to expand/collapse. Resolve/ignore buttons call `PATCH /api/vulns/:id/resolve` or `/ignore`.

**VulnFilters** — status tabs + severity + category select. Updates URL search params.

**FixPanel** — shows AI explanation (if available) + fix prompt with "Copy to clipboard" button. If no AI data, shows the regex-generated fix suggestion. Design inspired by Juan's FixPanel (vulnerable vs fixed code blocks).

Commit: `feat: add vulnerabilities page with filters, fix panel, and resolve/ignore actions`

---

### Task 8: Scan Pages (Code, API, Deps)

**Files:**
- Create: `src/app/dashboard/scan/code/page.tsx`
- Create: `src/app/dashboard/scan/api/page.tsx`
- Create: `src/app/dashboard/scan/deps/page.tsx`
- Create: `src/components/scan/scan-form.tsx`
- Create: `src/components/scan/scan-results.tsx`
- Create: `src/components/scan/quick-text-scan.tsx`

**ScanForm** — reusable form component. Props: `mode: 'code' | 'api' | 'deps'`. Configures input labels, placeholders, and API call based on mode:
- Code: repo input + branch input → `POST /api/scans { type: 'code', repo, ref }`
- API: URL input → `POST /api/scans { type: 'api', repo: url }`
- Deps: repo input → `POST /api/scans { type: 'deps', repo }`

**ScanResults** — displays results after scan: files scanned, total findings, critical/high counts, finding list with severity dots.

**QuickTextScan** — textarea for pasting code/config. Shown on code scan page only. Calls `POST /api/scans { type: 'text' }`.

Each scan page: PageHeader + ScanForm + (code only: QuickTextScan) + ScanResults.

Commit: `feat: add scan pages — code, API, dependencies with results display`

---

### Task 9: Scan History Page

**Files:**
- Create: `src/app/dashboard/history/page.tsx`

Fetches `GET /api/scans?limit=50`. Displays a table/list:
- Type badge (colored by scan type)
- Target (repo or URL)
- Findings count
- Status dot (complete/failed/running)
- Timestamp
- Score (A-F badge)

Commit: `feat: add scan history page`

---

### Task 10: Billing Page

**Files:**
- Create: `src/app/dashboard/billing/page.tsx`

Fetches `GET /api/billing`. Displays:
1. Current plan (trial/free/pro) with badge
2. Trial scans remaining (if on trial)
3. "Upgrade to Pro" button → calls `POST /api/billing` → redirects to Stripe Checkout URL
4. "Manage subscription" button (if pro) → calls `POST /api/billing/portal` → redirects to Stripe Portal
5. Plan comparison table (Free vs Pro features)

Commit: `feat: add billing page with Stripe checkout and portal`

---

### Task 11: Settings Page

**Files:**
- Create: `src/app/dashboard/settings/page.tsx`

Simple settings page:
1. Organization name (read-only for now)
2. Plan status (links to billing)
3. Connected services status (GitHub token configured? Slack webhook configured? — reads from `/health` or similar)

Commit: `feat: add settings page`

---

### Task 12: Landing Page (Public Scan)

**Files:**
- Modify: `src/app/page.tsx` — replace Next.js default with landing page

The hook page. No auth required. Contains:
1. Hero section: VibeShield logo + tagline ("Security for vibe-coded apps")
2. Single input: "Paste your GitHub repo URL" + "Scan" button
3. Calls `POST /api/scan-public` → shows score (A-F) + severity summary
4. Results are gated: "Sign up to see detailed findings" CTA
5. Below the fold: brief feature list, "How it works" steps

This page should be server-rendered for SEO (the form is a client component island).

Commit: `feat: add landing page with public scan and signup CTA`

---

### Task 13: Realtime Scan Progress

**Files:**
- Create: `src/lib/hooks/use-realtime.ts`

Hook that subscribes to Supabase Realtime for scan progress updates:
```typescript
function useScanProgress(scanId: string | null) {
  // Subscribe to postgres_changes on scans table filtered by id
  // Returns { status, progress, score, summary }
  // Falls back to polling if Realtime disconnects
}
```

Wire into scan pages — after triggering a scan, show live progress (fetching → scanning → analyzing → complete).

Commit: `feat: add realtime scan progress via Supabase subscriptions`

---

### Task 14: Build Verification and Polish

- [ ] Run `npm run build` — verify full Next.js build succeeds
- [ ] Run `npm test` — verify all 49+ tests still pass
- [ ] Run `npx tsc --noEmit` — zero type errors
- [ ] Manual smoke test: navigate all pages, verify no console errors
- [ ] Push to `main-v2`

Commit: `chore: frontend build verification and polish`

---

## Summary

After completing this plan:

**14 tasks producing:**
- 1 landing page (public scan, SEO-optimized)
- 1 auth page (GitHub OAuth)
- 7 dashboard pages (overview, vulns, 3 scan types, history, billing, settings)
- 12+ reusable components (UI kit, scan components, vuln components)
- Auth system (Supabase SSR, middleware redirects, session management)
- Realtime scan progress
- Dark theme design system via Tailwind

**The complete MVP is functional end-to-end:**
User lands → scans a public repo → sees score → signs up → gets 3 free full scans with AI analysis → upgrades via Stripe → unlimited scans.

**Next:** Deploy (Vercel + Supabase + Firebase Cloud Functions)
