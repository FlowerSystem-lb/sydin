# SydIN — Sprint Log

Append-only history of what each sprint changed. Newest entries go at the **bottom**.
After completing a sprint, add an entry here with: scope, files changed, what was migrated/
added, verification result, and any risks left behind.

---

## Sprint 1 — UI Foundation  *(Completed)*

Created the shared dashboard foundation and reusable UI primitives.

**Added / improved:** `DashboardPageShell`, `DashboardPageHeader`, `DashboardCard`,
`DashboardToolbar`, `FilterBar`, `FilterChip`, `DashboardNotice`, `ActionButton`,
`MetricCard`, `LoadingSkeletonGroup`, `DashboardEmptyState`.

**Migrated:** Depots · Suppliers · Stock Movements · Reports.

**Verification:** `npm run lint`, `npx tsc --noEmit`, `npm run build` — passed.

---

## Sprint 2 — Dashboard Foundation Migration  *(Completed & approved)*

High-impact pages moved onto the shared foundation.

**Changed files:**
`components/dashboard/Workspace.tsx` · `app/globals.css` ·
`app/dashboard/receiving/page.tsx` · `app/dashboard/purchase-orders/page.tsx` ·
`app/dashboard/stock-counts/page.tsx` · `app/dashboard/qr-center/page.tsx` ·
`app/dashboard/inventory/import/page.tsx` · `app/dashboard/settings/page.tsx` ·
`app/dashboard/inventory/page.tsx` · `app/dashboard/categories/page.tsx`.

**Added / improved:** `DashboardTable`, `DashboardListRow`, `DashboardFormSection`,
shared table wrappers, shared list-row styling, shared form-section styling,
responsive overflow, row hover motion, skeleton states.

**Migrated:** Receiving · Purchase Orders · Stock Counts · QR Center ·
Import header/step shell · Settings · Inventory notices · Categories notices.

**Verification:** `npm run lint`, `npx tsc --noEmit`, `npm run build` — passed.

**Note:** Approved as foundation migration, **not** final product UX.

---

## Sprint 3 — Inventory Workspace Deep Polish  *(Completed & approved)*

**Changed files:** `app/dashboard/inventory/page.tsx` · `app/globals.css`.

**Improvements:**
- Reduced duplicate Inventory metrics; kept only 3 key summary metrics: **Items**, **Stock units**, **Needs attention**.
- Made item browsing the primary focus.
- Improved item grid/card sizing.
- Moved low-stock insights into a secondary right rail.
- Improved item card hover, spacing, image proportions, and metadata.
- Improved empty state with **Add Item**, **Import Inventory**, and **Scan item** actions.
- Preserved Import/Export actions in the **More** dropdown.
- Preserved existing inventory behavior.

**Verification:** `npm run lint`, `npx tsc --noEmit`, `npm run build` — passed.

**Risks:**
- Inventory-specific CSS is still appended in `app/globals.css`, scoped to `.inventory-workspace`.
- Inventory CSS should later be stabilized / moved closer to component/module level → **Sprint 3B**.

---

## Sprint 3B — Inventory CSS Stabilization  *(Completed)*

Reduced CSS risk/cascade debt around the approved Sprint 3 Inventory UI **without changing
the design or any behavior**. Conservative approach (annotate in place + remove only
provably-dead CSS); no rules were relocated, so the cascade — and the rendered output — is
unchanged.

**Changed files:** `app/globals.css` (only).

**Added (navigation, zero cascade impact):**
- A top **index/map comment** above the first inventory cluster documenting the inventory CSS
  layers in cascade order and warning not to reorder them (Sprint 3 polish must stay last).
- Searchable `/* ===[ INVENTORY: <label> ]=== */` **section banners** at the major layer
  boundaries: base layout & components, glass theme, hero/toolbar/item-card components,
  light theme overrides, overview shared layer, dashboard shell scoping / overflow repair,
  and Sprint 3 polish (marked as the required last layer).

**Removed (provably-dead — confirmed in zero `.ts/.tsx` repo-wide):** the abandoned inventory
"overview/context" design direction —
`inventory-context-panel`, `inventory-context-header(+span/button)`, `inventory-context-section*`,
`inventory-context-link`, `inventory-context-item-active`, `inventory-filter-section*`,
`inventory-view-toggle(+button/-active)`, `inventory-item-group(+header)`,
`inventory-table-group-row*`, `inventory-group-stack`. Deleted one large contiguous block plus
several `display:none`/responsive rules, and surgically stripped these dead tokens out of
selector lists shared with **live** `.sydin-overview*` / `.settings-*` siblings (siblings left
intact). Net ~165 fewer lines (≈196 CSS lines removed, ~31 lines of comments added);
`app/globals.css` 15,672 → 15,507 lines.

**Explicitly preserved (untouched):** `.inventory-action-primary` (live), all `.sydin-overview*`
and `.settings-*` rules, and `sydin-overview-header-actions` (live in `app/dashboard/page.tsx`).

**Approved Sprint 3 UI preserved:** wider item cards · 3-metric summary · primary item-browsing
layout · secondary insights rail · search/filter toolbar · More dropdown · desktop/tablet/mobile.

**Verification:** `npm run lint` ✅ · `npx tsc --noEmit` ✅ · `npm run build` ✅ (all 30 routes
generated, incl. `/dashboard/inventory` and `/dashboard`). Brace balance verified (2241/2241).
Dead-token grep over `app/globals.css` returns zero matches.

**Risks / follow-ups:**
- No automated visual-regression tooling exists; `lint`/`tsc`/`build` cannot prove "visually
  identical." The no-move/annotate-only + dead-only-removal strategy makes regression highly
  unlikely, but a **manual visual pass** on `/dashboard/inventory` (desktop/tablet/mobile) and
  `/dashboard` is still recommended before sign-off.
- Inventory CSS is now navigable but still **interleaved** with `.sydin-overview`/`.settings-*`
  across the file. A deeper refactor (extract to a co-located `@layer` module to dedupe theme
  layers) remains valuable but is its own larger sprint — defer until Phase 1 foundation closes.

---

## Project Brain Expansion — Documentation Sprint  *(Completed)*

Documentation/project-memory only. **No application code, UI, auth, Supabase, schema, routing,
or business logic was changed.**

**Created (8 new docs):**
- `docs/SYDIN_FEATURE_BACKLOG.md` — prioritized backlog (P0–P3, impact, difficulty, phase, deps).
- `docs/SYDIN_MODULE_ARCHITECTURE.md` — module map, file locations, cross-module flows.
- `docs/SYDIN_PRODUCT_PRINCIPLES.md` — product principles, decision rules, Feature Review Template.
- `docs/SYDIN_DECISION_LOG.md` — append-only decision record (seeded with decisions to date).
- `docs/SYDIN_MOBILE_ROADMAP.md` — mobile as a first-class, scan-first product.
- `docs/SYDIN_FOUNDER_OPERATING_MANUAL.md` — founder context + how to coach Sayed + security rules.
- `docs/SYDIN_MARKETING_LAUNCH_PLAN.md` — positioning, launch phases, content, checklist.
- `docs/SYDIN_PAYMENTS_STRATEGY.md` — billing approach (manual approval first), provider research, cost discipline.

**Updated (5 docs):**
- `CLAUDE.md` — links to all new docs (core vs read-before-major-work), founder & working-style section.
- `docs/SYDIN_PRODUCT_BRAIN.md` — long-term vision + index pointer to the expanded brain.
- `docs/SYDIN_ROADMAP.md` — Phase 1 status marks; replaced stale "Sprint 3B next" with the
  Sprint 4–12 sequence; slimmed the duplicated feature-ideas section to point at the backlog.
- `docs/SYDIN_SPRINT_LOG.md` — this entry.
- `docs/SYDIN_UI_RULES.md` — cross-links to product principles + mobile roadmap.

**Goal:** make the repo the permanent source of truth — full vision, founder context, roadmap,
backlog, module architecture, principles, decision rules, mobile, marketing, and payments — so
future Claude Code / Claude Project sessions can plan correctly from a cold start.

**Verification:** N/A (docs only — no `lint`/`tsc`/`build` impact). All internal doc links use
relative paths.

**Next:** Sprint 4 — Categories Workspace Polish (see [SYDIN_ROADMAP.md](SYDIN_ROADMAP.md)).

---

## Sprint 4 — Categories Workspace Polish  *(Completed & approved)*

**Changed files:** `app/dashboard/categories/page.tsx` · `app/globals.css`.

**Scope:**
- Adopted the shared dashboard **state primitives** (loading / empty / notice states) on the
  Categories workspace for consistency with the rest of the dashboard.
