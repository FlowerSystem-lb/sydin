# SydIN — Product Brain

The single source of truth for *what SydIN is* and *what state it's in*. Read this before
any work. Keep it current when the product's identity or state materially changes.

---

## 1. Product identity

SydIN is a modern **Inventory & Asset Management SaaS**.

Inspired by:

- **Sortly** — simplicity and visual inventory
- **Linear** — speed and interaction polish
- **Stripe** — premium SaaS quality
- **Notion** — organization and flexible workspace structure
- **Shopify** — operational workflows

SydIN must **not** feel like an old ERP. It should feel like a premium inventory operating
system: clean, compact, fast, smooth, clickable, visual, professional, easy to use.

---

## 2. Architecture (verified)

- **Framework:** Next.js 16.2.6, App Router, React 19.2.4, TypeScript 5.
- **Styling:** Tailwind CSS v4 + a large global stylesheet at `app/globals.css` (~15k lines).
- **Backend:** Supabase — `@supabase/ssr` + `@supabase/supabase-js`.
  - Auth: email/password (numeric email OTP verification), Google OAuth, Microsoft/Azure OAuth. Enterprise SSO intentionally not configured.
- **Key libraries:** `@zxing/browser` (scanning), `react-qr-code` (QR), `jspdf` + `jspdf-autotable` (PDF export), `papaparse` (CSV), `exceljs` (Excel export).

### Directory map

| Path | Purpose |
|------|---------|
| `app/` | Routes (App Router). Marketing/auth pages at root; product under `app/dashboard/`. |
| `app/dashboard/<route>/page.tsx` | Individual dashboard workspaces. |
| `app/lib/` | Data/helpers: `supabase.ts`, `categories.ts`, `depots.ts`, `suppliers.ts`, `stockMovements.ts`, `inventoryItemModel.ts`, `inventoryImport.ts`, `inventoryReports.ts`, PDF/Excel exporters, `subscription.ts`, `businessSettings.ts`, etc. |
| `app/api/` | Route handlers (admin plan activation / plan requests). |
| `components/dashboard/Workspace.tsx` | **All shared dashboard UI primitives** (see §4). |
| `components/dashboard/DashboardShell.tsx`, `navigation.ts` | App shell + nav model. |
| `components/ui/` | Generic UI kit (Button, Card, Badge, Field, Select, Overlay, Tooltip, State, IconButton). |
| `components/inventory/` | Inventory-specific components (item card, details slide-over, stock movement dialog). |
| `sql/` | SQL migrations (suppliers, categories, pick-lists). |

---

## 3. Current product state

### Approved foundation (built, migrated to shared system)

Dashboard · Inventory foundation · Settings Control Center · Import Inventory foundation ·
QR Center foundation · Receiving foundation · Purchase Orders foundation ·
Stock Counts foundation · Depots foundation · Suppliers foundation · Reports foundation ·
Stock Movements foundation.

### Needs future polish

Inventory CSS stabilization · Categories workspace · Item details · Add/Edit Item UX ·
QR & Labels full module · Scanner workspace · Activity feed · Notifications center.

### Known risks / debt

- Inventory-specific CSS is appended in `app/globals.css`, scoped to `.inventory-workspace`.
  It should later be stabilized or moved closer to the component/module level
  (planned as **Sprint 3B — Inventory CSS Stabilization**, see roadmap & sprint log).
- `app/globals.css` is very large; treat edits there carefully and keep new rules scoped.

---

## 4. Shared dashboard primitives

All exported from **`components/dashboard/Workspace.tsx`**. Always prefer these:

`DashboardPageShell` · `DashboardPageHeader` · `DashboardCard` · `DashboardToolbar` ·
`FilterBar` · `FilterChip` · `DashboardNotice` · `ActionButton` · `MetricCard` ·
`LoadingSkeletonGroup` · `DashboardEmptyState` · `DashboardTable` · `DashboardListRow` ·
`DashboardFormSection`.

Only create a new component when repeated UI clearly deserves abstraction.

---

## 5. Critical engineering rules

**Never modify unless explicitly requested:** authentication · Supabase integration ·
database schema · routing · business logic · existing working behavior.

- Preserve existing functionality at all times.
- Prefer: UI/UX polish, reusable components, layout consistency, accessibility,
  responsiveness, subtle motion, translation-ready structure.
- Do **not** add backend features unless a sprint explicitly asks.

## 6. Verification gate

Before declaring any sprint complete: `npm run lint`, `npx tsc --noEmit`, `npm run build` — all must pass.
