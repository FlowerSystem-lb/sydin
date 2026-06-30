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

<!-- Append the next sprint entry below this line. -->
