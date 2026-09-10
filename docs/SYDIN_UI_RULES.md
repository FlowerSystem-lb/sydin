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

- Button hover **lift** (+ soft brand-color glow on primary/gradient buttons)
- Button active **scale** (press) — implemented on `ActionButton` (`.dashboard-action-button:active`, `translateY(0) scale(0.985)`, 140ms ease)
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

### Record forms use `FieldGroup` / `FieldRow`, not `DashboardFormSection`

Anything that asks the user to fill in a record — Add/Edit Item, Customers, Suppliers,
Depots, New Invoice, New Purchase Order — is built from `FieldGroup` and `FieldRow`
(`components/ui/FieldRow.tsx`): a small caps group heading, then label-left /
value-right rows with a hairline between them and **no box around each field**. Put the
groups inside `<section className="dashboard-card item-form p-0">` → `.item-form-groups`,
which is a container query, so the same form lays itself out in one column in a 30rem
slide-over and two columns on a full page. Bare `<input>`/`<textarea>` children need no
`className`; `Select` takes `ariaLabel` (the row already renders the visible label).

`DashboardFormSection` remains right for sections that are **not** label/value forms —
a list editor, a dropzone. As of 10 Sep 2026 it has two callers left, both on the New PO
page (its Lines and Invoice-or-proof sections).

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
