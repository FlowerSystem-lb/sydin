# SydIN — UI Rules

Non-negotiable rules for building SydIN screens. The goal is a premium, compact, fast,
Linear/Stripe-grade inventory operating system — never a legacy ERP.

> This is the **UI layer**. Product judgment (what to build, in what order, push-back rules,
> and the Feature Review Template) lives in
> [SYDIN_PRODUCT_PRINCIPLES.md](SYDIN_PRODUCT_PRINCIPLES.md); mobile-specific UX in
> [SYDIN_MOBILE_ROADMAP.md](SYDIN_MOBILE_ROADMAP.md). A feature isn't "done" until its UI meets
> the rules below **and** its empty/loading/error states exist.

---

## Page anatomy

Every dashboard page should follow this structure (using the shared primitives):

1. **Page shell** — `DashboardPageShell`
2. **Header** — `DashboardPageHeader` with:
   - Title
   - Subtitle
   - Primary action(s) — `ActionButton`
3. **Toolbar / search / filter** — `DashboardToolbar`, `FilterBar`, `FilterChip`
4. **Content** — card / table / grid (`DashboardCard`, `DashboardTable`, `DashboardListRow`)
5. **Loading state** — `LoadingSkeletonGroup` (skeletons, not spinners, where practical)
6. **Empty state** — `DashboardEmptyState`
7. **Error state** — `DashboardNotice`

A page is not "done" until all of loading, empty, and error states are handled.

---

## Visual style

- White cards
- Soft borders
- Subtle shadows
- Compact spacing
- Rounded corners
- Smooth hover motion
- Subtle press state
- Premium SaaS feel

---

## Motion

- Button hover **lift**
- Button active **scale** (press)
- Card hover **lift**
- Row hover **highlight**
- Dropdown **fade / scale**
- Modal **fade / scale**
- **Skeleton loading** instead of spinners where practical

Keep motion subtle and fast — polish, not spectacle.

---

## Components to prefer

All exported from `components/dashboard/Workspace.tsx`:

`DashboardPageShell` · `DashboardPageHeader` · `DashboardCard` · `DashboardToolbar` ·
`FilterBar` · `FilterChip` · `DashboardNotice` · `ActionButton` · `MetricCard` ·
`DashboardTable` · `DashboardListRow` · `DashboardFormSection` · `LoadingSkeletonGroup` ·
`DashboardEmptyState`.

Generic UI kit lives in `components/ui/` (`Button`, `Card`, `Badge`, `Field`, `Select`,
`Overlay`, `Tooltip`, `State`, `IconButton`).

**Only create a new component when repeated UI clearly deserves abstraction.**

---

## Engineering guardrails for UI work

- Never modify authentication, Supabase integration, database schema, routing, business
  logic, or existing working behavior unless explicitly requested.
- Preserve existing functionality.
- Keep structure translation-ready (no hard-coded concatenated strings that block i18n).
- Be accessible and responsive (mobile + desktop).
- Keep new global CSS **scoped** (e.g. `.inventory-workspace`) and grouped into a clear
  section; avoid bloating `app/globals.css` with duplicates.
- Verify before sign-off: `npm run lint`, `npx tsc --noEmit`, `npm run build`.
