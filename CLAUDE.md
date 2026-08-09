# CLAUDE.md — SydIN

SydIN is a modern **Inventory & Asset Management SaaS**. It should feel like a premium
inventory operating system — clean, compact, fast, smooth, clickable, visual, professional,
easy to use — **not** a legacy ERP. Design inspiration: Sortly (visual inventory), Linear
(speed/interaction polish), Stripe (premium SaaS quality), Notion (flexible organization),
Shopify (operational workflows).

## Read these first

Every session, before doing work, read the **core** project brain in `docs/`:

- [docs/SYDIN_PRODUCT_BRAIN.md](docs/SYDIN_PRODUCT_BRAIN.md) — what SydIN is, architecture, current state.
- [docs/SYDIN_ROADMAP.md](docs/SYDIN_ROADMAP.md) — the 5-phase master roadmap + immediate sprint sequence.
- [docs/SYDIN_SPRINT_LOG.md](docs/SYDIN_SPRINT_LOG.md) — what each sprint changed (append-only history).
- [docs/SYDIN_UI_RULES.md](docs/SYDIN_UI_RULES.md) — required page anatomy, visual style, motion, components to reuse.
- [docs/SYDIN_FOUNDER_OPERATING_MANUAL.md](docs/SYDIN_FOUNDER_OPERATING_MANUAL.md) — **who Sayed is and how to work with him. Read before giving any instructions.**

Before planning **major work** (new modules, a new sprint, features, strategy), also read the
relevant deep-context docs:

- [docs/SYDIN_FEATURE_BACKLOG.md](docs/SYDIN_FEATURE_BACKLOG.md) — prioritized backlog (P0–P3, impact, difficulty, deps).
- [docs/SYDIN_MODULE_ARCHITECTURE.md](docs/SYDIN_MODULE_ARCHITECTURE.md) — module map + cross-module flows.
- [docs/SYDIN_PRODUCT_PRINCIPLES.md](docs/SYDIN_PRODUCT_PRINCIPLES.md) — decision rules + Feature Review Template.
- [docs/SYDIN_DECISION_LOG.md](docs/SYDIN_DECISION_LOG.md) — settled decisions (don't re-litigate).
- [docs/SYDIN_MOBILE_ROADMAP.md](docs/SYDIN_MOBILE_ROADMAP.md) — mobile is a first-class, scan-first product.
- [docs/SYDIN_MARKETING_LAUNCH_PLAN.md](docs/SYDIN_MARKETING_LAUNCH_PLAN.md) — positioning, launch, content.
- [docs/SYDIN_PAYMENTS_STRATEGY.md](docs/SYDIN_PAYMENTS_STRATEGY.md) — billing approach + provider research.

After completing a sprint, **append** a new entry to `docs/SYDIN_SPRINT_LOG.md`, and record
notable choices in `docs/SYDIN_DECISION_LOG.md`.

## Founder & working style

You work with **Sayed**, a solo, student founder who is **not** a professional programmer.
Give plain, numbered, step-by-step instructions (where to click, what command to run, what to
send back, what not to touch). Be helpful **and strict** — don't rubber-stamp bad/early/costly
ideas. **Never** ask him to paste secrets (API keys, passwords, Supabase service-role keys,
card details, customer data). Full guidance: [docs/SYDIN_FOUNDER_OPERATING_MANUAL.md](docs/SYDIN_FOUNDER_OPERATING_MANUAL.md).

## Tech stack (verified)

- **Next.js 16.2.6** (App Router) · **React 19.2.4** · **TypeScript 5** · **Tailwind CSS v4**
- **Supabase** (`@supabase/ssr`, `@supabase/supabase-js`) — auth (email/password OTP, Google, Microsoft/Azure) + database
- `@zxing/browser` (barcode/QR scanning), `react-qr-code` (QR), `jspdf` + `jspdf-autotable` (PDF), `papaparse` (CSV), `exceljs` (Excel)
- App code in `app/`, shared React in `components/`, helpers in `app/lib/`, SQL migrations in `sql/`.

## Where things live

- **Shared dashboard UI primitives are ALL exported from one file:** [components/dashboard/Workspace.tsx](components/dashboard/Workspace.tsx)
  (`DashboardPageShell`, `DashboardPageHeader`, `DashboardCard`, `DashboardToolbar`,
  `FilterBar`, `FilterChip`, `DashboardNotice`, `ActionButton`, `MetricCard`,
  `LoadingSkeletonGroup`, `DashboardEmptyState`, `DashboardTable`, `DashboardListRow`,
  `DashboardFormSection`). Import these instead of rebuilding.
- Generic UI kit in [components/ui/](components/ui/) (`Button`, `Card`, `Badge`, `Field`, `Select`, `Overlay`, `Tooltip`, `State`, `IconButton`, `Headers`).
- Dashboard pages under `app/dashboard/<route>/page.tsx`; shell/nav in [components/dashboard/DashboardShell.tsx](components/dashboard/DashboardShell.tsx) and [components/dashboard/navigation.ts](components/dashboard/navigation.ts).
- Global styles in [app/globals.css](app/globals.css) — **large file (~15k lines)**. Inventory-specific rules are appended and scoped to `.inventory-workspace`.

## Critical engineering rules

**Never modify unless the user explicitly asks:**
authentication · Supabase integration · database schema · routing · business logic · existing working behavior.

- Preserve existing functionality. Default to UI/UX polish, reusable components, layout consistency, accessibility, responsiveness, subtle motion, translation-ready structure.
- Do **not** add backend features unless a sprint explicitly asks for them.
- Only create a new component when repeated UI clearly deserves abstraction — otherwise reuse the primitives above.
- Follow [docs/SYDIN_UI_RULES.md](docs/SYDIN_UI_RULES.md) for every page.

## Verification (run before declaring a sprint done)

```bash
npm run lint
npx tsc --noEmit
npm run build
```

All three must pass.

## Current branch

`uiux-light-liquid-glass-redesign` (main branch: `main`).

## Claude Code agent setup (2026-08-09 audit)

- **[.claude/agents/sydin-ui.md](.claude/agents/sydin-ui.md)** — a UI/UX-scoped subagent for
  SydIN dashboard work. Hard-codes the doc-reading order, the untouchables, component reuse, the
  `@container`-vs-`@media` rule, and the verification gate, so those don't have to be re-explained
  every session. Invoke via the Agent tool for focused UI implementation/review; the main session
  should apply the same rules directly for everyday work.
- **`/sprint-start`** ([.claude/commands/sprint-start.md](.claude/commands/sprint-start.md)) —
  runs the Founder Operating Manual's pre-sprint checklist (clean git status, correct branch, docs
  read, Plan Mode for risky work).
- **`/sprint-done`** ([.claude/commands/sprint-done.md](.claude/commands/sprint-done.md)) — runs
  the post-sprint checklist (verification gate, UI rules review, drafts the sprint log + decision
  log entries). Does not auto-commit.

**Deliberately not installed:** generic marketplace "frontend-design", "motion/animation",
"accessibility", or "feature-dev" skills. SydIN's own docs (`SYDIN_UI_RULES.md`,
`SYDIN_PRODUCT_PRINCIPLES.md`, `SYDIN_DECISION_LOG.md`) already cover this ground more precisely
than a generic skill would, and a generic skill risks quietly disagreeing with a decision already
recorded in the decision log. If UI/UX capability ever feels insufficient, extend
`sydin-ui.md` or the docs it points to — don't bolt on an unrelated marketplace skill.