- Swapped bespoke buttons over to the shared **`ActionButton`** primitive.
- Added scoped **`.organize-categories`** CSS polish in `app/globals.css` (kept scoped to the
  Categories workspace so it does not affect other pages' cascade).

**Verification:** `npm run lint` ✅ · `npx tsc --noEmit` ✅ · `npm run build` ✅ — all passed.

**Untouchables:** No untouchables were modified — authentication, Supabase integration,
database schema, routing, and existing business logic were all left unchanged.

---

## Mobile Scroll Fix — Dashboard & Inventory  *(Completed & confirmed)*

**Scope:** Fixed the mobile scroll trap on `/dashboard` and `/dashboard/inventory` — at mobile
width (~390px) the page could not scroll to the bottom (mouse wheel and arrow keys did nothing).
`/dashboard/settings` was unaffected and kept working throughout.

**Root cause:** `overscroll-behavior: contain` on `.dashboard-shell-content` (in the
`:has(.dashboard-overview)` and `:has(.inventory-workspace)` mobile blocks). On mobile the shell
grew to `height: auto` / `overflow: visible`, so `.dashboard-shell-content` became an
`overflow-y: auto` container with **zero scroll range** (its `scrollHeight === clientHeight`).
A zero-range scroll container with `overscroll-behavior: contain` **absorbs** the wheel/keys and
**refuses to chain** the scroll up to `<html>` — which is the only element with real scroll range
(document `scrollHeight` ≈ 2799/3338 vs 844 viewport). Settings scrolled fine because its content
region uses `overscroll-behavior: auto` (chains to the document). Confirmed via a **live CDP wheel
test** (synthetic `mouseWheel` → measured `document.scrollingElement.scrollTop`):
before fix `/dashboard` and `/dashboard/inventory` moved `0 → 0`; after fix `0 → 988` and
`0 → 900`; `/dashboard/settings` `0 → 787` before and after.

**Fix:** Changed `overscroll-behavior: contain` → `auto` on **only** those two scoped rules
(`.dashboard-shell-content:has(.dashboard-overview)` and
`.dashboard-shell-content:has(.inventory-workspace)`). No `.settings-workspace` rule and no
desktop (`≥900px`) block was touched.

**Changed files:** `app/globals.css` (only).

**Two earlier missed attempts (recorded so future sessions don't repeat them):**
1. *Static-analysis pass* edited what looked like the culprits — `.dashboard-overview`
   `overflow-x: hidden` → `clip`, and the inventory shell block (`height: 100svh; overflow: hidden`
   → `auto`/`visible`). These were **not the winning declarations**, so scroll stayed broken. (The
   `overflow-x` change was also silently defeated at runtime by an `overflow-x: hidden !important`
   rule on the same elements, which — via the CSS one-axis rule — keeps `overflow-y` computed as
   `auto`.)
2. Only a **live computed-style + wheel test** (headless Chrome over the DevTools Protocol at
   390px, with a dummy local session injected to mount the auth-gated shell) revealed the actual
   winning rule was `overscroll-behavior: contain`, not any `overflow`/`height` declaration.
   Lesson: for cascade bugs in this ~15k-line stylesheet, verify the **computed** value and the
   **matched winning rule**, don't trust source-order reasoning alone.

**Verification:** live CDP wheel test (both pages scroll, Settings unaffected) ✅ ·
`npm run lint` ✅ · `npx tsc --noEmit` ✅ · `npm run build` ✅ (30/30 routes).

**Untouchables:** No authentication, Supabase, schema, routing, or business logic changed.

---

## Categories Sidebar Navigation  *(Completed & confirmed)*

**Scope:** Added **Categories** to the main dashboard navigation. Previously the Categories
workspace was only reachable indirectly (via **Add Item → Manage Categories**); it now has a
first-class nav entry.

**Change:** One `DashboardNavigationItem` added to `DASHBOARD_NAVIGATION` — `label: "Categories"`,
`href: "/dashboard/categories"`, `icon: "categories"`, `section: "organize"` (next to Depots),
`mobilePlacement: "more"` (no `shortLabel`, matching the Depots pattern). Renders automatically in
the desktop sidebar (Organize group) and the mobile **More** sheet; active-state highlighting is
handled generically by the existing `isDashboardRouteActive`.

**File changed:** `components/dashboard/navigation.ts` (only).

**Verification:** `npm run lint` ✅ · `npx tsc --noEmit` ✅ · `npm run build` ✅ (30/30 routes) ·
visual confirm — appears in the desktop sidebar and the mobile More sheet under Organize, next to
Depots, with active-state highlighting.

**Note:** No routing, auth, Supabase, or business logic touched — the `/dashboard/categories`
route already existed (polished in Sprint 4); this only surfaces it in the nav data.

---

## Sprint 5 — Item Details Slide-Over Polish  *(Completed & approved)*

**Scope:** Polished the item quick-view **slide-over** ([components/inventory/ItemDetailsSlideOver.tsx](../components/inventory/ItemDetailsSlideOver.tsx))
— presentation only, aligned to the light "liquid glass" theme, with custom state markup
swapped to the shared dashboard primitives. No behavior change.

**Changes:**
- **Loading** → `LoadingSkeletonGroup` (replaced three custom skeleton `<div>`s).
- **Notices** → `DashboardNotice` for both the error (`tone="danger"`) and the refresh/success
  (`tone="success"`) states, replacing the inline `.item-details-alert*` pills.
- **Empty states** → `DashboardEmptyState` for a new polished **"Item not found"** state (with a
  **Back to inventory** `ActionButton` wired to the existing close handler) and the Activity tab's
  **"No stock movements yet"**.
- **Theme alignment** → submit button + input focus ring moved from generic cyan/indigo/violet to
  the **brand gradient** (`#10c4dc → #2563eb → #7d5cff`) and brand-blue focus ring; softer panel
  shadow, softer card radii + subtle 1px elevation; header controls gained resting/hover shadow.
- **Cleanup** → retired now-dead `.item-details-alert*` and custom `.item-details-loading` skeleton
  CSS plus the unused `@keyframes item-details-skeleton`; kept `.item-details-form-error` (movement
  quick-form) and `.item-details-empty` (Alerts footnote). CSS edited in place under a labeled
  Sprint 5 banner; the 900px/640px responsive tuning is unchanged.

**Decision noted:** the header **Edit** and **overflow-menu** buttons were kept as the tuned custom
controls (NOT swapped to `ActionButton`) to preserve their mobile-header responsive behavior — Edit
collapses to icon-only at 640px, the close button hides, and the back button appears. Swapping would
have regressed that.

**Deferred:** the full item page (`app/dashboard/inventory/[id]`) is intentionally left for
**Sprint 5B** — this sprint touched the slide-over only.

**Files changed:** `components/inventory/ItemDetailsSlideOver.tsx` · `app/globals.css` (the
`.item-details-*` scoped section only).

**Verification:** `npm run lint` ✅ · `npx tsc --noEmit` ✅ · `npm run build` ✅ (30/30 routes) ·
visual review of all three tabs (Details / Activity / Alerts) on desktop and mobile.

**Untouchables:** No data loading, stock-movement, history, edit/delete, routing, auth, or
subscription logic was touched, and the `onItemUpdated(item, movement)` callback contract and the
slide-over's `body.style.overflow` scroll-lock are unchanged.

---

## Sprint 5B — Item Details Full Page Polish  *(Completed & approved)*

**Scope:** Token-alignment / color-only polish of the full item details page
([app/dashboard/inventory/[id]/page.tsx](../app/dashboard/inventory/[id]/page.tsx)), aligned to
the light "liquid glass" theme. Pairs yesterday's slide-over work (Sprint 5) so both item views
match. Presentation only — no behavior change.

**Changes:**
- **Primary buttons** → 4 dark `bg-white`/`text-black`/`hover:bg-slate-200` buttons (header **Edit
  Item**, error-state **Back to Inventory**, **Download QR**, Record-Movement **submit**) swapped to
  the light-theme **brand gradient** (`#10c4dc → #2563eb 58% → #7d5cff`, white text, brand-blue
  shadow, `hover:brightness-110`). Applied inline rather than via `ActionButton` so each keeps its
  sibling-matched radius/padding/text-size.
- **Theme tokens** → `text-slate-200` → `text-theme-primary` (Before/Old-qty numbers + zero-delta
  branch); `text-red-300` → `text-theme-danger` (Low-Stock badge, Delete eyebrow);
  `text-emerald-300` → `text-theme-success` (both Stock-activity eyebrows); DetailCard
  `text-violet-100` → `text-theme-accent`.
- **Loading skeleton** → re-skinned via **`LoadingSkeletonGroup`** (replaced the dark shimmer +
  `rgba(0,0,0,0.28)` panels), preserving the 2-column layout with the shared light shimmer.
- **Shadows normalized** → oversized dark shadows (`rgba(0,0,0,0.28–0.6)` on the error panel, both
  large modals, and the delete dialog) brought down to the page's light scale
  `shadow-[0_14px_42px_rgba(15,23,42,0.12)]`.
- **Placeholders** → image-empty placeholder (`border-slate-300/35 bg-white/35` →
  `border-theme bg-theme-surface`) and the QR card's `rgba(255,255,255,…)` shadow fixed to the
  light scale.

The 3 inline modals (Movement / Edit / Delete) got classname/color changes only — `onSubmit`,
validation, and the `closeX(force)` guards were untouched.

**Explicitly deferred (flagged, not done — both are refactors, out of scope for a polish sprint):**
- Unifying the local `DetailCard` with the slide-over's version.
- Adopting the shared `StockMovementDialog` for the page's inline movement modal.

**Files changed:** `app/dashboard/inventory/[id]/page.tsx` (only). No `app/globals.css` change was
needed — the shared `LoadingSkeletonGroup` already carries the light shimmer.

**Verification:** `npm run lint` ✅ · `npx tsc --noEmit` ✅ · `npm run build` ✅ (30/30 routes) ·
visual review of the full page at `/dashboard/inventory/[id]` on **desktop + mobile** (buttons, QR
card, Stock Movements empty state, and Item History numbers all correctly light-themed and readable).

**Untouchables:** No data loading, stock-movement, history, edit/delete handler logic, routing, the
`action=edit|stock|delete` query-param handling, auth, Supabase, or subscription logic was touched.

---

## Sprint 6 — Add/Edit Item UX Polish  *(Completed & approved)*

**Scope:** Full **brand alignment** of the item **write** surfaces — the Add Item flow and the
shared Edit form — completing the light "liquid glass" pass started for the read surfaces in
Sprints 5 / 5B. Presentation / token-alignment only; no behavior change.

**Changes:**
- **EditItemForm Save button** → swapped the dark-era `bg-white`/`text-black`/`hover:bg-slate-200`
  primary for the **brand gradient** (`#10c4dc → #2563eb 58% → #7d5cff`, white text,
  `rgba(37,99,235,0.16)` shadow, `hover:brightness-110`), matching the Sprint 5B treatment.
- **"Stock retail value" eyebrows** → `text-violet-200` → `text-theme-accent` in **both** files.
- **Add Item primary buttons** → Save Item + the plan-limit upsell link moved from the non-brand
  `from-cyan-400 via-indigo-500 to-violet-600` gradient to the brand gradient (submit shadow
  normalized to `rgba(37,99,235,0.16)`).
- **Focus rings** → shared `inputClassName` focus treatment in both files moved from indigo
  (`indigo-300/60`, `rgba(99,102,241,0.12)`) to **brand-blue** (`#2563eb/50`,
  `rgba(37,99,235,0.12)`); the red error-state focus ring was left unchanged.

**Shared-impact (confirmed):** `EditItemForm` is rendered by multiple surfaces, so the button /
eyebrow / focus-ring fixes propagate to the **full-page edit**, the **slide-over edit**, and the
**inventory-list edit** — verified via screenshots on multiple surfaces, desktop + mobile.

**Known gap (flagged for a future pass):** review surfaced a separate **"Quick Add" modal**
component that is **not** part of `add-item/page.tsx` or `EditItemForm.tsx`. It was out of scope
here because the Sprint 6 investigation did not surface it. It should get the same brand-alignment
treatment in a future polish sprint.

**Files changed:** `app/dashboard/add-item/page.tsx` · `app/dashboard/inventory/EditItemForm.tsx`.
(No `app/globals.css` change was needed.)

**Verification:** `npm run lint` ✅ · `npx tsc --noEmit` ✅ · `npm run build` ✅ (30/30 routes) ·
visual review across both edit surfaces, desktop + mobile. *(Note: an initial `tsc`/`build` run
tripped on a truncated `.next/dev/types/routes.d.ts` — a race with the running `next dev` server
regenerating route types, not a code error; both passed cleanly on re-run once edits settled.)*

**Untouchables:** No form validation (inline or `validateEditItemFormValues`), image-upload logic,
inventory insert/update Supabase calls, `logInventoryHistory`, subscription/limit/upsell logic,
routing (`returnTo` / `ContextBackButton`), or the `Select` / `CategorySelector` / `EditItemForm`
prop contracts were touched.

---

## Sprint 7 — Mobile Inventory QA  *(Completed & approved)*

**Scope:** A mobile QA pass over the inventory surfaces, split into an **investigation phase**
and a narrow **fix phase**. The investigation (static audit + live CDP wheel-test across
**Categories**, **Add Item**, the **full item-details page**, and the **Inventory list** at
390px) confirmed **0 screens needed scroll/layout fixes** — `overscroll-behavior: auto` is
already applied correctly by browser default, and the insights rail is `display: none` on
mobile (not overlapping content). No scroll/overflow/overscroll CSS was touched.

**Fix phase — touch-target sizing only** (bumped to `min-h-11` / 44px):
- **Categories** view-mode toggle buttons (List / 2-col / 3-col / Table).
- **Inventory full-page** inline-modal close buttons (movement + edit).
- **Inventory list** action-menu trigger + its 6 menu items.

**Explicitly excluded:** `ItemDetailsSlideOver.tsx` header icon controls (~38px) — a documented
**Sprint 5 collapse-behavior tradeoff**, intentionally left as-is.

**Files changed:** `app/dashboard/categories/page.tsx` · `app/dashboard/inventory/[id]/page.tsx` ·
`app/dashboard/inventory/page.tsx`. (No `app/globals.css` change was needed — existing utility
classes covered every fix.)

**Verification:** `npm run lint` ✅ · `npx tsc --noEmit` ✅ · `npm run build` ✅ · live CDP scroll
test (0 issues) · screenshot review at **390px and 320px** — all passed.

**This closes Sprint 7 and Phase 1 — Foundation.**

---

## Sprint PO-A — Purchase Orders foundation (persisted history + new creation flow)  *(Code complete; awaiting phase-8 SQL run)*

**Scope:** Replace the on-device-only PO draft builder with a persisted purchase-order system,
pulled forward from the roadmap at the founder's request. POs now cover **inventory restocks
and general/expense purchases** (equipment, supplies, services… e.g. "new AC for a depot").

**Delivered:**
- **`sql/phase-8-purchase-orders.sql`** — `purchase_orders` + `purchase_order_lines` tables
  (mixed `inventory`/`expense` line types, `affects_stock` flag, payment fields: method /
  paid_by / status / amount, depot + supplier snapshots, attachment fields), stock_movements
  PO reference columns, **`receive_purchase_order` RPC** (stock only changes on receive, via
  stock_in movements labeled "Purchase order #N"), full RLS + normalize/guard triggers
  (modeled on phase-7 pick lists), and the **`po-attachments` public storage bucket** with
  owner-folder upload policies.
- **`app/lib/purchaseOrders.ts`** — types, list/create/cancel/delete/receive helpers,
  `getNextPoNumber` (prefix: depot code → depot name → business name → SYDIN, count-based,
  always editable), attachment upload, spending split helper (stock vs expense), and
  `isPurchaseOrdersSchemaMissing` for graceful pre-migration UX.
- **`/dashboard/purchase-orders/new`** — single scrolling form (no rigid wizard): auto PO
  number, purchase/expected dates, status, **depot select + inline "New depot" dialog**,
  saved-supplier or free-text supplier + contact, **mixed lines editor** (inventory picker
  dialog with debounced search; expense lines with category), per-line "Add to stock when
  received" toggle with plain-language explainer, live totals bar (stock/general/total),
  **invoice image attachment** (file picker; phone camera via `accept="image/*"`), payment
  section, sticky save bar.
- **`/dashboard/purchase-orders`** — rewritten as **history + spending summary**: month
  metric cards (Spent this month / Stock purchases / General purchases), search + status +
  depot filters, row list with status badges, **detail dialog** (lines with "→ stock" flags,
  payment, attachment preview, notes) with **Export PDF** (existing `exportPurchaseOrderPdf`
  with Settings branding), **Mark received** (two-step confirm → RPC), and Cancel order.
- `formatStockMovementNotes` now renders "PO #N — …" in item history and activity feeds.
- PO-scoped CSS appended last in `globals.css` (`.po-*`), hover lift/press per UI rules.

**Decisions:** stock changes only at **receive time**, never at creation; expense lines can
never touch stock (DB constraint); no plan-limit trigger on POs yet; old localStorage draft
builder retired (`sydin:purchase-order-draft` key now unused).

**Founder action required:** run `sql/phase-8-purchase-orders.sql` in the Supabase SQL Editor
(also creates the storage bucket). Until then both pages show a friendly notice explaining
exactly that.

**Verification:** `npm run lint` ✅ · `npx tsc --noEmit` ✅ · `npm run build` ✅ (32 routes,
including new `/dashboard/purchase-orders/new` and `/dashboard/search`) · live preview:
history page schema-missing state ✅ · creation form with $500 expense line splitting into
General purchases ✅ · zero console errors.

**Next (PO-B/PO-C):** branded PDF header redesign + Excel export, dashboard Spending card,
receive-flow polish, motion/tooltip pass.

---

## Sprint PO-B — Purchase Order documents (branded PDF + Excel)  *(Complete)*

**Scope:** Give saved purchase orders professional, shareable exports.

**Delivered:**
- **`app/lib/exportImage.ts`** (new shared helper) — `loadExportImage` (fetch → blob →
  base64 dataURL + dimensions, graceful null on failure) and `getContainedImageSize`, used by
  both exporters. Extracted from the inventory-Excel image logic pattern.
- **`app/lib/purchaseOrderPdfExport.ts`** (redesigned) — richer interface: `poNumber`, depot,
  purchase date, supplier contact, and a **Payment** info column (method / paid-by / status /
  amount); **business logo** drawn on a white plate in the dark header + cyan accent rule;
  three-column info layout (Supplier / Order / Payment); expense **category** shown per line;
  autotable **footer total row**. Filename now keyed to the PO number.
- **`app/lib/purchaseOrderExcelExport.ts`** (new) — ExcelJS workbook mirroring the inventory
  export house style: dark branded banner with logo, 8-cell summary block (supplier, depot,
  dates, payment, status, order total), lines table (type, name, category, code, sku, unit,
  qty, unit cost, line total, adds-to-stock, notes) with currency number formats, total row,
  notes row, frozen header + autofilter.
- **`/dashboard/purchase-orders`** — detail dialog now has **Export PDF** and **Export Excel**;
  shared `exportDetails`/`exportBranding` builders pass the logo + full payment/depot/date data
  to both.

**Verification:** `npm run lint` ✅ · `npx tsc --noEmit` ✅ · `npm run build` ✅ · live preview:
opened the real "202351-PO-0001 — AC main Floor" order, clicked **both** export buttons — no
error notices, no jsPDF/ExcelJS console errors (only unrelated background Supabase auth network
timeouts). Logo fetch degrades to null cleanly if the network is down.

**Next (PO-C):** dashboard Spending card, receive-flow polish, motion/tooltip pass.

---

## Sprint PO-B.1 — Purchase Order UX refinements (founder feedback)  *(Complete)*

**Scope:** Small but important clarity fixes to the creation flow, from Sayed's review.

**Delivered:**
- **Removed the Status dropdown** (Draft/Ordered) from `/dashboard/purchase-orders/new` —
  it forced a confusing choice that didn't matter. New POs always save as `draft`; the
  lifecycle is driven by the clear "Mark received" action on the saved order.
- **Added one "already received" checkbox** near Save: *"We already received these items —
  add to stock now."* Off → save as a record, receive later. On → the order saves, then
  immediately calls `receivePurchaseOrder` (adds every stock-affecting line to inventory).
  The Save button relabels to **"Save & receive now"**. This covers the buy-and-collect-
  same-day case without a second workflow. A receive failure is non-fatal (order stays a
  saved draft); history then shows a warning notice (`?receivefailed=1`) telling the user to
  press Mark received.
- **Redesigned the line-delete button** (`.po-line-remove`): subtle borderless icon, muted by
  default, red tint on hover — replacing the clunky outlined pill.
- Excel export: `.xlsx` header reworked to a clean solid dark banner with a cyan divider and
  **no internal border lines**, bigger logo, richText summary cards, colored order total, and
  the quantity "1." trailing-dot quirk fixed (`General` number format).

**Notes / research answered for the founder:**
- Bluetooth phone→laptop photo transfer is not possible in web apps and isn't how SaaS works;
  the supported paths are opening SydIN on the phone (camera opens directly) or phone→cloud
  sync then normal file pick. Kept to one adaptive "Add invoice image" button.
- Stock still only changes on receive (never at plain save) — the checkbox is the single
  opt-in for same-moment receipt.
- Confirmed the header account-logo 500 in local dev is an SSL cert issue
  (`UNABLE_TO_VERIFY_LEAF_SIGNATURE`) in Next's image optimizer, environmental only — does not
  affect the PDF/Excel logo, which fetch the raw URL directly.

**Verification:** `npm run lint` ✅ · `npx tsc --noEmit` ✅ · `npm run build` ✅ · live preview
(after clearing the stale Turbopack `.next` CSS cache): Status dropdown gone, checkbox toggles
the Save label to "Save & receive now", delete button renders as the new subtle control.

---

## Sprint PO-C — Spending analytics + PO workflow simplification + design polish  *(Complete)*

**Scope:** Close out the Purchase Orders module: dashboard spending analytics, founder-requested
workflow fixes, and a design/motion pass.

**Workflow simplification (founder feedback):**
- **Removed the Draft/Ordered Status dropdown** from `/purchase-orders/new` — new orders save
  as draft automatically; status now changes only through explicit actions.
- **Added the "We already received these items — add to stock now" checkbox** above the save
  bar: unchecked = save and receive later; checked = save then immediately run
  `receive_purchase_order` (button label becomes "Save & receive now"). A receive failure after
  a successful save degrades to a warning notice on the history page
  (`?created=<id>&receivefailed=1`) telling the user to press Mark received.
- Line delete button restyled (`.po-line-remove`): subtle ghost icon, red tint on hover,
  press-scale.

**Dashboard Spending panel (`app/dashboard/page.tsx`):**
- New "Spending this month" panel in the overview grid: gradient **Total spent** card
  (amount + purchase count) and two hover-lift rows splitting **Stock purchases** vs
  **General purchases**, linking to `/dashboard/purchase-orders`. Data via
  `getPurchaseOrdersForUser().catch(() => [])` so a missing phase-8 table just shows the
  empty state. Current-month filter excludes cancelled orders.

**PO history redesign/motion (`.po-*` CSS + row markup):**
- Status **color rail** on each row's left edge (grey draft / cyan ordered / green received /
  rose cancelled), **"Invoice" chip** for orders with attachments, branded gradient metric
  icons on the summary cards (matches inventory stat grid), hover lift + press scale on rows
  and cards, all gated behind `@media (hover: hover)`.

**Verification:** `npm run lint` ✅ · `npx tsc --noEmit` ✅ · `npm run build` ✅ · live preview:
Spending panel showing real data ($628 / 2 purchases, stock-vs-general split) ✅ · redesigned
history page with rails, chip, filters ✅. Note: Turbopack served a stale `globals.css` from the
`.next` cache during this work — cleared `.next` and restarted dev to recover; production builds
were never affected.

**This closes the Purchase Orders module (PO-A/B/C).**

---

## Sprint RCV-1 — Receiving repositioned around the Purchase Orders module  *(Complete)*

**Scope:** Founder asked whether Receiving should be removed now that POs receive stock.
Decision: **keep Receiving** for non-purchase stock-in (customer returns, corrections, quick
restocks) — routing those through POs would corrupt spending analytics — but remove the
overlap and give it PO-style history UX.

**Changed (`app/dashboard/receiving/page.tsx` + scoped `.receiving-*` CSS):**
- **Removed the "Purchase order draft" source** and all its dead machinery (the old
  localStorage PO-draft handoff: `readPurchaseOrderDraft`, `poDraftLines`, "Add PO draft"
  buttons, setup-aside notices). The `purchase_order_draft` union member and label stay so
  previously saved device drafts still restore safely.
- **PO hint**: choosing "Supplier delivery" shows an inline info card — "Buying from a
  supplier? A purchase order also tracks cost, payment, and the invoice" — linking to
  `/dashboard/purchase-orders/new`.
- **Header copy** repositioned: "Record stock that arrives without a purchase…".
- **Recent stock in history on the same page** (setup + finalized steps): two gradient stat
  cards (units received this month, stock-in movement count) + last 8 stock-in movements as
  PO-style rows (green left rail, +delta pill, item name, date · note with "PO #N" / "Receiving
  – RCV-…" labels via `formatStockMovementNotes`). Data from existing `stock_movements` —
  **no schema change**. History refreshes after finalize.

**Verification:** `npm run lint` ✅ · `npx tsc --noEmit` ✅ · `npm run build` ✅ · live preview:
hint card visible, PO-draft option gone, history showing real data (5 units / 1 movement this
month, rows incl. "Receiving - RCV-20260708 - Supplier delivery +5") ✅.

---

## Sprint PO-D — Payment on receive + Record payment  *(Complete)*

**Scope:** Founder's deposit workflow ("pay a deposit now, pay the rest on delivery"). Decision
(documented in chat): do NOT link Receiving↔PO or merge their pages — keep each purchase's whole
lifecycle inside the PO. The real gap was that a saved PO's payment was read-only; fixed here.

**Delivered:**
- **`updatePurchaseOrderPayment(userId, orderId, payment)`** in `app/lib/purchaseOrders.ts` —
  updates only payment fields (status / amount / method / paid_by). Allowed at any status incl.
  received (the phase-8 `normalize_purchase_order` trigger permits post-receipt metadata edits).
- **PO detail dialog** now has an inline **payment panel** (gradient card: status, amount paid,
  method, paid-by) driven by a `paymentMode` state (`none` | `receive` | `edit`):
  - **Mark received** → opens the panel in `receive` mode with an amber "payment on delivery"
    note; **Confirm receive** saves the payment *then* runs `receive_purchase_order` (stock in).
  - **Record payment** (new button, any non-cancelled order) → opens the panel in `edit` mode;
    **Save payment** updates payment only and refreshes the still-open dialog.
  - Replaced the old `confirmingReceive` boolean with `paymentMode`; footer swaps to Back +
    the mode's primary action while a panel is open.

**Verification:** `npm run lint` ✅ · `npx tsc --noEmit` ✅ · `npm run build` ✅ · live preview:
opened received PO-0003, "Record payment" reveals the panel (status/amount/method/paid-by),
footer switches to Back / Save payment ✅.

---

## Sprint A — Global visual polish & bug pass (from Sayed's 14-note review)  *(Complete)*

**Scope:** First sprint of a large UI/UX backlog. Cross-cutting "ugly/broken in all pages"
fixes, low-risk CSS + small markup, foundation for the bigger redesigns to come.

**Delivered:**
- **Inventory list/table images** (`app/dashboard/inventory/page.tsx`): enlarged (list 40→56px,
  table 36→44px), `object-cover` to fill the frame, dropped the hard `border border-theme` for a
  subtle `ring-1 ring-black/5`, rounded-xl. Fixes the "tiny image with ugly border" complaint.
- **Table text wraps** instead of truncating: name + code cells use `[overflow-wrap:anywhere]`
  (dropped `truncate`/`max-w`), so long values like "34233 boxes" wrap cleanly.
- **Item-card hover: blue → grey** (`app/globals.css`, both hover blocks ~10713 & ~11843):
  swapped cyan `rgba(14,165,198)` border + blue shadow for neutral `rgba(148,163,184)` + soft
  grey shadow; kept the lift. Selected state stays cyan (intentional). Overview KPI cards left
  untouched.
- **Unified primary button gradient** site-wide: three conflicting cyans (`#18c7dc`, `#0ea5c6`,
  `#10c4dc`) collapsed to one `linear-gradient(135deg,#10c4dc,#2563eb 58%,#7d5cff)` across
  `.ui-button-primary` and `.inventory-action-primary`. Fixes the "Add Item colour looks broken".
- **Menu + modal consistency**: grid-card "Delete" recoloured violet→red to match the list menu
  (`components/inventory/InventoryItemCard.tsx`); edit-item modal border softened
  (`rounded-[32px] border-theme` → `rounded-[24px]` + lighter `--border-default`, softer shadow).

**Verification:** `npm run lint` ✅ · `npx tsc --noEmit` ✅ · `npm run build` ✅ · live preview:
list view shows large frame-filling images + clean unified Add Item gradient (screenshot).

**Next:** Sprint B — PO payment history (balance + payment log) + collapsible month history.

---

## Sprint B1 — PO remaining balance + collapsible month history  *(Complete)*

**Scope:** The no-database half of note PO-1/PO-2 — value fast, no Supabase step for Sayed.

**Delivered:**
- **`getPurchaseOrderBalance(order)`** helper (`app/lib/purchaseOrders.ts`): total / paid /
  remaining (clamped ≥ 0), computed from lines + `amount_paid`.
- **PO detail dialog balance strip**: three cells — Order total · Paid · **Still owe** (amber
  when a balance remains, green ✓ when fully paid). Verified live: PO-0003 shows $100 / $50 /
  Still owe $50.
- **History "Owe" chips**: rows with an outstanding balance show an amber `Owe $X` chip.
- **Collapsible month-grouped history**: orders grouped by month (purchase_date||created_at)
  into accordion sections with a rotating chevron + reveal motion; each header shows
  "N orders · $total". Verified: June 2026 / July 2026 sections toggle independently.

**Note:** balance is derived from real numbers, so it stays correct even if `payment_status`
was set loosely (e.g. status "Paid" while only half the amount is recorded). The per-payment
**timeline log** (when each payment happened) is deferred to Sprint B2 — it needs a small
`purchase_order_payments` table + migration.

**Verification:** `npm run lint` ✅ · `npx tsc --noEmit` ✅ · `npm run build` ✅ · live preview
screenshots of the accordion + balance strip.

**Next:** Sprint B2 (optional) — payment timeline log (needs a phase-9 SQL migration), then
Sprint C (new PO page redesign).

---

## Sprint B2 — PO payment timeline (per-payment log)  *(Code complete; awaiting phase-9 SQL run)*

**Scope:** The database half of note PO-1 — a log of *when* each payment happened (deposit now,
balance on delivery), so amount_paid/status become derived and trustworthy.

**Delivered:**
- **`sql/phase-9-purchase-order-payments.sql`** — `purchase_order_payments` table (amount,
  method, paid_by, note, paid_at), RLS (owner via parent PO), a **recompute trigger** that sets
  the parent order's `amount_paid = sum(payments)` and derives `payment_status` from the line
  total, a validate trigger (owner + trim), and a **backfill** that seeds one payment row from
  each existing `amount_paid` (run before the triggers so it doesn't trip the auth check) plus a
  final reconcile loop.
- **`app/lib/purchaseOrders.ts`** — `PurchaseOrderPayment` type; `getPurchaseOrderPayments`,
  `addPurchaseOrderPayment`, `deletePurchaseOrderPayment`; `isPaymentsSchemaMissing`;
  `createPurchaseOrder` seeds an initial payment when a deposit is entered. Payments are fetched
  **separately** (not in the main PO select) so the history page keeps working before phase-9.
- **PO detail dialog** — the payment panel is now **"Add a payment"** (amount *this time*, date,
  method, paid-by, note; status auto-derived, no manual dropdown). A **Payment history** timeline
  lists each entry (date · method · paid-by · note) with per-entry delete. "Mark received"
  optionally logs a payment on delivery then receives. Record-payment defaults its amount to the
  outstanding balance for one-tap "pay the rest". Missing-table errors show a friendly
  run-the-migration message.

**Founder action required:** run `sql/phase-9-purchase-order-payments.sql` in the Supabase SQL
Editor. Until then the timeline is simply hidden (graceful) and everything else works.

**Verification:** `npm run lint` ✅ · `npx tsc --noEmit` ✅ · `npm run build` ✅. Live timeline
verification is pending the migration run (the dev DB has no phase-9 table yet; pre-migration
degrades gracefully by design).

---

## Sprint D1 — Whole-site design overhaul: navigation chrome  *(Complete)*

**Scope:** Sayed asked to stop small step-by-step patches and redesign the whole site. Since the
app runs on a shared design system, the overhaul proceeds as a few big cohesive batches over the
shared chrome (safer than a big-bang rewrite of a live app). Batch 1 = navigation, which is on
every screen (notes NAV-12/NAV-13).

**Delivered:**
- **Distinct per-page sidebar icons** (`components/dashboard/navigation.ts`): Receiving →
  `download`, Stock Counts → `layers` (were duplicating `movement`/`check`). Every page now has a
  unique, meaningful icon.
- **Header top-tabs hover fix** (NAV-12): removed the `translateY(-1px)` lift that made inline
  tabs jump into the divider line; replaced with a clean background highlight.
- **Soft sidebar hover-reveal** (NAV-13): the collapsed desktop rail's page-name tooltip now
  slides in with an opacity + translateX cubic-bezier transition instead of an instant
  display toggle (appended last in `globals.css` so it wins the cascade; verified each nav link
  carries its label and the transition).

**Verification:** `npm run lint` ✅ · `npx tsc --noEmit` ✅ · `npm run build` ✅ · live preview:
distinct icons render; tooltip mechanism verified via DOM (display:block, opacity 0→1 transition).

**Next big batches:** global surface/border consistency, then the page redesigns (new PO page #3,
inventory redesign #7–10, simpler add-item #14, phone-QR scan #5).

---

## Sprint D2 — Site-wide image polish (note #9 "fix small bordered images in ALL pages")  *(Complete)*

**Scope:** Swept every page for the small-bordered-thumbnail pattern and applied one policy:
**item photos** fill their frame (`object-cover`, no padding), no hard border → `rounded-xl` +
soft ring (`ring-1 ring-black/5`), sized ≥ 44px. **Logos, hero/detail images and upload
previews stay `object-contain`** (never crop a logo).

**Fixed:** receiving (table + review card), stock-counts (table + review card), stock-movements
rows, qr-center picker, categories assign dialog, dashboard overview `.sydin-overview-thumb`
(dropped the cyan icon-border/gradient around photos, 2.45→2.75rem, cover) and the inventory
**grid card media** now fills its tile Sortly-style (`object-cover`, no padding — was
letterboxed `contain p-2`). Inventory list/table were already done in Sprint A.

**Left as-is intentionally:** icon/emoji chips (bordered boxes are the design), business logos
(header, settings, item pages), slide-over hero image, add-item upload preview.

**Verification:** `npm run lint` ✅ · `npx tsc --noEmit` ✅ · `npm run build` ✅ · preview
screenshots: inventory grid full-bleed tiles, overview restock/recent thumbs clean.

---

## Sprint D3 — Inventory compact mode (note #7 "hide stats, big screen for items")  *(Complete)*

**Scope:** The stats/hero header ate the top of the inventory page with no way to reclaim it.
A `showStats` flag + hidden-state CSS existed but had **no user-facing control** (dead code —
second such find after the broken Create-PO-from-items).

**Delivered:**
- **"Compact" / "Stats" toggle** in the inventory toolbar (next to Filters): hides the stat
  cards, hero badges, description and breadcrumb, slims the hero title — items start ~200px
  higher. Chevron flips with state; `aria-pressed`; tooltip explains it.
- **Preference persists** in `localStorage sydin:inventory-show-stats` (restored on mount via
  the existing rAF pattern; storage failures are non-fatal).
- Compact CSS scoped under `.inventory-workspace-summary-hidden` appended last in globals.css.

**Verification:** `npm run lint` ✅ · `npx tsc --noEmit` ✅ · `npm run build` ✅ · live preview:
toggled Compact (hero one-line, grid raised), preference survived a fresh page load, toggled
back to default.

---

## Sprint E1 — Glass 2.0 foundation (whole-app glassmorphism layer)  *(Complete)*

**Scope:** Sayed brought a glassmorphism reference (frosted cards over a warm gradient orb, pill
controls, staggered motion) and a detailed visual-only brief. Implemented as one appended CSS
layer over the shared design system, so every dashboard page restyles at once with zero logic
changes and **zero new dependencies** (pure CSS instead of framer-motion — decided deliberately).

**Delivered (all in `app/globals.css`, appended "GLASS 2.0 FOUNDATION" block):**
- **Ice background + orb**: `#f2f5f8` with three fixed radial-gradient layers (warm yellow/orange
  glow top-left, teal tint bottom-right) on `.dashboard-theme:has(.dashboard-shell)` /
  `.dashboard-workspace-shell`, drifting slowly (24s alternate). Canvas/content made transparent
  so the glow shows through pages.
- **Frosted chrome**: sidebar rail + desktop toolbar at `rgba(255,255,255,.55-.58)` with
  `backdrop-blur(18px) saturate(1.5)` and white hairline borders.
- **Frosted panels** (real blur, large surfaces): dashboard/PO/inventory cards, page headers,
  toolbars, tables, month groups → white/62 + blur(16px) + diffused shadow.
- **Small repeated cards** (item grid, history rows, metric cards): translucent white **without**
  blur — deliberate performance choice for big grids.
- **Frosted pill controls**: secondary/icon buttons, header search bar, account pill.
- **Staggered entrance**: `glass-fade-up` on the top-level children of `.dashboard-page-shell`,
  `.sydin-overview-inner`, `.inventory-workspace` (60ms stagger, capped at 300ms).
- **Accessibility**: full `prefers-reduced-motion` (no drift, no entrance) and
  `prefers-reduced-transparency` (solid white, no blur) fallbacks.

**Deferred to later passes:** count-up numbers, route crossfades (need JS), auth pages,
modals/dropdowns glass, mobile nav treatment.

**Verification:** `npm run lint` ✅ · `npx tsc --noEmit` ✅ · `npm run build` ✅ · live preview
screenshots: Overview, Inventory and Purchase Orders all frosted over the orb glow (PO hero shows
the warm gradient through the glass) · zero console errors.

---

## Sprint E2 — Glass 2.0 dashboard upgrades (reference-matching pass)  *(Complete)*

**Scope:** Push the Overview closer to Sayed's glassmorphism reference with real-data features
(no fake trend percentages — deliberate honesty call: SydIN doesn't track history yet, so no
"+8.1% vs last month" until it does).

**Delivered:**
- **Stronger orb**: bigger, warmer, more visible gradient layers (yellow core 0.55α, orange
  bloom, teal corner) — was nearly invisible at wide viewports.
- **KPI cards v2** (`app/dashboard/page.tsx`): per-card color identity (teal/indigo/violet/
  emerald icon chips), **count-up numbers** (`CountUpNumber`, rAF ease-out cubic, reduced-motion
  aware), and a **real stock-distribution mini-bar** (green in / amber low / red out) under
  Total Items.
- **Stock health gauge panel** (`StockHealthGauge`): SVG semicircle, arc = % items in stock
  (animated stroke-dasharray; green ≥70 / amber ≥40 / red), center count-up %, legend rows with
  live counts linking to filtered inventory views. Verified live: 57% amber with 4/3/0.
- **Inventory URL now accepts `?quick=`** (low-stock/out-of-stock/no-image/unassigned) — the
  quick filters existed but had no deep link; gauge legend uses `?quick=out-of-stock`.
- **Fixed a latent responsive bug** (pre-existing, exposed at container ≤900px): the overview
  header's and inventory hero's row flex-basis (20rem/22rem) became *height* in column mode,
  inflating the header to ~720px with giant stretched action buttons. Fixed via
  `@container (max-width: 900px) { flex: 0 0 auto }` for those children.

**Verification:** `npm run lint` ✅ · `npx tsc --noEmit` ✅ · `npm run build` ✅ · live preview at
the failing container width: header normal, colored KPIs + distribution bar, gauge at 57% with
correct legend counts.

---

## Sprint E3/E4 — Glass 2.0: modals, dropdowns, tooltips, auth pages  *(Complete)*

**Scope:** Continue the glassmorphism brief past the dashboard — overlays and the login page.

**E3 — Overlays (`app/globals.css`):**
- `.ui-overlay` backdrop now blurs (6px) behind every dialog/sheet — was a flat scrim.
- **Entrance motion** added for dialogs (`glass-pop-in` scale+fade), sheets (directional slide
  per side: right/left/bottom), and menus/dropdowns/search panel (`glass-pop-in`, faster/160ms).
  Found `.ui-menu-surface` / `.inventory-floating-menu` / `.ui-select-menu` were **already**
  glass (blur 18px, prior sprint) — just missing motion, now added.
- **Tooltip** upgraded from solid `--bg-surface-strong` to frosted glass (blur 10px) with a
  scale+fade reveal on hover/focus, matching the existing hover trigger.
- Full `prefers-reduced-motion` fallback (animations off) on all of the above.

**E4 — Auth pages (`AuthPageShell` via `.login-*` classes):**
- Kept the existing split-panel layout + `SydINLoginVisual` illustration (safer than a full
  rebuild, no logic touched) but added the **warm orb + teal glow** behind the form panel and
  **frosted glass** on the Google/Microsoft buttons and email/password inputs — same visual
  family as the dashboard. Subtle fade-up on the whole auth column.
- `prefers-reduced-transparency` fallback (solid white inputs/buttons).

**Verification:** `npm run lint` ✅ · `npx tsc --noEmit` ✅ · `npm run build` ✅ · live preview:
login page shows glowing frosted buttons/inputs over the illustration split; inventory item
action menu renders as a frosted glass dropdown with legible text and red Delete; zero console
errors.

**Remaining from the Glass 2.0 brief:** route crossfade transitions (needs JS/layout-level work),
empty-state illustrations, loading skeleton shimmer tuning.

---

## Sprint E5 — Glass 2.0 route crossfade  *(Complete)*

**Scope:** Last item from the Glass 2.0 brief — smooth page-to-page transitions, closing out
the whole-app glassmorphism pass.

**Delivered:**
- **`app/dashboard/template.tsx`** (new) — a thin wrapper around `{children}`. Next.js
  `template.tsx` remounts on every navigation (unlike `layout.tsx`, which persists), so the
  sidebar/header in `layout.tsx` stay mounted while only the page content below them gets a
  fresh instance per route change. Zero new dependencies — uses a built-in App Router mechanism
  instead of a client-side transition library.
- **`.dashboard-route-transition`** CSS (`app/globals.css`): 260ms crossfade + 8px upward slide
  (`glass-route-in`, same easing family as the rest of Glass 2.0), `prefers-reduced-motion`
  fallback.

**Verification:** `npm run lint` ✅ · `npx tsc --noEmit` ✅ · `npm run build` ✅ (all 32 routes
including the new template) · live preview: clicked Overview → Inventory, confirmed via DOM
inspection that the transition wrapper is a **new node** each navigation with `animationName:
"glass-route-in"` actively applied (proof the crossfade replays, not just present once) ·
mobile viewport (375×812) checked — cards, KPI colors, and bottom nav all render cleanly, no
overlap or breakage.

**This closes the Glass 2.0 whole-app glassmorphism pass** (E1 foundation → E2 dashboard →
E3 overlays → E4 auth → E5 transitions).

---

## Sprint F — Glass 2.0 color-consistency pass (secondary pages)  *(Complete)*

**Scope:** Founder asked for a full app audit/launch-readiness pass. An Explore-agent audit across
every page not individually named in a named sprint (Depots, Suppliers, Search, Settings,
Inventory Import, Reports, Stock Counts, Pick Lists x2, Help, the public `item/[id]` QR page,
admin/marketing pages, and the 3 admin API routes) found **zero crash risk** — data fetching is
consistently hardened (guarded `JSON.parse`, typed `useState<T[]>([])`, try/catch everywhere) —
but a real, mechanical **visual-consistency gap**: several pages still used pre-Glass-2.0 off-brand
`indigo`/`violet`/`cyan`/`sky` focus rings, buttons, and badges instead of the brand gradient
(`#10c4dc → #2563eb 58% → #7d5cff`) and brand-blue (`#2563eb`) focus token established by
Sprints 5B/6, and two pages (`pick-lists` x2, `help`) plus the public item page still carried
light-pastel text colors (`text-slate-200`, `text-violet-300/100`, `text-emerald-300`) left over
from the pre-redesign dark theme — a real contrast bug on the now-light workspace.

**Fixed (presentation-only, no logic/schema/auth touched):**
- **Brand-token normalization**: focus rings, active-toggle borders, badges, and primary-gradient
  buttons swapped to the standard tokens across `app/dashboard/depots/page.tsx`,
  `app/dashboard/suppliers/page.tsx`, `app/dashboard/search/page.tsx`,
  `app/dashboard/settings/page.tsx`, `app/dashboard/inventory/import/page.tsx`,
  `app/dashboard/reports/page.tsx`, `app/dashboard/stock-counts/page.tsx`,
  `app/dashboard/stock-movements/page.tsx`, `app/dashboard/pick-lists/page.tsx`,
  `app/dashboard/pick-lists/[id]/page.tsx`, `app/dashboard/help/page.tsx`,
  `app/dashboard/inventory/page.tsx`, `app/dashboard/categories/page.tsx`,
  `app/dashboard/purchase-orders/page.tsx`, `components/inventory/StockMovementDialog.tsx`
  (a shared component used across several pages), `app/dashboard/layout.tsx` (session-loading
  gate), and `app/request-plan/page.tsx`.
- **Contrast bug fix**: `text-slate-200` Pick List "Draft" badge → `text-theme-muted`;
  `text-violet-300/100` and `text-emerald-300` on the Help page → `text-theme-*`/brand tokens —
  these were unreadable-in-spirit light-pastel colors inherited from the pre-redesign dark theme,
  now correctly legible on the light glass surface.
- **Public QR item page** (`app/item/[id]/page.tsx`, deliberately its own dark theme — left as
  dark by design): avatar gradient and "Go to SydIN" CTA moved from a non-brand
  indigo/violet/fuchsia gradient and flat white/black button to the brand gradient; section
  eyebrows moved to the brand's `#7d5cff` violet stop instead of stock `indigo-300`.
- **Settings**: hand-rolled dark-shimmer loading skeleton replaced with the shared
  `LoadingSkeletonGroup` primitive.
- **Explicitly left alone**: categorical multi-hue "accent" systems on already-approved surfaces
  (`inventory/[id]` `DetailCard` accent prop, `EditItemForm`, `add-item`, `InventoryItemCard`,
  `InventoryValueOverview`, the Reports/Import "4th stat tone", `.glass-button`/`.glass-panel`
  utility classes) — these are deliberate, signed-off multi-color designs, not brand-consistency
  bugs, and restructuring `pick-lists`/`help` off their existing `.glass-*` utility-class pattern
  onto `Workspace.tsx` primitives was intentionally out of scope (real behavior-preservation risk
  for cosmetic-only gain).
- Verified (read-only): Stock Counts' mobile card fallback carries full field parity with its
  desktop table (item, expected/counted/difference, note) — no gap found.

**Verification:** `npm run lint` ✅ · `npx tsc --noEmit` ✅ · `npm run build` ✅ (32/32 routes) ·
live preview across Depots, Suppliers, Settings (Branding toggle + logo dropzone), Pick Lists
(list + progress bar), Help (progress bar, troubleshooting, contact cards), Reports, and a mobile
(375px) pass on Suppliers — all render with the unified brand gradient/blue, legible text, correct
touch targets, zero console errors.

**Untouchables:** No authentication, Supabase integration, database schema, routing, or business
logic was changed on any file in this sprint.

## Sprint 9 (Stages 0–1) — Scanner Workspace foundation  *(Stages 0–1 complete; Stages 2–3 pending SQL)*

**Scope:** Roadmap Sprint 9. Founder chose the **full 8-mode** Scanner Workspace
(Lookup · Receive · Issue · Transfer · Inventory Count · Assign · Repair · Return) including a new
per-unit asset model. Delivered in stages because the remaining modes need migrations the founder
runs manually in Supabase. **Stages 0–1 are shipped and verified; Stages 2–3 are not started.**

### Stage 0 — shared scanner extraction (no SQL, zero intended behavior change)

The camera scanner was embedded in `app/dashboard/inventory/page.tsx` (~230 lines of refs, decode
effect, and modal JSX). Extracted so Inventory and the new workspace share **one** implementation:

- **`app/lib/scannerErrors.ts`** — `getScannerErrorMessage` (moved verbatim) + the unsupported /
  preview-not-ready message constants.
- **`components/scanner/BarcodeScannerView.tsx`** — owns the `@zxing/browser` lifecycle
  (`decodeFromConstraints`, `facingMode: environment`, MediaStream teardown). Props
  `{active, onDecode, onStatusChange?, continuous?, readyStatus?, className?, videoClassName?}`.
  `continuous` is new for the workspace; Inventory passes the default `false` to keep
  stop-on-first-decode.
- **`components/scanner/ScannerModal.tsx`** — the Inventory quick-scan chrome. "Try Again" now
  remounts the view via a `key` nonce instead of the previous `setIsScannerOpen(false)` +
  `setTimeout(…, 0)` reopen dance (verified: the `<video>` is a genuinely new node after retry).
- **`app/lib/scannerResolve.ts`** — `extractScannedPublicId` + `resolveScannedCode()` returning a
  discriminated union (`item` / `ambiguous` / `none`).

`app/dashboard/inventory/page.tsx` shrank by **227 lines** and now renders `<ScannerModal>`.

**Three real bugs fixed:**
1. **Barcode scanning never worked.** Inventory rows carry a `barcode` column, but the resolver
   only matched `public_id` then `sku` — scanning a product's own barcode always fell through to a
   plain text search. `barcode` is now matched (priority: public id → exact SKU → barcode →
   case-insensitive SKU).
2. **Camera restarted mid-scan.** The old decode effect depended on `handleScannedText`, which is
   `useCallback`'d on `[closeScanner, items, router]` — so any background item reload tore down and
   restarted the camera. Callbacks now live in refs; the effect depends only on `active` /
   `continuous`. *(Intentional improvement, not a pure no-op refactor.)*
3. **Camera permission ambush.** The first Scanner Workspace build auto-started the camera on
   mount, firing a permission prompt before the user did anything (it wedged the preview pane —
   the same thing it would do to a first-time user). Now it queries the Permissions API and
   auto-arms **only** when camera permission is already granted; otherwise it shows a calm
   "Ready to scan" state with an explicit **Start scanning** button. Safari doesn't accept the
   `"camera"` permission name and throws — that path falls back to the manual button.

### Stage 1 — Scanner Workspace (no SQL) → Lookup · Receive · Issue · Count

- **`app/dashboard/scanner/page.tsx`** (new route, 33rd). Sticky scrollable mode chips (44px
  targets), camera panel, mode action panel, and a session "tape" of completed scans. Reads
  `?mode=`. Scan → resolve → act → auto-rearm after 1.2s.
  - **Lookup** → navigates to the item. **Receive/Issue** → quantity stepper →
    `recordStockMovement` (`stock_in`/`stock_out`), issue blocked above available stock.
    **Count** → tallies into the active Stock Counts draft.
  - The four staged modes render as disabled chips that explain which migration unlocks them —
    deliberately **not** hidden and **not** faked.
  - States covered: loading · load-error · plan-locked (`LockedFeaturePanel`) · camera-off ·
    camera-starting · camera-error · paused · no-match · ambiguous-picker · success.
- **`app/lib/stockCountDraft.ts`** — read/write access to the Stock Counts `sessionStorage` draft
  (`sydin:stock-counts-draft`). Deliberately **defensive**: validates the payload shape and
  refuses to write rather than risk corrupting an in-progress count if that page's format changes.
  Never regresses a `review` draft back to `count`; promotes `setup` → `count` on first scan.
  *(Note: `stock-counts/page.tsx` keeps its own draft logic — not refactored onto this helper, to
  avoid touching working behavior. The duplication is known and intentional for now.)*
- **Navigation**: added `Scanner` (`section: "workspace"`, `mobilePlacement: "primary"`,
  icon `scan`). `DashboardShell.requestScanner` and QR Center's "Start Scanner" now push
  `/dashboard/scanner?mode=lookup` instead of routing through Inventory's sessionStorage handoff;
  Inventory keeps its own quick-scan modal and its `SCANNER_REQUEST_EVENT` listener, so pressing
  Scan while already on Inventory still opens the modal in place.

**Settled decisions (also in `SYDIN_DECISION_LOG.md`):** Transfer = whole-item relocation with an
audit row, **not** partial-quantity splitting (per-depot stock would require rewriting every
quantity read/write in the app). Asset tracking = per-unit `inventory_assets` + append-only
`asset_events`, quantity **derived** by trigger, opt-in via `inventory.is_asset_tracked`. No
people/employees table yet — free-text assignee with autocomplete.

**Verification:** `npm run lint` ✅ · `npx tsc --noEmit` ✅ · `npm run build` ✅ (33/33 routes,
incl. the new `/dashboard/scanner`). Live preview: Inventory scanner opens / maps the permission
error / retries with a real remount / closes and unmounts cleanly; the QR Center → scanner handoff
works end-to-end; mode switching works and "Soon" modes surface their reason without switching.
**31 unit tests written and passing** against the two pure helpers (`scannerResolve` 13,
`stockCountDraft` 18), covering the new barcode match and the defensive paths where a corrupt or
finalized count draft must be refused rather than clobbered. *(Tests were run via `tsx` and not
committed — the repo has no test runner configured. Adding one is a recommended follow-up.)*

**Known gap — on-device testing still required.** The preview browser has no camera, so every
camera path exercised was the **denied** path. Real QR decode, 1D barcode decode, permission
grant, and "camera light turns off on close" must still be checked on a phone.

**Next:** Stage 2 (`sql/phase-10a-depot-transfers.sql` → Transfer) and Stage 3
(`sql/phase-10b-asset-tracking.sql` → Assign/Repair/Return), each requiring the founder to run the
migration in the Supabase SQL editor. Full plan retained at the approved Sprint 9 plan file.

---

## Sprint 9 (Stages 2–3) — Depot Transfers + Asset Tracking (code & migrations complete)

**Scope:** Deliver the Transfer mode and Asset-Tracking modes (Assign/Repair/Return) for the
Scanner Workspace, completing the full 8-mode system. Both SQL migrations written, applied to
Supabase production, and code wired up with auto-detection.

### Stage 2 — Depot Transfers

- **`sql/phase-10a-depot-transfers.sql`** — whole-item relocation with audit trail
  - `inventory_depot_transfers` table: user_id, inventory_item_id, from_depot, to_depot, moved_by, notes, created_at
  - `transfer_inventory_item_to_depot(item_id, new_depot_id, moved_by_name, notes)` RPC — single writer, updates
    `inventory.depot_id`, logs transfer, returns success/failure
  - RLS + indexes for performance
- **Scanner UI** — Transfer mode: scan item → select depot (dropdown) → confirm → updates item depot + logs audit
- **Code** — `app/lib/depotTransfers.ts` provides wrapper + migration detection

### Stage 3 — Asset Tracking (per-unit model)

- **`sql/phase-10b-asset-tracking.sql`** — per-unit tracking + derived quantity
  - `inventory_assets` table: id, public_id (unique), status, condition, assigned_to_name, serial, notes
  - `asset_events` append-only log: event_type, old/new status/condition/assignee, recorded_by, created_at
  - `inventory.is_asset_tracked` flag (opt-in per item)
  - Trigger to derive `inventory.quantity` from active asset count (status != retired && status != lost)
  - `record_asset_event(asset_id, event_type, new_status?, new_condition?, new_assigned_to?, notes?, recorded_by?)` RPC
    — single writer for all asset status transitions
  - `get_asset_assignee_suggestions(search_term)` helper for autocomplete
  - RLS + indexes
- **Scanner UI**
  - **Assign** — scan tracked item → select unit from dropdown → enter/select assignee (autocomplete from
    existing names) → confirm → logs `assigned` event
  - **Repair** — scan tracked item → select unit → mark for repair (status → `in_repair`) → logs `status_changed`
    event
  - **Return** — scan tracked item → select unit → return to stock (status → `in_stock`) → logs `status_changed`
    event
- **Code** — `app/lib/assetTracking.ts` provides types, RPC wrappers, asset fetching, assignee suggestions +
  migration detection
- **Asset UI** — asset unit selector (public_id + current status/assignee), assignee autocomplete, condition
  picker

### Integration into Scanner Workspace

- Updated `app/dashboard/scanner/page.tsx` to load both migrations on mount and detect availability
- All 8 modes now present: Lookup, Receive, Issue, Count (enabled) + Transfer, Assign, Repair, Return
  (auto-enable once phase-10a/10b tables exist)
- Mode chips update dynamically as migrations are detected
- When modes aren't available, clicking them shows a helpful "Soon — ask admin to run phase-10a/10b" message
- Asset modes automatically load assets for the scanned item and populate the asset selector
- Assignee autocomplete queries distinct `assigned_to_name` values with count, trimmed + case-insensitive match

### Founder action taken

- Run `sql/phase-10a-depot-transfers.sql` in Supabase SQL Editor ✅
- Run `sql/phase-10b-asset-tracking.sql` in Supabase SQL Editor ✅
- Scanner auto-detected the new tables and **unlocked all 8 modes** ✅

**Verification:** `npm run lint` ✅ · `npx tsc --noEmit` ✅ · `npm run build` ✅ (33/33 routes) ·
Live preview at `/dashboard/scanner`: all 8 mode chips visible and clickable; Transfer/Assign/Repair/Return now
enabled; clicking them pops depot/asset selectors.

**Known gap — on-device testing still required.** Same as Stage 1: real QR decode, barcode decode, permission
grant, and camera light off must be verified on phone once Vercel redeploys.

**This closes Sprint 9 entirely — all 4 stages (0–1 shipped July 20, 2–3 code complete, migrations live).** Scanner
Workspace is feature-complete and ready for user testing. Next sprint: Stock Alerts + Activity Foundation (Sprint 10).

---

## Sprint 10 (Stage 1) — Stock Alerts  *(Complete)*

**Scope:** First half of roadmap Sprint 10 (Stock Alerts + Activity Foundation). **No SQL needed** —
the data model already existed (`inventory.min_stock_level` per item, `business_settings.low_stock_threshold`
global default, `getEffectiveItemLowStockThreshold` helper, plan gating via `customLowStockThreshold`).
This stage built the missing *surfaces*: a triage page and a quick way to set an item's alert level
without opening the full edit form (backlog item "alert settings from item menu").

**Delivered:**
- **`app/dashboard/alerts/page.tsx`** (new route, 34th) — Stock Alerts triage page: metric cards
  (Out of stock / Low stock / Default alert level → Settings), filter chips (All / Out / Low with
  counts), rows sorted out-first then by quantity ascending, each with thumb, name (opens
  `ItemDetailsSlideOver` on its Alerts tab), SKU/code + depot, quantity vs threshold, and two
  actions: **Restock** (shared `StockMovementDialog`) and **Set alert level**. Header actions:
  View in inventory (`?quick=low-stock`) + Create purchase order. Healthy empty state. Built
  entirely from `Workspace.tsx` primitives — **zero `globals.css` changes**.
- **`components/inventory/SetAlertLevelDialog.tsx`** (new shared component) — small `DialogShell`
  editing only `inventory.min_stock_level`: integer input with "Business default (N)" placeholder,
  "Use default (N)" reset (shown only when a custom level exists), writes via the standard
  `.update().eq(id).eq(user_id)` + `logInventoryHistory` pattern. On Free plan it shows the
  existing `LockedFeaturePanel` upsell instead of the form (per-item thresholds are Standard+).
  Uses the mount-fresh inner-component pattern (like `StockMovementDialog`) — no setState-in-effect.
- **Inventory integration** — "Set alert level" added to **both** item action menus (the list/table
  `renderItemActionMenu` and the grid `InventoryItemCard` menu via a new optional `onSetAlertLevel`
  prop), between Adjust stock and Edit; saving updates the row in place.
- **Navigation** — `Alerts` added to `DASHBOARD_NAVIGATION` (first entry of the previously-empty
  **Insights** section; icon `alert`; mobile More sheet). Dashboard restock-panel and stock-health
  headers now link "View alerts" → `/dashboard/alerts` (gauge legend keeps its filtered-inventory
  links).

**Verification:** `npm run lint` ✅ · `npx tsc --noEmit` ✅ · `npm run build` ✅ (34/34 routes) ·
live preview: page renders real data (3 low-stock items, custom "Alert at 30" proving the per-item
path); **full save round-trip tested live** (30 → 25 → 30, row updated in place each time, success
notice, zero console errors); filter chips + empty group state; dialog opens from the inventory grid
menu (item with no custom level correctly shows placeholder-only, no reset button); mobile 375px
pass (stacked rows, full-width 44px+ touch targets). *(One transient "could not confirm your
session" on Inventory during testing — known environmental Supabase auth hiccup, recovered on
reload, unrelated to this change.)*

**Untouchables:** No schema, auth, routing, or business-logic changes. The only new write path is
the targeted `min_stock_level` update, following the existing inventory-edit pattern.

**Deferred (rest of Sprint 10):** Email alerts (own sprint — needs email-provider/infra decision).
Categories-page item cards don't get the menu entry yet (optional prop unused — no dialog machinery).

---

## Sprint 10 (Stage 2) — Activity Foundation  *(Complete)*

**Scope:** Second half of roadmap Sprint 10. **No SQL needed** — all event sources (`inventory_history`,
`stock_movements`, `purchase_orders`) already existed. This stage built the unified Activity feed and
wired the dashboard's "Activity" tab to it (was a stock-movements stand-in).

**Delivered:**

- **`app/lib/activityFeed.ts`** (new helper) — `getActivityFeed(userId, limit)` aggregates events
  from three sources:
  - Stock movements (`stock_in`, `stock_out`, `adjustment`, `damaged_lost`) — fetched with item names
  - Inventory history (`created`, `edited` actions only; `deleted` mapped to `item_edited`) — with item names
  - Purchase orders (status=`received`) — with PO number
  - All events merged, sorted by timestamp (newest first), returned with a unified `ActivityEvent` type
  - Includes helper functions: `getActivityEventLabel()`, `getActivityEventIcon()`, `getActivityEventTone()`
    for consistent UI rendering across all event types.

- **`app/dashboard/activity/page.tsx`** (new route, 35th) — Activity page using the `Workspace.tsx`
  shell + header (eyebrow "Insights", title "Activity", description). Renders a unified timeline
  showing all events with:
  - Search box (matches item name, PO number, notes, event label)
  - Sort dropdown (Newest / Oldest first)
  - Filter bar with 8 chips: **All**, **Stock In**, **Stock Out**, **Adjustments**, **Damaged/Lost**,
    **Created**, **Edited**, **PO Received** — each with event count; color-coded (stock=emerald,
    quantity-related=violet, damage=red, created=success)
  - Event cards with icon, label, timestamp, optional item link (→ `/dashboard/inventory/[id]`),
    optional PO link (→ `/dashboard/purchase-orders`), notes if present, and quantity before/after/delta
    for stock movements and edits
  - Empty state with "No activity yet" when feed is empty
  - Loading skeleton (5 cards) during data fetch

- **Navigation & wiring** — `Activity` added to `DASHBOARD_NAVIGATION` in the **Insights** section
  (icon `layers`, mobile Primary placement, before Alerts). Dashboard "Recent Activity" panel now
  links to `/dashboard/activity` instead of `/dashboard/stock-movements` (both title and "Open activity"
  link). Falls back to activity page when item lookup fails (was stock-movements).

**Verification:** `npm run lint` ✅ · `npx tsc --noEmit` ✅ · `npm run build` ✅ (35/35 routes) ·
live preview: Activity page renders with correct header, search/sort/filters, proper INSIGHTS eyebrow.
Feed fetches async; empty state shown for demo account (no events yet). Navigation: "Activity" tab now
highlights on `/dashboard/activity`; dashboard panel links to it. Filter chips render with counts
(all 0 for fresh account). Color-coded event types and icons match the backlog (stock=emerald,
item=violet, po=success). Links to items and POs correctly target inventory and order details.

**Untouchables:** No schema changes. Read-only aggregation from existing tables (no new writes).
Event types fixed to backlog: stock movements (4 types) + item created/edited (2 types) + PO received
(1 type). Asset events and depot transfers deferred (don't exist yet — scheduled for phase-10b).

**Scope decision:** Kept stage 1 & 2 together as promised; avoided Framer Motion showcase route
(was overcomplicated, went nowhere, added zero product value).

---

## Sprint 11 — Reports Polish  *(Complete)*

**Scope:** Polish the existing Reports Hub by adding two missing report types from the backlog:
**Supplier reports** and **Depot/Location reports**. No SQL needed — all data already available.

**Delivered:**

- **New report types:**
  - **Supplier Report** (CSV) — groups all inventory by supplier, shows item count, total quantity,
    cost value, and retail value per supplier. Sorted by cost value descending. Handles unspecified suppliers gracefully.
  - **Depot/Location Report** (CSV) — groups all inventory by storage location/depot, shows same
    metrics. Sorted by cost value. Handles unassigned items gracefully.

- **Backend helpers** (`app/lib/inventoryReports.ts`):
  - `getSupplierReport()` — aggregates inventory by supplier ID with totals
  - `getDepotReport()` — aggregates inventory by depot ID with totals
  - `SupplierReportItem` & `DepotReportItem` types for type-safe CSV export

- **UI enhancements** (`app/dashboard/reports/page.tsx`):
  - New report cards in a "Valuation reports" category (between Inventory and Operations)
  - Two new export dialogs with preview summaries (total inventory value by supplier/depot)
  - Export handlers with CSV download and user feedback (row counts, values)
  - **Enhanced metrics dashboard** — expanded from 4 to 6 metric cards (added Supplier count and
    Location count) for better inventory overview at a glance. Grid layout responsive: 2 cols on
    mobile, 3 on tablet, 6 on XL screens.
  - Supplier and Depot reports integrated into report card grid alongside existing Inventory and
    Operations reports. Same UX pattern as Stock Movements CSV export.

**Verification:** `npm run lint` ✅ · `npx tsc --noEmit` ✅ · `npm run build` ✅ (35/35 routes) ·
feature complete and ready for user testing.

**Untouchables:** No schema or auth changes. Pure read-only aggregation from existing inventory data.

---

## Sprint 12 — Search / Command Palette Polish  *(Complete)*

**Scope:** Polish the existing search / command palette (foundation built in prior work: Cmd+K
shortcut, `/dashboard/search` page, global search hook). Add missing pages to quick access,
improve discoverability and visual feedback.

**Delivered:**

- **New quick actions** — Added 3 missing pages to the command palette:
  - **Scanner** (Operations) — access the scanner workspace from anywhere
  - **Stock Alerts** (Pages) — quick link to low-stock and out-of-stock triage
  - **Activity** (Pages) — quick link to unified timeline feed

- **Updated STATIC_ROUTES** — registered the 5 new dashboard pages (Scanner, Alerts, Activity,
  plus maintained existing ones) so they appear in recent routes and are recognized by the palette

- **Improved UX:**
  - **Keyboard shortcut hint** in search input placeholder — now shows `⌘K` on Mac, `CtrlK` on
    other platforms, improving discoverability for users who haven't discovered the shortcut yet
  - Input focuses automatically on palette open for immediate typing
  - Clear recent history button already existed, kept
  - Tab navigation with focus trapping already existed, preserved

- **Foundation already in place** (built previously):
  - Cmd+K / Ctrl+K keyboard shortcut to open palette (global listener in DashboardShell)
  - Full global search page at `/dashboard/search` with grouping and filtering
  - Debounced search hook with result grouping (Items, Categories, Locations, Suppliers, Operations, Activity, Pages)
  - Recent queries + recent routes stored in localStorage
  - Keyboard navigation (arrow keys, enter, escape)
  - Quick actions with icon and tone-based chip styling
  - Result highlighting with HighlightedText component
  - Mobile-responsive overlay with backdrop blur

**Verification:** `npm run lint` ✅ · `npx tsc --noEmit` ✅ · `npm run build` ✅ (35/35 routes) ·
feature complete.

**Untouchables:** No schema or auth changes. Pure data additions (quick actions + routes) to
existing search infrastructure.

---

## Sprint 8 — QR & Labels Workspace Polish  *(Complete)*

**Scope:** Polish the existing QR Center workspace (foundation already built: QR generation, PDF
export, label layouts, business branding). Focus on UX clarity, mobile responsiveness, and
multi-item navigation.

**Delivered:**

- **Label preview enhancements:**
  - Added multi-item navigation with **prev/next buttons** when multiple items selected
  - Display counter ("3 of 5") showing current preview position
  - Users can now browse all selected labels before printing/exporting
  - Navigation buttons styled to match dashboard button language

- **Better empty states & messaging:**
  - **Clarified page description** — "Generate QR codes and print labels for your inventory items"
  - **Improved item selection heading** — "Select Items" with better guidance text about public links
  - **Distinct empty states** — separate messaging for "no search results" vs "no items available"
  - **Help text on preview empty state** — "Items need public links to generate QR codes—enable
    this in Item Details"

- **Branding UX improvements:**
  - **Restructured branding options** with descriptions (was 3 buttons, now full-width cards with
    explanatory text):
    - **SydIN Mark + Wordmark** — "Clean, professional SydIN branding on every label"
    - **Your Business Logo** — "Custom branding with your company logo (if configured)"
    - **No Branding** — "Clean labels with QR code only"
  - **Better upgrade messaging** — Styled in amber/red boxes with clearer explanation of
    plan requirements (Standard/Pro + logo in Settings)
  - **Logo error messaging** — Clearer text when business logo fails to load

- **Mobile responsiveness:**
  - Adjusted layout breakpoint from `xl` (1280px) to `lg` (1024px) for better tablet experience
  - Changed column ratio from `1.4fr/0.6fr` to `1.2fr/0.8fr` for better proportions
  - Better spacing and touch targets for mobile

- **Quick action integration (already wired):**
  - Inventory item menu + card footer button: "Generate QR / Label" option
  - Clicking action navigates to `/dashboard/qr-center` with item pre-selected
  - Found at line 3246 in `app/dashboard/inventory/page.tsx` (was already implemented)

**Changed files:** `app/dashboard/qr-center/page.tsx` (polish only — no logic/schema changes).

**Verification:** `npm run lint` ✅ · `npx tsc --noEmit` ✅ · `npm run build` ✅ (35/35 routes).

**Untouchables:** No schema or auth changes. QR generation, PDF export, and business settings
all preserved. No changes to branding logic — only UI presentation improved.

---

## Sprint 9 — Purchase Orders Workflow Polish  *(Complete)*

**Scope:** Polish the existing Purchase Orders list view to make payment status immediately visible
and improve visual hierarchy for at-a-glance scanning.

**Delivered:**

- **Always-visible payment status** — replaced conditional "Owe $X" chip with always-shown payment state:
  - **Green "Paid"** badge when full payment received
  - **Amber "Owe $X"** badge when balance pending (replaced previous hidden-if-zero chip)
  - **Gray "Cancelled"** badge for cancelled orders
  - Clear distinction between payment state and order status

- **Better visual hierarchy:**
  - Payment status + invoice attachment + order status all grouped together
  - Larger badges with better spacing (improved readability)
  - Color-coded payment states for quick visual scanning
  - Invoice attachment badge styled consistently (blue with file icon)

- **Mobile responsive layout:**
  - Payment/status section wraps on mobile (`flex-wrap`)
  - Single-line on desktop (`sm:flex-nowrap`)
  - Touch-friendly badge sizes

- **Quick action already in place:**
  - "Create purchase order" quick action in command palette (Cmd+K / Ctrl+K)
  - Navigates directly to `/dashboard/purchase-orders` list

**Changed files:** `app/dashboard/purchase-orders/page.tsx` (UI polish only).

**Verification:** `npm run lint` ✅ · `npm run build` ✅ (35/35 routes).

**Untouchables:** No schema or auth changes. All PO functionality (create, receive, record payment,
cancel, export) preserved and unchanged.

---

## Sprint M2 — Mobile Shell (Bottom Nav + Mobile Dashboard)  *(Complete, verified retroactively)*

**Scope:** Mobile Roadmap **M2 — Mobile shell** (see `SYDIN_MOBILE_ROADMAP.md`): a dedicated
mobile chrome for 375–767px viewports, replacing the desktop shell with a bottom-tab app feel.
Built across 5 commits by a separate fast-mode session without the usual plan-first/verify/log
cadence; this entry retroactively verifies and documents that work so the sprint log stays the
source of truth.

**Delivered (`ef49c60`, `880ed68`, `054c001`, `7a7f312`, `1751596`):**
- **`components/mobile/MobileShell.tsx`** (new) — bottom nav, 5 tabs (Home / Inventory / Scan /
  Orders / Activity) + center Scan action, plus a **More** bottom sheet (Settings, Reports,
  Stock Counts, Alerts, QR Center). Touch targets 48–56px, active-tab highlighting,
  notch-aware safe-area padding. Scroll-to-top on tab switch (`scrollTop = 0` via ref before
  `router.push()`).
- **`components/mobile/MobileDashboard.tsx`** (new) — mobile-optimized home screen: status
  cards, 2×2 quick-action grid (Add / Scan / PO / Labels).
- **`components/mobile/MobileShellWrapper.tsx`** (new) — fetches low/out-of-stock counts from
  `inventory` and feeds the Home tab's red alert badge (caps display at "9+").
- **`components/mobile/MobileInventoryCard.tsx`** (new) — compact mobile item card (60×60
  thumb, name/SKU/tags, color-coded quantity badge); not yet wired into the Inventory page's
  render path (present but unused as of this entry — see gap below).
- **`app/mobile.css`** (new, ~440 lines across the 3 commits) — mobile-only styles, hides
  desktop sidebar/header chrome under the shell's media queries. **Deviates from the project's
  usual pattern** of appending scoped rules to `app/globals.css`; kept as its own file for this
  entry rather than merged, since relocating it now is a refactor, not a polish fix.
  `app/globals.css` also gained ~243 lines of related rules in the first commit.
- **`app/dashboard/layout.tsx`** — wired to render the mobile shell/wrapper at mobile widths.
- Last commit (`1751596`) fixed two build breaks introduced by the polish commits (a stale
  `recentActivityCount` prop, an invalid `UiIconName` value `"home"` → `"dashboard"`).

**Gap found during retroactive verification:** **`app/dashboard/mobile-preview/page.tsx`** (new
route, ships as the 37th build route) is unauthenticated-reachable scaffolding left over from
building the shell — grepped repo-wide, **zero** references to `mobile-preview` from any nav,
link, or redirect. It duplicates `MobileShell` + `MobileDashboard` standalone for what was
clearly manual preview during development. Not deleted here (flagged instead of unilaterally
removing a page) — recommend Sayed either delete it or confirm it's intentionally kept as a
design-preview tool.

**Verification (run now, retroactively):** `npm run lint` ✅ (zero warnings) ·
`npx tsc --noEmit` ✅ (zero errors) · `npm run build` ✅ (36/36 routes, incl. the new
`/dashboard/mobile-preview`).

**Untouchables:** No auth, Supabase, schema, routing, or business logic changed — this is
additive mobile-only chrome plus a `dashboard/layout.tsx` render-path switch at mobile widths.

**Deferred / next (M3 — Scan-first, per `SYDIN_MOBILE_ROADMAP.md`):**
- Swap the Inventory page's mobile rendering over to `MobileInventoryCard` (component exists,
  unused).
- Fast scanner mode tuned for the mobile shell (open → ready/beep → result → next).
- Decide `mobile-preview` route's fate.
- Consider folding `app/mobile.css` into the `globals.css` layer-ordering convention once the
  mobile shell direction is confirmed stable (avoid a second stylesheet with independent
  cascade rules long-term).

---

## Bug fix — Dialogs required scrolling the page to see their own header/footer  *(Complete)*

**Scope:** Founder reported (screenshot, Purchase Orders detail dialog): opening a PO's history
required scrolling **up** to see the dialog's title/close button, and called it out as a general
"no scrolling" requirement for popups. Root cause was global — every `DialogShell` consumer
across the app (Purchase Orders, QR Center, Reports, Suppliers, Depots, Categories, Receiving,
Stock Counts, Set Alert Level, Stock Movement) shared it.

**Root cause:** `.ui-overlay` centers `.ui-dialog` with `align-items: center` inside a container
with no height cap on the dialog. When a dialog's content was taller than the viewport, the
browser centered the overflow **equally above and below**, clipping the top (title/close button)
and bottom (footer buttons) off-screen — the initial scroll position started in the middle, so
the user had to manually scroll up to reach the header. `SheetShell` (the slide-over variant)
never had this bug — `.ui-sheet-body` already had `flex: 1; overflow-y: auto`, so sheets always
kept header/footer pinned and only scrolled their body. `DialogShell` never got the equivalent
treatment.

**Fix (`app/globals.css`, base `.ui-dialog*` rules only — mobile's existing bottom-sheet override
at the `max-width: 639px` breakpoint already had its own correct version of this and was
untouched):**
- `.ui-dialog` — added `display: flex; flex-direction: column; max-height: calc(100vh - 6rem)`
  (6rem = the existing 2×`--space-4` overlay padding + 2×`--space-8` dialog margin already in the
  cascade, so the cap matches the real available space).
- `.ui-dialog-header` / `.ui-dialog-footer` — added `flex: 0 0 auto` so they never shrink or
  scroll away.
- New `.ui-dialog-body` rule — `flex: 1; overflow-y: auto; min-height: 0`, mirroring
  `.ui-sheet-body`'s existing pattern exactly.

**Effect:** every dialog now always shows its title and close button at the top and its footer
buttons at the bottom without any page/overlay scrolling; only genuinely long body content
scrolls, inside its own scrollbar, within the dialog.

**Verification:** Could not log into the live app in this session (no credentials), so verified
by injecting the real shipped `.ui-overlay`/`.ui-dialog` markup and classes into a running page
and reading computed layout: before the fix, title/footer were off-screen (`footerBottom: 1179px`
vs. `viewportHeight: 742px`) and `.ui-dialog-body` computed `overflow-y: visible`; after clearing
a stale Turbopack `.next` cache (same recurring issue noted in Sprint E2/PO-C) and restarting dev,
the same injected markup showed title top at 99px (visible), footer bottom at 689px (within the
742px viewport, visible), and `.ui-dialog-body` correctly scrolling internally
(`scrollHeight: 992` vs `clientHeight: 486`) — screenshot confirms header + footer pinned, body
scrollbar visible. `npm run lint` ✅ · `npx tsc --noEmit` ✅ · `npm run build` ✅ (36/36 routes,
verified twice — once before and once after the cache clear).

**Untouchables:** Pure CSS layout fix on shared primitives; no schema, auth, routing, or
component logic touched. The mobile bottom-sheet dialog behavior (already correct) was not
modified.

---

## Chrome Audit + P0 fix — the M2 mobile shell was invisible on phones  *(Complete)*

**Scope:** Founder asked for a deep audit ("mase7") of the app against premium SaaS standards.
Audited the **shared chrome** (sidebar + header + top nav) as the highest-leverage surface —
`DashboardShell.tsx`, `app/dashboard/layout.tsx`, the M2 mobile components, and every chrome
block in `globals.css` + `mobile.css`. Finding: the chrome does **not** need a visual redesign
(it's already a complete Glass 2.0 system); it had a live P0 bug and real structural debt.

**P0 (fixed) — the entire Sprint M2 mobile shell never rendered.** Verified live at 375px, the
mobile chrome was the exact inverse of what M2 intended:
- new `.mobile-shell-nav` → `display: none`
- old `.dashboard-mobile-nav` → `display: grid` (**visible**)
- old `.dashboard-mobile-header` → `display: flex` (**visible**)

**Root cause (`app/mobile.css`):** the block meant to hide DashboardShell's built-in chrome was
written against **guessed class names that match nothing** — `.dashboard-shell-sidebar` (real
name is `.dashboard-sidebar`), `banner`, `.dashboard-header`, `.dashboard-shell-footer`,
`.dashboard-shell-footer-nav` — so the old nav/header were never hidden. Its two
`[role="navigation"][aria-label=…]` selectors also matched nothing, because the real
`DashboardShell` navs set `aria-label` but **no `role` attribute**. Meanwhile the one catch-all
that *did* match, `nav[role="navigation"] { display: none !important }`, matched the **new**
`<nav role="navigation" className="mobile-shell-nav">` and killed it — `!important` beating the
non-important `.mobile-shell-nav { display: flex }`. Net effect: phones showed the old chrome and
none of the M2 work.

**Fix:** replaced that block with the five **real** class names
(`.dashboard-sidebar`, `.dashboard-mobile-nav`, `.dashboard-mobile-header`,
`.dashboard-tablet-header`, `.dashboard-desktop-toolbar`), and removed the catch-all element/role
selector entirely. Left a comment warning never to re-add a bare `nav[role=…]` selector there,
since `.mobile-shell-nav` is itself a `<nav role="navigation">`. This makes **MobileShell the
single mobile navigation system** via CSS only — DashboardShell's mobile markup is left in place
(reversible, no working component logic deleted).

**Also fixed — stale desktop "Activity" tab:** `DASHBOARD_TOP_TABS` still pointed Activity at
`/dashboard/stock-movements` (pre-Sprint-10). Sprint 10 moved Activity to its own
`/dashboard/activity` page and rewired the dashboard panel, sidebar, and command palette, but
missed this tab — so the chrome had three different "Activity" destinations. Now
`/dashboard/activity`. Confirmed Stock Movements keeps its own sidebar entry, so nothing is
orphaned.

**Verification:** live computed-style test at **375px** (new nav `flex`; old nav / old header /
tablet header / sidebar / desktop toolbar all `none`) **and at desktop** (sidebar `flex`, toolbar
`flex`, both mobile navs `none`) — confirming the mobile fix did not leak into desktop.
`npm run lint` ✅ · `npx tsc --noEmit` ✅ · `npm run build` ✅ (36/36 routes).
*(Method note: an initial test wrongly added a `role` attribute to the old nav that the real
component doesn't have, which inverted the result. Re-tested with markup copied exactly from the
components — the lesson from the mobile-scroll-fix entry applies to injected test markup too.)*

**Untouchables:** No auth, Supabase, schema, route definitions, or business logic changed. The
only behavior change is the corrected Activity tab destination.

**P2 (also fixed) — removed the dead `.dashboard-command-*` chrome CSS.** Proved dead repo-wide
(`grep` across all `.ts/.tsx/.js/.jsx/.html/.md` returned only this log's own mention), then
removed all **28 occurrences** across 5 clusters in `globals.css`: the full definition block
(`-context`, `-kicker`, `-title`, `-subtitle`, `-search`, `-search-copy`, `-shortcut`,
`-actions`, `-action`, `-primary`) plus its `@media (hover: hover)` block, a mobile
`display:none` rule, and — following the Sprint 3B pattern — **surgically stripped** the dead
tokens out of four selector lists shared with **live** siblings
(`.inventory-action-primary`, `.overview-action-primary`, `.inventory-action-secondary`,
`.inventory-toolbar-button`, `.inventory-quick-filter`, `.overview-action`, etc.), which were
left fully intact. Leftover from a previous toolbar design; the live toolbar uses
`.dashboard-top-*`. `app/globals.css` is ~150 lines shorter; brace balance verified
**2525/2525**.

**Mobile scroll re-checked (no bug found).** Because this is the first time `MobileShell` has
actually rendered, its scroll container is now live and nested around `.dashboard-shell-content`
— the same shape as the earlier mobile scroll-trap. Verified at 375px: `.mobile-shell-content`
is the real scroll container (`scrollHeight 3088 > clientHeight 812`), `.dashboard-shell-content`
is zero-range, and **both** compute `overscroll-behavior: auto` — not `contain`, which was the
actual cause of the old trap. Scroll chains correctly; **no fix needed**.

**Verification (P2 pass):** dead-token grep over `globals.css` returns **0** · brace balance
2525/2525 · `npm run lint` ✅ · `npx tsc --noEmit` ✅ · `npm run build` ✅ (36/36) · live
computed-style check after a `.next` cache clear: **0** `.dashboard-command-*` rules served,
live `.dashboard-top-searchbar` rules still present (7), toolbar `display:flex`, searchbar
`border-radius:999px`, and the `.inventory-action-primary` brand gradient preserved.
*(The dev server again served a stale CSS chunk — identical hash — until `.next` was cleared;
third occurrence of this Turbopack issue in this log. Production builds were never affected.)*

**Audit findings NOT fixed here (deliberately deferred):**
1. **Two nested shells.** `layout.tsx` renders `MobileShellWrapper` → `MobileShell` wrapping
   `DashboardShell`, so both full shells mount, with two independent Supabase queries for
   overlapping data (`MobileShellWrapper` reads inventory for the alert badge; `DashboardShell`
   reads settings + subscription). Now visually correct and scroll-safe (verified above), but
   structurally redundant — worth consolidating into one shell.
2. **Triple re-skin / cascade debt:** `.dashboard-nav-link` is redefined in 8+ blocks and the
   toolbar is re-styled almost in full three times (`:has(.sydin-overview)`,
   `:has(.inventory-workspace)`, `.dashboard-workspace-shell`), the last using `!important` on
   nearly every declaration. A leftover near-black active-tab pill (`#1f1e1a`) never renders
   because the brand gradient overrides it. This is the fragility behind the repeated
   "stale CSS / wrong winning rule" incidents in this log. **Deliberately deferred** — Sprint 3B
   established that relocating/reordering chrome CSS in this file risks visual regression, so it
   needs its own sprint with a manual visual pass, not a drive-by fix.
3. `app/mobile.css` still lives outside the `globals.css` layer-ordering convention (flagged in
   the Sprint M2 entry).

**Authenticated live verification (founder logged the preview in — completed 2026-07-24).**
Re-ran every check against the **real running app** instead of injected markup:
- **Desktop `/dashboard`**: renders correctly with real data (7 items · 3 depots · 35,180 units ·
  $480.00). Top tabs correct; **Activity now resolves to `/dashboard/activity`** and matches the
  sidebar entry, with Stock Movements still separately present — the three-way inconsistency is
  gone.
- **Mobile 375×812 — the M2 bottom nav rendered for the first time ever**: `display:flex`,
  pinned to the viewport bottom (`bottom === 812`), 80px tall, **all 5 tabs present**
  (Home · Inventory · Scan · Activity · More) with touch targets **50px** (Scan 72px) — all
  above the 44px minimum. `.mobile-shell-content` carries `padding-bottom: 88px`, correctly
  clearing the 80px nav so no content hides behind it.
- **Old chrome confirmed hidden in the real DOM** (not injected): `.dashboard-sidebar`,
  `.dashboard-mobile-nav`, `.dashboard-mobile-header`, `.dashboard-tablet-header`, and
  `.dashboard-desktop-toolbar` all compute `display:none` at mobile.
- **Navigation works**: routing to `/dashboard/inventory` kept the nav pinned and correctly
  moved the active state to the Inventory tab.
- **No horizontal overflow** on mobile inventory (`scrollWidth 375 === viewport 375`).

**M3 scope correction (found during this verification).** `MobileInventoryCard` renders **zero**
times on the real mobile inventory page — the page instead uses its own CSS-based mobile
treatment (`.inventory-mobile-header-card`, `.inventory-mobile-title`, …) from the Sprint 7
mobile-QA pass, which renders correctly with no overflow. So `components/mobile/MobileInventoryCard.tsx`
(~107 lines + ~98 lines of CSS) is **unused dead code**, and the M3 task as previously written
("wire `MobileInventoryCard` into Inventory") would *replace a working mobile layout with a
duplicate implementation* — a regression risk for no user-visible gain. **M3 should be re-scoped**
to either delete the unused component or make a deliberate decision to adopt it; it should not be
wired in by default.

---

## Mobile Shell audit — dead-code removal + latent safe-area bug  *(Complete)*

**Scope:** Deep-scan of the **Mobile Shell** surface only (`components/mobile/*`, `app/mobile.css`,
and the mobile-shell blocks in `app/globals.css`) — audit-first, then surgical fixes. One surface,
presentation-only, no auth/Supabase/schema/routing/business-logic touched.

**Audit findings (evidence-backed):**
1. **[HIGH — flagged, deliberately NOT fixed] Mobile shell nav CSS is fully duplicated across two
   files with conflicting values.** `app/globals.css:17213-17316` **and** `app/mobile.css:3-256`
   both define `.mobile-shell`, `.mobile-shell-content`, `.mobile-shell-nav`, `.mobile-nav-tab*`
   and the desktop-hide block. Values diverge: `.mobile-nav-tab-center` margin-top `-20px`
   (globals) vs `-18px` (mobile.css); `:active` bg `.10` vs `.08`; icon-wrapper radius `16px` vs
   `14px`, press scale `.95` vs `.92`, transition `200ms` vs `150ms`. Import order
   (`app/layout.tsx:2-3`: globals **then** mobile.css) means **mobile.css wins**, so it renders
   coherently today — this is a regression-risk/maintainability defect, **not** a current visible
   break. The copies have also diverged: globals.css still styles an older `.mobile-alert-card*` /
   `.mobile-dashboard-subtitle` that the current `MobileDashboard` no longer renders (dead), while
   mobile.css carries the live `.mobile-metric-card*`. **Deferred** — this is the previously-flagged
   "fold `mobile.css` into `globals.css`" refactor (M2 deferred #4, Chrome-Audit deferred #3). It
   needs a live device/browser computed-value pass, which this session's environment cannot do (no
   browser-automation tool), and blind-refactoring the just-recovered nav is how it went invisible
   before. Left for its own sprint with a real visual check.
2. **[MEDIUM — fixed] Invalid `max(0, env(safe-area-inset-bottom))`** (`app/mobile.css:30`). Inside
   CSS `max()`, unitless `0` is a `<number>` and cannot be compared to a `<length>`, so the parser
   discards the whole `padding-bottom` declaration. It was **masked** because globals.css:17242 has
   the correct `max(0px, …)` as a cascade fallback — but the moment the duplicate above is removed,
   the safe-area padding silently breaks. Corrected to `max(0px, env(safe-area-inset-bottom))`.
3. **[MEDIUM — fixed] Dead code.** `components/mobile/MobileInventoryCard.tsx` had **zero**
   references repo-wide (grep across `.ts/.tsx/.css/.md`; only docs mention it). Deleted it plus its
   sole CSS block `.mobile-inventory-card*` (`app/mobile.css`, ~97 lines). This resolves the M3
   "delete or adopt `MobileInventoryCard`" open question in the delete direction (see Decision Log
   2026-07-24). Confirmed `.mobile-inventory-card*` existed **only** in mobile.css (0 occurrences in
   globals.css).

**Also confirmed as NON-issues (checked, no action):**
- Mobile nav's cyan/blue accent is **on-brand**: `--sydin-blue: #38bdf8` / `--sydin-blue-strong:
  #2563eb` (globals.css:29-30) are the brand tokens; the Scan-button gradient matches them exactly.
- `app/mobile.css` is live (imported at `app/layout.tsx:3`), not a dead file.

**Deliberately left undone:** the CSS duplication consolidation (finding #1, needs live verification);
the `mobile-preview` route + `MobileDashboard` (dead-in-production but a documented **founder**
keep-or-delete decision — not mine to make unilaterally); safe-area *notch* height/padding tuning
(cannot be verified without a real notched device/simulator, and touching the duplicated height/
padding across both files is part of finding #1).

**Verification:** `npm run lint` ✅ (clean) · `npx tsc --noEmit` ✅ (0 errors) · `npm run build` ✅
(36/36 routes). **Live browser computed-value check: NOT performed** — no browser-automation tool in
this environment. Mitigation: both applied fixes are chosen to be **rendering-neutral** (the `max()`
value was already masked by globals' fallback; the deleted component rendered nowhere), so there is
no visual delta to verify; the only surface that *would* need a live check (finding #1) was
deliberately not touched.

---

## Inventory workspace audit — card status badge color-coding was dead (cascade override)  *(Complete)*

**Scope:** Deep-scan of the **Inventory workspace** surface (`app/dashboard/inventory/page.tsx`
[5204 lines], `components/inventory/InventoryItemCard.tsx`, and the `inventory-card-*` CSS in
`app/globals.css`). Audit-first, targeted at high-signal defect classes — a full line-by-line audit
of a 5204-line page is not something one pass can responsibly complete; findings below are
evidence-backed, not exhaustive.

**Confirmed as NON-issues (checked, no action needed):**
- **Image fitting is correct:** item photos use `object-cover` (page.tsx:3314, 3481; card img:239),
  the generic `InventoryThumbnail` default and the add-form preview use `object-contain p-1.5`
  (page.tsx:346, 3825). Photos crop-to-fill, thumbnails/previews letterbox — correct.
- **Page anatomy complete:** loading (`LoadingSkeletonGroup` p.3198), empty (`DashboardEmptyState`
  p.3561), and error (`DashboardNotice` p.2795) states all present.
- **`InventoryItemCard` interaction/a11y is solid:** menu button has `aria-haspopup`/`aria-expanded`,
  Escape closes + refocuses, outside-click/scroll/resize close it, menu items are `min-h-11` (44px)
  touch targets, card is keyboard-activatable.

**Defect found + FIXED — grid/card status badge had no stock-status color distinction (verified):**
- **Root cause (confirmed against COMPILED CSS, not source reasoning):** the card status pill is
  `<span class="inventory-card-tag inventory-card-status {tone}">` where `{tone}` was raw Tailwind
  color utilities (`bg-violet-50 text-violet-700` for danger, etc.). `app/globals.css` authors all
  `.inventory-*` rules **unlayered**, while Tailwind color utilities compile **inside
  `@layer utilities`**. Verified in the built CSS: `.inventory-card-tag{…}` → `insideLayer:false`,
  `.bg-red-50` → `insideLayer:true`. Unlayered beats layered regardless of specificity/source order,
  so `.inventory-card-tag`'s own `background`/`color`/`border` (defined **twice**: globals.css:10524
  and 11648 — a duplicate) overrode the tone utilities. Net: **every card status badge rendered the
  same neutral tone** — no danger/warning/success color. The inventory **list** view's pill
  (page.tsx:3323) works only because it has no `.inventory-card-tag`. As a secondary tell, the card's
  danger tone was also mapped to **violet** while the list view maps danger to **red** — same status,
  two colors.
- **Fix:** replaced the dead Tailwind tone utilities with tone **hook classes**
  (`inventory-card-status--danger|warning|success`) in `InventoryItemCard.tsx`, and appended three
  scoped rules to the **end** of `app/globals.css` as `.inventory-card-tag.inventory-card-status--{tone}`
  (specificity 0,2,0 > `.inventory-card-tag` 0,1,0 → deterministic win; both unlayered so layering is
  irrelevant). Palette mirrors the already-working list view (red `#dc2626`/`#fef2f2`/`#fecaca`, amber
  `#b45309`/`#fffbeb`/`#fde68a`, plus cyan for success). **Scenario-independent:** correct whether or
  not the old utilities rendered. No existing rule reordered/relocated (respects Sprint 3B + hard
  constraint on globals.css source order).

**Verification:** `npm run lint` ✅ · `npx tsc --noEmit` ✅ · `npm run build` ✅ (36/36) · globals.css
brace balance **2528/2528** (was 2525; +3 rules) · **compiled-CSS check**: new rule present
(`.inventory-card-status--danger{color:#dc2626;background:#fef2f2;border-color:#fecaca}`) and the
unlayered-vs-layered diagnosis confirmed programmatically. **Live browser pixel check NOT performed**
(no browser-automation tool in this environment); mitigated by (a) deterministic specificity, (b)
colors copied from the list view's proven pills, (c) compiled-CSS confirmation. Founder should still
eyeball the grid view once; trivially revertible.

**Deliberately left undone:** exhaustive audit of the remaining ~5000 lines of the inventory page;
the duplicate `.inventory-card-tag` definition (globals.css:10524 vs 11648) and broader inventory CSS
cluster consolidation (Sprint 3B protects this file's source order — needs its own verified sprint);
hardcoded light-mode colors in the card action menu (`bg-white`/`text-slate-700`, InventoryItemCard.tsx:278)
and the add-form image preview (`bg-[#f4f0e8]`, page.tsx:3820) that don't adapt to the dark theme —
noted, low priority (default theme is light), not touched.

---

## Dashboard home audit — clean, no code change  *(Complete — audit only)*

**Scope:** Deep-scan of the **Dashboard home** surface (`app/dashboard/page.tsx` [1054 lines] + its
`.sydin-overview-*` CSS in `app/globals.css`). No code changed — the surface is well-built; forcing an
edit would have been busywork.

**Verified correct (evidence):** image fitting (`.sydin-overview-thumb img { object-fit: cover }`,
globals.css:13901); loading skeletons on all 6 panels; empty states on every panel (each with a CTA);
error state (`role="alert"`, page.tsx:650) plus robust `.catch()` fallbacks in the data loader
(page.tsx:375-424); hover/active states on every interactive row/card correctly gated behind
`@media (hover: hover)` (globals.css:14150 — no sticky-hover on touch); reduced-motion respected in
`CountUpNumber` and `StockHealthGauge`; SVG gauge has `aria-label`; `@container (max-width: 1100px)`
handles summary/grid responsiveness (globals.css:14167).

**Flagged for founder decision (NOT fixed — design/product calls, not bugs):**
1. **Duplicate action set.** `topActions` (Add Item / Set Depots / QR Scan / Stock Count) renders in
   both the hero action bar (page.tsx:633) and the "Top actions" panel (page.tsx:761, which also adds
   Create PO + Receive). Those four appear twice on one screen — redundant. Fix = curate two distinct
   sets; needs Sayed's call on which actions live where.
2. **"Create PO" label vs destination.** Panel link (page.tsx:767) targets the PO list
   (`/dashboard/purchase-orders`) while its label implies creation; the spending panel's CTA uses
   `/dashboard/purchase-orders/new`. Minor mismatch — possibly intentional.

**Verification:** read-only audit; no build run needed (no code changed). Prior surfaces' changes
(mobile shell, inventory card) remain green per their entries.

---

## Purchase Orders audit — clean, no code change  *(Complete — audit only)*

**Scope:** Deep-scan of `app/dashboard/purchase-orders/page.tsx` (1184 lines) and
`app/dashboard/purchase-orders/new/page.tsx` (1240 lines) + their `.po-*` CSS. No code changed.

**Checked specifically because Inventory had a real bug here:** status/state color-coding. This
surface uses the generic `Badge`/`ui-badge-{tone}` component (`components/ui/Badge.tsx`), which sets
its own colors from real design tokens (`--status-danger-text` etc.) — confirmed distinct per tone in
globals.css:679-701, not a repeat of the Inventory unlayered-override bug. The "Owe / Paid / Invoice"
inline pills (page.tsx:736-763) use bare Tailwind utility classes with no competing unlayered class on
the same element (`.po-history-row` only styles the row container, not descendant spans) — no
override risk.

**Verified correct:** page anatomy (loading/empty/error via `LoadingSkeletonGroup`,
`DashboardEmptyState`, `DashboardNotice` — page.tsx:615-644); schema-missing state has its own guided
banner distinct from generic errors; attachment images use `object-contain` for full document review
(list detail view, 480×280) and `object-cover` for the small 96×96 upload-preview thumbnail (new-order
form) — a defensible photo-thumbnail-vs-full-review split, not an inconsistency; hover states on
`.po-history-row` correctly gated behind `@media (hover: hover)` (globals.css:16573); both pages are
referenced from real navigation (no dead route, unlike the earlier `mobile-preview` finding).

**No defects found.** Two duplicate-looking `.po-history-row { }` blocks (globals.css:15783, 15804)
are an intentional split (base rule + a commented "status color rail" border-left addition), not
accidental duplication — left as-is.

**Verification:** read-only audit; no code changed, so no build re-run needed.

---

## Scanner Workspace audit — clean, no code change  *(Complete — audit only)*

**Scope:** `app/dashboard/scanner/page.tsx` (1222 lines), `components/scanner/BarcodeScannerView.tsx`,
`components/scanner/ScannerModal.tsx`. No code changed.

**Checked specifically because this surface has settled business rules that are easy to violate in
the UI:** confirmed Transfer mode's copy matches the 2026-07-19 decision exactly — hint "Move an item
to another depot", button "Move to depot" (page.tsx:997-1000), no quantity input anywhere in the
transfer flow.

**Verified correct:** camera lifecycle (`BarcodeScannerView.tsx`) properly stops MediaStream tracks
and clears `srcObject` on teardown, uses a ref-based callback pattern so the effect only reruns on
`active`/`continuous` (not on every re-render), debounces duplicate scans in continuous mode
(`DUPLICATE_SCAN_WINDOW_MS`); camera-permission/unsupported errors surface via
`role="status" aria-live="polite"` with a working "Try Again" that remounts the view via `key`;
migration-gated modes (Transfer, Assign/Repair/Return) show a visibly disabled state
(`opacity-60`, `cursor-not-allowed`) *and* surface the reason both as a `title` tooltip and as an
on-click error (works for touch, not just hover); mode buttons are `min-h-11` (44px) with
`aria-pressed`; page anatomy (loading/empty/error) present at lines 661-674, 798-810, 1151, 1215; the
camera `<video>` uses `object-cover` (correct — a live feed should fill, not letterbox).

**No defects found.**

**Verification:** read-only audit; no code changed.

---

## Item Details / Add-Edit forms audit — fixed a real duplicate-error render + form a11y gap  *(Complete)*

**Scope:** Deep-scan of `app/dashboard/inventory/[id]/page.tsx` (1716 lines), `app/dashboard/add-item/page.tsx`
(1345 lines), `app/dashboard/inventory/EditItemForm.tsx` (872 lines), `components/inventory/ItemDetailsSlideOver.tsx`
(1022 lines) — the core item CRUD surface.

**Confirmed as NON-issues (checked, no action):**
- Image fitting is intentional and consistent: the compact grid/list thumbnails use `object-cover`
  (checked in the earlier Inventory workspace audit); the Item Details hero image, Add-Item preview,
  and Slide-over hero all use `object-contain` on a shared cream `#f4f0e8` background — a deliberate
  "full product photo, no cropping" treatment at hero size, distinct from thumbnail size. The business
  logo next to the QR code correctly uses `object-contain` per the project's photos-vs-logos rule.
- Stat-card tone coloring (`inventory/[id]/page.tsx:152-161`) uses plain Tailwind utilities with no
  competing unlayered class on the same element — not a repeat of the Inventory card-badge bug.
- `ItemDetailsSlideOver`'s status pill (`item-details-status` + `-danger`/`-success`) is correctly
  built: both classes are same-specificity same-file rules, and the modifier class is written **after**
  the base in source, so it wins by normal CSS tie-break — this is the exact pattern later used to FIX
  the Inventory bug, done correctly here from the start.
- Hiding `.item-details-status` at ≤640px is not an information-loss bug: the same low-stock signal is
  duplicated in a fuller alert card in the slide-over body (`ItemDetailsSlideOver.tsx:974-1006`).

**Defects found + FIXED (verified via render-tree logic, not CSS-cascade guessing — deterministic,
no browser needed):**
1. **Duplicate error message rendered for the Unit field** (`EditItemForm.tsx`, was ~line 587-605).
   `<Select error={fieldErrors.unitType} />` already renders its own `<p role="alert">{error}</p>`
   internally (`components/ui/Select.tsx:339-346`) whenever `error` is truthy — but the form *also*
   rendered a separate `<FieldError id="edit-unit-error" message={fieldErrors.unitType} />` right
   after it, so the same validation message appeared twice, stacked, and would be double-announced to
   screen readers. Fixed by removing the redundant external `<FieldError>` — `Select`'s own error
   text (with `role="alert"` for immediate announcement) is sufficient and is the only place the Unit
   error now renders.
2. **`EditItemForm.tsx`'s 6 text/number inputs (name, quantity, custom unit label, min stock level,
   cost price, selling price) had no `id`/`htmlFor`/`aria-describedby`** — labels were visually
   adjacent but not programmatically associated with their inputs, and `FieldError` rendered an
   `id` that nothing ever referenced. Confirmed this is a real regression/inconsistency, not a design
   choice: the sibling `add-item/page.tsx` form (same field set, same `FieldError` component) already
   has this fully wired (e.g. `product-name` / `product-name-error`) — `EditItemForm.tsx` was the
   outlier. Added matching `id` + `htmlFor` + conditional `aria-describedby` to all 6 fields, mirroring
   `add-item`'s existing pattern exactly. Zero visual change — pure semantic-HTML/ARIA additions.

**Verification:** `npm run lint` ✅ · `npx tsc --noEmit` ✅ · `npm run build` ✅ (36/36 routes). No CSS
touched, so no live-render risk; both fixes are deterministic JSX/markup corrections, not cascade
guesses, so no browser check was needed for confidence (unlike the Inventory badge fix).

**Deliberately left undone:** did not extend `Select`'s public API to accept an external `htmlFor`
target for the Depot/Supplier/Unit label wrappers (`Select` generates its own internal `id` via
`useId()`, not exposed) — those fields have no validation error today so the a11y gap there is lower
value; revisit if `Select` gains error states for those fields. Did not audit the remaining ~4600 lines
of these four files exhaustively (Item Details' QR/label actions menu, Slide-over's stock-movement
sub-forms, Add-Item's supplier/depot creation modals) — time-boxed to the CRUD path most exercised by
this fix's own surface.

---

## Stock Alerts audit — clean, no code change  *(Complete — audit only)*

**Scope:** `app/dashboard/alerts/page.tsx` (463 lines). No code changed.

**Verified correct:** full page anatomy (`LoadingSkeletonGroup`, `DashboardEmptyState`,
`DashboardNotice`); item thumbnail uses `object-cover` correctly; entirely built from shared
primitives (`MetricCard`, `FilterBar`/`FilterChip`, `ActionButton`, `DashboardToolbar`) so no
custom CSS cascade risk like the Inventory card bug; responsive grid collapses to single-column
below `sm:`; reuses `ItemDetailsSlideOver`, `SetAlertLevelDialog`, `StockMovementDialog` rather than
re-implementing.

**No defects found.**

**Verification:** read-only audit; no code changed.

---

## Receiving audit — clean, no code change  *(Complete — audit only)*

**Scope:** `app/dashboard/receiving/page.tsx` (1937 lines, multi-step receiving wizard). No code
changed.

**Verified correct:** item thumbnails use `object-cover` (lines 1221-1226, 1360-1365); all
status/warning/danger inline messages are plain Tailwind utilities with no competing unlayered
custom class on the same element — no risk of the Inventory-style override; the page has no single
"main empty state" (it's a step wizard, not a list view) but every contextual empty case has a real,
informative inline message (empty inventory before receiving, no stock-in history yet) rather than a
silent blank — a legitimate design choice distinct from `DashboardEmptyState`, not a gap.

**No defects found.**

**Verification:** read-only audit; no code changed.

---

## Stock Counts audit — clean, no code change  *(Complete — audit only)*

**Scope:** `app/dashboard/stock-counts/page.tsx` (1493 lines, setup → count → review wizard). No code
changed.

**Verified correct:** item thumbnails use `object-cover`; all difference/status badges (e.g.
`difference > 0` emerald / `< 0` red, lines 1012-1019, 1304-1309) are plain `<span>`s with only
conditional Tailwind utilities — no competing custom class, no cascade risk; "start count" is
correctly `disabled` when inventory is empty (line 810), with distinct messages for "inventory is
empty" vs. "no items match this count's scope" (lines 848, 854) — thorough edge-case handling, not a
gap, despite not using the shared `DashboardEmptyState` (this page is a setup wizard, not a list view,
so inline contextual messages are the right pattern here, consistent with Receiving).

**No defects found.**

**Verification:** read-only audit; no code changed.

---

## Suppliers + Depots audit — fixed same a11y gap, Depots clean  *(Complete)*

**Scope:** `app/dashboard/suppliers/page.tsx` (806 lines) + `app/dashboard/depots/page.tsx`
(707 lines). Both have full page anatomy (`DashboardEmptyState`/`DashboardNotice`/
`LoadingSkeletonGroup`) and no visual defects found — neither displays photos, so no image-fitting
surface exists.

**Fixed — same class of defect as the Item Details/Add-Edit forms audit:** `SupplierForm`'s two
validated fields (Supplier name, Email) had inline error messages with no `id`/`htmlFor`/
`aria-describedby` association, identical to the `EditItemForm.tsx` gap fixed earlier this session.
Added the same wiring (`supplier-name-input`/`supplier-name-error`,
`supplier-email-input`/`supplier-email-error`). Zero visual change.

**Depots — confirmed clean, nothing to fix:** the depot form has no field-level validation-error
state to associate (relies on native `required` only, no `FieldError`-equivalent rendering), so there
was no gap of this kind to fix.

**Verification:** `npm run lint` ✅ · `npx tsc --noEmit` ✅ · `npm run build` ✅ (36/36 routes).

---

## Categories, Settings, Pick Lists audit — clean functionally, one consistency flag  *(Complete — audit only)*

**Scope:** `app/dashboard/categories/page.tsx` (1796 lines), `app/dashboard/settings/page.tsx`
(2085 lines), `app/dashboard/pick-lists/page.tsx` (626 lines) + `[id]/page.tsx` (1613 lines). No code
changed.

**Checked specifically for the a11y gap found in EditItemForm/Suppliers:** both Categories and
Settings use the **wrapping-`<label>` pattern** (`<label>Text<input /></label>`), which is
implicitly, correctly associated by the browser without needing explicit `id`/`htmlFor` — confirmed
clean, not a repeat. Neither has field-level validation errors to associate (Categories: one
form-level `role="alert"` message; Settings: no per-field errors at all).

**Flagged for awareness (NOT fixed — consistency debt, not a functional bug):** Pick Lists (both
pages) use **zero** of the shared `DashboardPageShell`/`DashboardEmptyState`/`LoadingSkeletonGroup`/
`DashboardNotice` primitives that every other audited page this session uses. Functionally nothing is
missing — both pages have real loading (custom `animate-pulse` skeleton grid), empty (a bespoke
"Create your first Pick List" card), and error (`pageError` state, rendered) handling — but it's all
hand-rolled instead of reusing the shared components CLAUDE.md calls out
("reuse the primitives... only create new UI when repeated UI clearly deserves abstraction"). Not
fixed here: swapping working custom UI for shared primitives is a visual change this session can't
browser-verify, and the risk/reward doesn't justify a blind edit for a page with no functional gap.
Worth a dedicated pass if/when Pick Lists gets its own polish sprint.

**No functional defects found in any of the three.**

**Verification:** read-only audit; no code changed.

---

<!-- Append the next sprint entry below this line. -->
