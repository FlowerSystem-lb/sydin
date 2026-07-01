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

<!-- Append the next sprint entry below this line. -->
