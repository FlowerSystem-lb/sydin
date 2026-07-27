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

## Reports, Activity, QR Center, Search audit — all clean  *(Complete — audit only)*

**Scope:** `app/dashboard/reports/page.tsx` (1274 lines), `app/dashboard/activity/page.tsx`
(365 lines), `app/dashboard/qr-center/page.tsx` (864 lines), `app/dashboard/search/page.tsx`
(332 lines). No code changed.

**Verified correct:** all four use the shared `DashboardPageShell`/`DashboardEmptyState`/
`DashboardNotice`/`LoadingSkeletonGroup` primitives; Reports' `Select` filters use the wrapping-label
pattern with no `error` prop, so no risk of the duplicate-render bug fixed in EditItemForm; QR
Center's business-logo preview correctly uses `object-contain`, its item-photo preview correctly uses
`object-cover`; Activity and Search have no image-fitting surface to check.

**No defects found.**

**Verification:** read-only audit; no code changed.

---

## Notes batch 1 — Sidebar hover tooltip: smoother, simpler (Sayed note #13a)  *(Complete)*

**Scope:** First item from the founder-notes roadmap
([SYDIN_NOTES_ROADMAP_2026-07.md](SYDIN_NOTES_ROADMAP_2026-07.md)). Sayed: when the mouse is on a
collapsed-sidebar icon, the page name should appear as small simple text and vanish smoothly on
leave — "smoother fps." The reveal already existed (Sprint D1) but wasn't buttery and its styling
was heavy.

**Delivered (presentation-only, `app/globals.css` — the two winning tooltip blocks):**
- **GPU compositing for FPS** — added `will-change: opacity, transform;` + `backface-visibility:
  hidden;` and `translateZ(0)` to the reveal so it stays on the compositor and never triggers a
  layout repaint (only opacity + transform animate). Verified live: computed `will-change` now
  reports `opacity, transform` (was `auto`).
- **Snappier, smoother timing** — `opacity 140ms ease-out` + `transform 200ms
  cubic-bezier(0.22,1,0.36,1)` (was 170ms/230ms), and a shorter travel (`translateX(-6px)` → 0,
  was −8px) so it feels lighter.
- **Small + simple chip** — font 0.72rem/700, tighter padding (`0.28rem 0.6rem`), smaller radius
  (9px), softer shadow, slightly closer to the rail. Was a bigger white pill with a large overlay
  shadow.
- **`prefers-reduced-motion`** — new fallback: name reveals instantly, no slide.

