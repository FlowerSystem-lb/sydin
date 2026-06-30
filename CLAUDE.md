# CLAUDE.md — SydIN

SydIN is a modern **Inventory & Asset Management SaaS**. It should feel like a premium
inventory operating system — clean, compact, fast, smooth, clickable, visual, professional,
easy to use — **not** a legacy ERP. Design inspiration: Sortly (visual inventory), Linear
(speed/interaction polish), Stripe (premium SaaS quality), Notion (flexible organization),
Shopify (operational workflows).

## Read these first

Every session, before doing work, read the project brain in `docs/`:

- [docs/SYDIN_PRODUCT_BRAIN.md](docs/SYDIN_PRODUCT_BRAIN.md) — what SydIN is, architecture, current state.
- [docs/SYDIN_ROADMAP.md](docs/SYDIN_ROADMAP.md) — the 5-phase master roadmap + founder feature ideas.
- [docs/SYDIN_SPRINT_LOG.md](docs/SYDIN_SPRINT_LOG.md) — what each sprint changed (append-only history).
- [docs/SYDIN_UI_RULES.md](docs/SYDIN_UI_RULES.md) — required page anatomy, visual style, motion, components to reuse.

After completing a sprint, **append** a new entry to `docs/SYDIN_SPRINT_LOG.md`.

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
