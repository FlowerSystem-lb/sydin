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

<!-- Append the next sprint entry below this line. -->