**Verification:** live on the real authenticated dashboard at a collapsed-rail width (1040px,
72px rail). Resting state computed `opacity:0, translateX(-6px), will-change: opacity, transform`.
Real-cursor hover over the Inventory icon → its tooltip (and only its) computed `opacity:1,
translateX(0)`, `:hover` on the correct link. `npm run lint` ✅ · `npm run build` ✅ (36/36).
*(Hit the recurring Turbopack partial-stale-CSS issue mid-verify — the font-size edit was live but
the motion block wasn't; `rm -rf .next` + restart fixed it, then all values verified live.)*

**Note for the founder:** this only changes how the reveal *feels/looks* — the reveal itself was
already shipped. If it wasn't appearing at all on your build, that was the old-deploy / stale-cache
issue flagged at the top of the notes roadmap, not missing code.

**Untouchables:** none touched — scoped CSS only.

**Deferred (note #13b, separate batch):** upgrading each sidebar icon to a distinctive custom
symbol per section — cosmetic, low priority, sequenced last in the notes roadmap.

---

## Notes batch 2 — Dark sidebar tooltip (Sortly ref) + top-tab lift fix  *(Complete)*

**Scope:** Founder gave a Sortly reference — the collapsed-rail hover tooltip should be a **dark
charcoal chip** (was a light/white pill), "professional and smoother." Plus the verified note #12
top-tab hover bug, done in the same chrome surface.

**Delivered (`app/globals.css`, presentation-only):**
- **Dark tooltip chip** — charcoal `#1f2a37`, white 0.72rem/650 text, tighter padding, 9px radius,
  softer shadow. Applied in **both** winning style blocks (see cascade note below).
- **Top-tab hover no longer lifts (note #12)** — removed `.dashboard-top-tab:hover` from the
  `translateY(-1px)` group; it keeps only its background-highlight hover, so it no longer jumps up
  into the divider line. The lift is preserved for the icon/pill buttons.

**Cascade trap hit + fixed (worth recording):** the first dark edit only landed on
`.dashboard-workspace-shell .dashboard-nav-tooltip` (specificity 0,2,0). But on the **Overview and
Inventory** pages a higher-specificity `:has()` block —
`.dashboard-shell:has(.sydin-overview) .dashboard-nav-tooltip` (0,3,0) — was still forcing the
chip **white**, so the tooltip was dark everywhere *except* the two most-used pages. Found it by
dumping every matched `background` rule for the selector in the live browser (not by reading
source). Fixed by applying the dark styling to that `:has()` block too, with a comment tying the
two blocks together. (This is exactly the multi-block cascade debt flagged in the chrome audit.)

**Verification:** live at collapsed-rail width (1040px) on the real dashboard. Tooltip computed
`background rgb(31,42,55)` + `color white` on the Overview page (`.sydin-overview` present) — i.e.
the `:has()` winner is now dark. Rule inspection confirms the only `.dashboard-top-tab:hover` rule
sets a background highlight and **no transform**. Reveal mechanics (opacity 0→1, translateX→0)
unchanged from batch 1. `npm run lint` ✅ · `npm run build` ✅ (36/36).
*(Two `.next` clears needed — Turbopack served partial-stale CSS twice mid-verify.)*

**Untouchables:** scoped CSS only; no auth/schema/routing/logic.

---

## Notes batch 3 — Header slim-down: tabs removed + "Add" menu  *(Complete)*

**Scope:** Notes #12 (top tabs / header rethink) and #4 (general "+ Add" instead of only "Add
Item"), done together since both live in the desktop toolbar. Founder asked for a professional
recommendation rather than choosing himself.

**Decision (mine, recorded):** **remove the five top tabs.** They duplicated sidebar links exactly
(Overview · Activity · Inventory · Orders · Receiving all exist in the sidebar), which is what made
the header feel cluttered and what made the note-#12 hover bug possible. Mature SaaS (Linear,
Stripe, Sortly, Notion) runs **one** nav system. New rule: **sidebar owns navigation, header owns
actions.** Deliberately did **not** build a separate search page (note #12 suggested one) — Cmd+K
and `/dashboard/search` already cover it.

**Delivered:**
- **`DashboardShell.tsx`** — removed `DASHBOARD_TOP_TABS` and its `<nav>`; the slot now renders the
  **current page title** (`.dashboard-top-context`, from the existing `getDashboardPageContext`, so
  it already handles "Inventory / Item Details" etc.). Replaced the lone "Add Item" button with an
  **Add menu** (`ADD_MENU_ITEMS`): New item → `/dashboard/add-item`, Purchase order →
  `/dashboard/purchase-orders/new`, Receive stock → `/dashboard/receiving`; each with a one-line
  description. Reuses the existing `MenuSurface`; outside-click + Escape close mirror the
  account-menu pattern (Escape restores focus to the trigger).
- **`app/globals.css`** — appended scoped `.dashboard-top-context*` / `.dashboard-top-add*` block:
  title ellipsis, menu positioning, hover/focus-visible states, chevron rotate with a
  `prefers-reduced-motion` opt-out.

**Note:** `quickAddVisible` is still used by the tablet/mobile headers, so it stays; the desktop Add
menu is always available (it is now the primary create affordance, not a duplicate of a page button).

**Lint catch worth keeping:** a first pass closed the menu on route change via
`useEffect(() => setAddMenuOpen(false), [pathname])`, which tripped `react-hooks/set-state-in-effect`
(cascading renders). Removed rather than suppressed — the menu items are `<Link>`s that already call
`setAddMenuOpen(false)` on click, so the effect was redundant. Verified live: after navigating from
the menu the dropdown is closed.

**Verification:** `npm run lint` ✅ · `npx tsc --noEmit` ✅ · `npm run build` ✅ (36/36) · live on the
logged-in app: header renders "Inventory" title + Add ▾ + scan + account with **0**
`.dashboard-top-tab` nodes remaining; clicking Add opens the 3-item menu (chevron rotates); clicking
"Purchase order" navigated to `/dashboard/purchase-orders/new`, closed the menu, and the header title
updated to "Purchase Orders". Console errors were only the known environmental Supabase auth
`Failed to fetch` timeouts — none from this change.

**Untouchables:** no auth/schema/routing-definition/business-logic changes; the `/dashboard/search`
route and Cmd+K palette were left as-is.

---

## Cleanup — removed the orphaned `/dashboard/mobile-preview` route  *(Complete)*

**Scope:** Last open item from the Sprint M2 audit. `app/dashboard/mobile-preview/page.tsx` was
dev scaffolding left over from building the mobile shell, but it **shipped as a real production
route** (the 36th).

**Why it was safe to delete:** zero references repo-wide (grepped `.ts`/`.tsx` outside its own
file); it carried a hardcoded `recentActivityCount: 5, // Demo value`; and because
`app/dashboard/layout.tsx` already wraps every dashboard page in `MobileShellWrapper` →
`MobileShell`, visiting it would have mounted a **second, nested `MobileShell`** inside the first —
a latent bug, not just dead weight.

**Verification:** `npm run lint` ✅ · `npx tsc --noEmit` ✅ · `npm run build` ✅ — route count
**36 → 35**, with no `mobile-preview` entry in the manifest.

**Note on parallel work:** the other item flagged in the M2 audit, the unused
`components/mobile/MobileInventoryCard.tsx` (+ ~100 lines of `mobile.css`), was already removed by
the parallel VS Code session in `9001afa`, so it is not re-handled here. Local `main` and
`origin/main` were verified in sync before and after this change.

---

## Settings reorganization — roadmap purge + 10 → 6 sections  *(Complete)*

**Scope:** Founder asked me to read Settings, decide, and reorganize. An earlier ChatGPT-authored
pass had embedded **six "Roadmap" cards holding ~33 chips** for unbuilt features, spread across the
Settings UI.

**Decision (mine):** remove the roadmap cards from the UI, but **preserve every item** — the founder
confirmed they are genuine future features. Rationale: Settings is a *utility* surface. Listing 33
controls a user cannot touch buries the ones that work, and it advertises how much of the platform
is unbuilt (the Security section alone displayed 9 missing controls to a paying customer). Roadmaps
belong in the backlog doc, which is where the work is actually planned from.

**Delivered:**
- **`docs/SYDIN_FEATURE_BACKLOG.md`** — new **§15 "Settings & Account platform"** capturing all 33
  items in six sub-sections (branding · reports automation · billing system · email & notifications ·
  advanced security · advanced data tools), each with a **priority** and its **real dependency**.
  Two useful facts surfaced while triaging: the **email-provider decision is the single blocker**
  gating 15a/15b and half of Notification Center, and team-roles/audit-log **overlap Phase 5 RBAC**
  and should be built there rather than as Settings toggles.
- **`app/dashboard/settings/page.tsx`** — deleted all six `RoadmapCard` usages **and** the
  `RoadmapCard` component itself; rewrote the dangling copy that referenced them ("...grouped in the
  roadmap summary below", the page description, two section descriptions); retoned three leftover
  chips (`Saved reports roadmap` → a real `Supplier & depot reports` capability, `Roadmap item` →
  neutral `Not available yet`, and dropped `Workflow email roadmap`). **Zero** "roadmap" strings
  remain in the file.
- **Sections merged 10 → 6**: Workspace *(+ Branding)* · Profile · Inventory *(+ Operations)* ·
  Billing & Plan · Data & Reports · Security & Email. Implemented by **composing the existing panel
  renderers** in the `renderActivePanel` switch — no panel markup or save logic was rewritten, which
  kept the diff low-risk.
- **`MERGED_SECTION_ALIASES`** maps the four retired ids (`branding`, `reports`, `operations`,
  `email`) to their new parent, so existing deep links/bookmarks land on the panel that now holds
  that content instead of silently falling back to Workspace.

**Caught by tooling:** `tsc` flagged three in-page `switchSection("branding"|"email")` cross-links
that would have become dead buttons after the merge — repointed to `workspace`/`security`. Worth
noting the typed section id is what made that safe.

**Verification:** `npm run lint` ✅ · `npx tsc --noEmit` ✅ · `npm run build` ✅ (35/35) · live on the
logged-in app: nav renders **6** sections; **0** roadmap chips anywhere on the page; Workspace shows
both halves (Workspace profile … Brand identity, Logo, Report branding); `?section=email` resolves to
**Security & Email** with both halves present (Account access … Current email setup); `?section=branding`
resolves to Workspace with Brand identity visible. File 2,085 → 1,986 lines.

**Untouchables:** no auth, Supabase, schema, routing, or save/business logic changed — panel
internals were moved, not rewritten.

---

## Account menu consolidated into the header  *(Complete)*

**Scope:** Founder showed both account UIs and asked which is right. The app had **two**: a real
menu at the sidebar bottom, and a header pill that showed a chevron but was just a
`<Link href="/dashboard/settings">` — a broken affordance (chevron implies a dropdown), and
**sign-out was unreachable from it**.

**Decision (mine):** keep **one** menu, on the **header pill** (top-right). Rationale: it is the
universal convention (users look top-right for account/sign-out); the header is always visible at
full width, whereas the sidebar collapses to an icon rail where the account shrinks to a bare
avatar with no name/plan; and it matches the rule set in the header slim-down — **sidebar owns
navigation, header owns identity + actions**.

**Delivered:**
- **`DashboardShell.tsx`** — removed the entire `dashboard-account-area` block from the sidebar
  (trigger + menu). Converted the header pill from a `<Link>` into a `<button>` with
  `aria-haspopup="menu"` / `aria-expanded`, wrapped in a positioned `.dashboard-top-account`, and
  moved the **existing** menu markup under it unchanged: account summary (name · email · plan chip ·
  usage bar) → Plan & usage · Workspace style · Settings → **Sign out**. The existing
  outside-click/Escape effect and `accountMenuRef`/`accountTriggerRef` were reused as-is, so
  focus-restore-on-Escape still works.
- **`app/globals.css`** — appended `.dashboard-top-account*` block: relative wrapper, chevron rotate
  (with `prefers-reduced-motion` opt-out), and menu positioning under the pill.

**Cascade fight worth recording (second time this pattern has bitten):** the menu first rendered
**off-screen at `top: -327`**, then half-corrected to overflow the right edge. Dumping the matched
rules live showed **five** older rules still anchoring `.dashboard-account-menu` to the sidebar
bottom (`bottom: …; left: …; width: 18rem`), including a `:has(.sydin-overview)` /
`:has(.inventory-workspace)` variant at specificity **0,3,0 with `!important`** — which beat a
plain `.dashboard-top-account .dashboard-account-menu` (0,2,0) even with `!important` on mine.
Fixed by raising the selector to
`.dashboard-shell .dashboard-top-tools .dashboard-top-account .dashboard-account-menu` (**0,4,0**).
Same lesson as the tooltip entry: on this stylesheet, **dump the matched rules in the browser** —
`!important` alone does not guarantee a win when a higher-specificity `!important` exists.

**Verification:** `npm run lint` ✅ · `npx tsc --noEmit` ✅ · `npm run build` ✅ (35/35) · live on the
logged-in app: header pill is a `BUTTON` with `aria-haspopup="menu"`; sidebar account block is
**absent from the DOM**; opening the menu measures **right-aligned to the pill** (`menuRight 868 ===
pillRight 868`), **below it** (`top 66 > pillBottom 58`), **fits horizontally** (304px wide inside a
903px viewport); all four items present (Plan & usage · Workspace style · Settings · Sign out) with
the plan chip and `7 / 1000 items` usage bar; verified on **both** `/dashboard` and
`/dashboard/inventory` (the two `:has()`-scoped variants).

**Untouchables:** no auth/schema/routing/business-logic changes — `handleSignOut`, the upgrade href,
and every menu destination are the pre-existing ones, relocated only.

---

## Inventory density — note #7 "stats too wide, too much space"  *(Complete)*

**Scope:** Founder's most-repeated complaint. Measured first rather than eyeballed: at 1280×800
with stats visible, the first item card started **515px** down — **64% of the viewport was chrome**
(hero 140px · stats 82px · toolbar 156px) leaving ~285px of actual inventory.

**Two distinct problems found:**
1. **Too wide** — `.inventory-stat-grid` was `repeat(3, minmax(0, 1fr))` stretched across the full
   content width, so each card was **377px** wide to hold a label, a number, and a sub-label
   (~160px of real content).
2. **Too much space** — `.inventory-toolbar-actions` (count · Filters · Compact · sort · view ·
   Select) was **wrapping to a second row**: 88px tall next to a 46px search box, silently adding
   ~42px of chrome. This was the larger vertical cost and was *not* visible as an obvious defect.

**Delivered (`app/globals.css`, appended last, scoped CSS only):**
- Stat grid → `repeat(3, minmax(0, 14.5rem))` + `justify-content: start`, so cards read as compact
  chips instead of stretched panels; card `min-height` 4.75→4rem, padding 0.75→0.6/0.7rem, value
  font 1.25→1.15rem.
- Toolbar → `.inventory-toolbar-main` search column capped at `20rem` and the action gap tightened
  to 0.4rem, which lets the whole action cluster sit on **one row**; panel padding 0.75→0.6rem and
  stack gap 0.8→0.55rem.
- Responsive preserved: 2-up (stretched) below 900px, 1-up below 639px, and the toolbar returns to
  a stacked single column below 1100px where one row genuinely cannot fit.

**Result (measured at 1280×800, stats visible, same viewport before/after):** first item card
**515px → 459px**, chrome **64% → 57%**; stat card width **377px → 232px**; toolbar action row
**88px → 42px**.

**Honest limitation:** the width complaint is fully fixed, but the page is still **57% chrome**
before the first item. The remaining cost is the hero card (140px) plus the stats block itself —
reducing those further is a *design* decision (e.g. moving stats inline with the hero, or making
Compact the default), not a padding tweak, so it was deliberately not done unilaterally. The
existing **Compact** toggle already drops chrome to ~295px for users who want it.

**Method note:** an intermediate measurement was invalid because the browser pane width changed
between readings (915px → 861px content), which made the hero reflow taller and looked like a
regression. Re-measured at a pinned 1280×800 and A/B'd by temporarily restoring the old values
inline in the live page — that gave the real 515→459 delta. Also caught that the `Compact` toggle
had been left on in `localStorage` from earlier testing, which briefly hid the stats and made the
numbers look far better than they were.

**Verification:** `npm run lint` ✅ · `npx tsc --noEmit` ✅ · `npm run build` ✅ (35/35) · live at
**1280px** (3-up capped chips, one-row toolbar), **900px** (2-up stretched, no overflow), and
**375px** (1-up, no horizontal overflow, mobile bottom nav still rendering).

**Untouchables:** no markup, component, auth, schema, routing, or logic changes — CSS only.

---

## New Purchase Order — two-column layout (note #3b)  *(Complete)*

**Scope:** Founder's sketch: the New PO form should pair its short sections two-up with Lines full
width, instead of one long vertical scroll ("y3ni simple not long"). Continues the density theme
from note #7.

**Delivered:**
- **`app/dashboard/purchase-orders/new/page.tsx`** — wrapped the six existing `DashboardFormSection`
  blocks in a single `.po-new-grid` container. **No section was moved, renamed, or rewritten** —
  only two lines (an opening `<div>` and its `</div>`) were added.
- **`app/globals.css`** — `.po-new-grid` is a 2-column grid ≥1000px; CSS `order` re-sequences the
  as-authored JSX (Order details · Depot & supplier · Lines · Payment · Invoice · Notes) into the
  sketch's layout — **Order details | Depot & supplier**, **Payment | Notes**, then **Lines** and
  **Invoice** spanning `1 / -1`. Below 1000px it collapses to the original single-column stack.

**Why `order` instead of reordering the JSX:** the Lines section is ~200 lines of interactive markup
(inventory picker dialog, per-line stock toggles, totals). Moving it in source to satisfy a visual
layout would have risked the form's behavior for a purely presentational gain; driving placement
from CSS keeps the diff to two lines and leaves every handler untouched.

**Verification:** `npm run lint` ✅ · `npx tsc --noEmit` ✅ · `npm run build` ✅ (35/35) · live at
**1400px**: measured placement confirms pairs share a row (Order details `left 92` / Depot & supplier
`left 735`, both `top 259`; Payment / Notes both `top 613`) and Lines + Invoice span the full 1273px;
at **375px** the grid is a single 375px column, stacked in order, with no horizontal overflow.

**Stale-cache note:** the first live check showed `display: block` with all six children at `order: 0`
— the wrapper and markup were correct but Turbopack was serving the previous stylesheet. Cleared
`.next` and restarted to confirm. That is now the fourth occurrence this session; the pattern is
recorded in memory.

**Untouchables:** no form state, validation, line handlers, save/receive logic, auth, schema, or
routing changed.

---

## Header search — anchored dropdown (note #3)  *(Complete)*

**Scope:** Clicking the header search bar opened a full-screen blurred modal. Founder wanted:
click → cursor in the bar → type → results as a dropdown → click → go.

**Decision:** split the two entry points rather than converting search wholesale —
- **Header bar click → anchored dropdown** under the bar, page visible behind it.
- **Ctrl/Cmd+K → centered modal palette**, unchanged. It can be pressed on screens where the bar
  isn't rendered (tablet/mobile headers use icon buttons), so it still needs to be self-contained.

This is the GitHub/Linear pattern. Deliberately did **not** build the separate search *page* the
note also floated — `/dashboard/search` and the palette already cover that.

**Delivered:**
- **`GlobalSearchDialog.tsx`** — new optional `anchored` prop. The panel JSX was extracted to a
  `panel` const and is returned bare when anchored, or wrapped in the existing
  `fixed inset-0 … backdrop-blur-md` scrim otherwise. `aria-modal` is dropped in anchored mode
  (it isn't modal). **All search logic — the `useGlobalSearch` hook, grouping, keyboard nav,
  recents, "View all results" — is untouched and shared by both modes.**
- **`DashboardShell.tsx`** — `searchAnchored` state; the desktop bar opens anchored (and toggles
  closed on a second click, with `aria-haspopup`/`aria-expanded`), while Ctrl/Cmd+K and the
  tablet/mobile icon buttons force modal. The bar and the dropdown share a `.dashboard-top-search`
  wrapper, with an outside-`mousedown` effect that closes it (there's no scrim to catch clicks);
  because the trigger is inside the wrapper, clicking the bar toggles rather than double-firing.
- **`app/globals.css`** — `.dashboard-top-search` relative wrapper and
  `.global-search-panel-anchored` positioning (below the bar, widened to 38rem ≥1100px so results
  stay readable), reusing the existing `glass-pop-in` animation with a reduced-motion opt-out.

**Verification:** `npm run lint` ✅ · `npx tsc --noEmit` ✅ · `npm run build` ✅ (35/35) · live at
1400px: clicking the bar gives `anchoredClass true`, **no full-screen scrim**, `aria-modal` absent,
panel top 63 vs bar bottom 56 (drops below), left-aligned to the bar, 608px wide, fits on screen,
and **the input is already focused** — i.e. exactly "click → cursor appears → type". Typing `test2`
returned the matching item; Escape and outside-click both close it (`aria-expanded` returns to
`false`); Ctrl/Cmd+K still renders the modal with its scrim.

**False alarm worth recording:** searching `flower` returned "No results", which looked like a
search bug — but the modal path returned the same, and the data has no item or category by that
name (the category is literally `flwow`, and "Flower Plus" is artwork inside an item photo, not a
field). Searching a real name (`test2`) works. **No bug; nothing was "fixed".**

**Untouchables:** no search query/ranking logic, auth, schema, or routing changed.

---

## Header search dropdown — correction pass  *(Complete)*

**Scope:** Founder's verdict on the first anchored-dropdown attempt: *"still look ugly and
unprofessional."* He was right, and the screenshot showed why.

**What was wrong (my mistake):** the previous pass anchored the **modal** under the bar without
removing the modal's own chrome, so the open state showed **two stacked search fields** — the
header bar *and* the panel's input directly beneath it — plus the modal's close **✕** and its
keyboard-legend footer. It read as a modal squeezed into the wrong place rather than a search bar
that expands.

**Fix (presentation only — no logic touched):**
- The panel now opens **over** the bar (`top: 0` instead of `top: calc(100% + …)`), and
  `.dashboard-top-search-open > .dashboard-top-searchbar` is `visibility: hidden` — so the panel's
  input lands exactly where the bar was. **One search field, not two**; the bar visually *becomes*
  the dropdown.
- Panel header padding/font tuned to match the bar's rhythm so the swap is seamless.
- Hid the **✕** and the **footer legend** in anchored mode — both are modal affordances; the
  dropdown closes on Esc, outside-click, or clicking the bar again.
- Hid the *"Type at least 2 characters…"* hint in anchored mode (the placeholder already says it);
  added a `.global-search-hint` hook to target it.

**Verification:** `npm run lint` ✅ · `npx tsc --noEmit` ✅ · `npm run build` ✅ (35/35) · live at
1400px: one input, no ✕, no footer; typing `test` returns grouped results — **ITEMS** (test1, test2
with SKU/category/depot and IN STOCK badges) and **OPERATIONS** (a matching pick list, with the
matched substring highlighted) — plus the "View all results" link. Modal palette via Ctrl/Cmd+K
unchanged.

**Process note:** this is the second time this session that a change looked right in the DOM
measurements but wrong to the eye. Measuring position/visibility proves *placement*, not *whether
the composition reads well* — screenshots (or the founder's eye) remain the check for that.

---

## Search panel — collapsed tab row + hint that never got hidden  *(Complete)*

**Scope:** Founder pointed at a zoomed screenshot: *"why u cant see the bugs here."* He was right on
both counts, and both were things my previous verification had missed.

**Bug 1 — the tab row was being crushed (real layout bug, and it predates the dropdown).**
`.global-search-panel` is a flex **column** with a `max-height`, and the results list is the intended
scroll region (`min-h-0 flex-1 overflow-y-auto`). But `.global-search-header`, `.global-search-tabs`
and `.global-search-footer` kept the default `flex-shrink: 1`, so once results exceeded the
max-height the browser **squashed those fixed rows instead of scrolling the list**. Measured: the
tab row rendered **14.5px tall while its text needed 24px** (`scrollHeight 24` vs `clientHeight 13`),
pushing the "All" label out of its rounded pill — exactly the broken-looking chip in the screenshot.
Fixed with `flex: 0 0 auto` on all three. **This also affected the Ctrl/Cmd+K modal** — the bug was
just less visible at its larger max-height. Same root cause as the earlier `.ui-dialog` fix in this
log; the search panel simply never got the same treatment.
Verified: tab row **14.5px → 30.8px**, `scrollHeight === clientHeight` (no overflow).

**Bug 2 — the "Type at least 2 characters…" hint was still rendering.** The previous commit added a
`.global-search-hint` class and a rule to hide it in anchored mode, but a live rule-dump showed
**the rule was not in the served CSS at all** — a stale Turbopack stylesheet, the fifth occurrence
this session. The earlier "verified" screenshot had been taken *after typing*, where the hint is
hidden by its own `!isSearching` condition anyway, so the check never actually exercised it.
Confirmed fixed after a clean restart: `hintDisplay: "none"`.

**Verification:** `npm run lint` ✅ · `npx tsc --noEmit` ✅ · `npm run build` ✅ (35/35) · live at
1400px with a clean `.next`: tabs render at full height with the pill correctly wrapping its label,
no hint row, one input, no ✕, no footer.

**Process correction (the real lesson):** I had been verifying the *specific properties I changed*
(position, visibility) and reading screenshots too quickly, which is why a crushed tab row and an
un-applied rule both slipped through. Measuring the thing you edited does not catch what your edit
sits next to. For visual work: dump the served rule to confirm it actually shipped, and check
element `scrollHeight` vs `clientHeight` on fixed rows inside a constrained flex column.

---

## Visual Polish Pass — Compact Headers & Refined Cards  *(Complete)*

**Scope:** Founder observation: page headers taking too much space, cards looking less refined than needed. Built a cohesive visual refinement pass across dashboard components.

**Delivered (`app/globals.css` only):**
- **Dashboard page headers** — reduced padding from `var(--space-4)` to `var(--space-3)`, changed flex direction to `row` (title and actions now horizontal on desktop), reduced font sizes and margins across eyebrow/heading/description. Result: **compact, professional top bar** matching Linear/Stripe aesthetic.
- **Page section gaps** — reduced shell gap from `var(--space-4)` to `var(--space-3)` for tighter overall layout.
- **Card refinements** — standardized border-radius from mixed 16px/18px to **14px** across all cards (page headers, content cards, table cards, metric cards, empty states, form sections). Updated box-shadows from `0 10px 30px / 0 12px 36px` to **`0 4px 12px` with reduced opacity** for a subtler, lighter aesthetic.
- **Filter chips** — tightened min-height from 2.3rem to 2.15rem and padding to match refined density.
- **Responsive preservation** — mobile rules updated to maintain compact look below 640px; header stacks vertically, actions go full-width, 12px radius on mobile cards.

**Visual system standardized:**
- **14px** = cards (headers, content, tables, metrics, empty states, forms)
- **12px** = buttons
- **999px** = pills/badges

**Verification:** `npm run lint` ✅ · `npx tsc --noEmit` ✅ · `npm run build` ✅ (35/35 routes).

**Results (measured in preview):**
- Header now one-line horizontal layout: "INVENTORY OVERVIEW" + "North Studio" + "Add Item" button inline.
- Cards have refined, cohesive appearance with lighter shadows and consistent radius.
- Overall layout feels tighter, more professional, and more polished without sacrificing readability.

**Untouchables:** no component markup, auth, schema, routing, business logic, or behavior changed.

---

## Overnight batch — #14 / #6 / #5 made real, migrations applied  *(Complete)*

**Scope:** Founder went to sleep with "start the both three… you have access to supabase and vercel".
The first pass of all three had been committed but **none of them actually worked end to end** — this
entry covers finding that out and fixing it.

### What was broken after the first commits

1. **#6 Import & Export** — page existed, but the `import_export_history` table did **not**, the page
   was **not in `navigation.ts`** (unreachable except by typing the URL), and **nothing ever wrote a
   row**, so the history could only ever be empty.
2. **#5 Device pairing** — `devicePairing.ts` + `useDevicePairing` existed but **nothing imported
   them**. Dead code, not a feature. The hook also had a stale-closure bug (inline `onBarcodeReceived`
   in the dep array restarted the poll interval every render) and an unused `RealtimeChannel` ref.
3. **#14 Add Item** — **shipped genuinely broken.** Quantity was a required field that now lived
   inside the collapsed "Add Optional Details" section, so a name-only save failed with *"Review the
   highlighted fields before saving"* pointing at a field the user **could not see**. Verified live:
   the item was never created. The `lint ✓` claim in that commit was also false — `npm run build` was
   grepped for `Compiled` only, which hid a `react/no-unescaped-entities` error from the new copy.

### Delivered

- **Migrations applied to production Supabase** (`hllktjhewivxqumqktzj`): `phase_11_import_export_history`,
  `phase_12_device_pairing`. Additive only — new tables + RLS, no ALTER/DROP on existing tables.
  **Caught while applying:** `phase-12`'s SQL file had SELECT and INSERT policies on `pairing_barcodes`
  but **no UPDATE policy**, so `markBarcodesProcessed()` would have been silently dropped by RLS and the
  laptop would have replayed the same barcode forever. Added to the live DB and to the file.
- **#6 wired for real:** `Import & Export` added to `navigation.ts` (System section); `logImportExport`
  called from the inventory CSV export and from the import page on **both** success **and** failure —
  a history that hides failed runs hides exactly the runs worth investigating.
- **#5 given a UI:** new `PhonePairingPanel` on the laptop scanner page (QR + 6-digit code + live
  status + received counter) and a new `/dashboard/scanner/phone` page for the phone. The QR encodes a
  normal URL, not a custom scheme, so any stock camera app opens it. Received codes are dispatched
  through the scanner's existing `handleDecode`, so every mode behaves identically to a local scan.
  Hook rewritten: callback in a ref, `inFlight` guard against overlapping polls, and rows marked
  processed **before** dispatch (a lookup hit navigates and unmounts the hook mid-flight).
- **#14 fixed:** blank quantity now means **0** instead of invalid, the `*` removed from its label, and
  any validation error outside `name` force-opens the collapsed section as a safety net.

### Verification (live, not just compiled)

`npm run lint` ✅ · `npx tsc --noEmit` ✅ · `npm run build` ✅ **37/37** (was 35 — both new routes registered).

- **#6:** real CSV export through the UI → row in DB (`sayed-inventory-2026-07-27.csv`, 7 items,
  `success`) → visible on the history page.
- **#5:** flipped the pairing to `paired` in SQL → laptop badge changed itself to **PHONE CONNECTED**;
  inserted a barcode row → scanner rendered *"Nothing matched TEST-BARCODE-9911"*, i.e. a code from
  another device ran through `handleDecode`. Row left `processed: true`, so no replay.
- **#14:** name-only save → redirect to Inventory, item created with `quantity 0` (the pre-fix attempt
  created nothing).
- All test data removed afterwards: inventory back to **19 items**, pairing/barcode test rows deleted.

**Process note (third time this session):** compiling is not working. Each of these three passed
`build` while being non-functional — unreachable, unimported, or failing at the first real interaction.
Ship-checks for a feature must include *using* it, and for anything DB-backed, confirming the row.

**Known housekeeping:** expired `device_pairings` rows are never purged. Harmless (10-minute expiry is
enforced in the query) but the table grows; worth a cleanup job or a `delete from device_pairings where
expires_at < now() - interval '1 day'` cron later.

---

<!-- Append the next sprint entry below this line. -->
