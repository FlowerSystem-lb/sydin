# SydIN — Decision Log

Append-only record of meaningful product/technical/strategy decisions, so future sessions
don't re-litigate settled choices. Newest at the **bottom**. One entry per decision:
**date · decision · why · status**. Convert relative dates to absolute. Use the Feature
Review Template (in [SYDIN_PRODUCT_PRINCIPLES.md](SYDIN_PRODUCT_PRINCIPLES.md)) for feature
decisions.

> Status values: **Active** (in force) · **Superseded** (replaced — link the newer entry) ·
> **Revisit** (provisional, reopen later).

---

### 2026-06 · Repo is the source of truth — project brain in `docs/`
**Decision:** Maintain SydIN's vision, roadmap, architecture, and operating rules as committed
docs in `docs/`, linked from `CLAUDE.md`. **Why:** every Claude Code / Claude Project session
starts cold; the repo must carry the context. **Status:** Active.

### 2026-06 · Shared dashboard primitives live in one file
**Decision:** All dashboard UI primitives are exported from
`components/dashboard/Workspace.tsx`; screens reuse them rather than rebuilding.
**Why:** consistency and "one way to do a thing." **Status:** Active.

### 2026-06 · UI direction — light "liquid glass" redesign
**Decision:** Active UI work happens on branch `uiux-light-liquid-glass-redesign`; premium,
light, compact aesthetic. **Why:** the Sortly/Linear/Stripe-inspired identity.
**Status:** Active.

### 2026-06 · Sprint 3 — item browsing is the primary inventory view
**Decision:** Inventory page leads with item browsing, only 3 summary metrics (Items / Stock
units / Needs attention), low-stock insights in a secondary rail, Import/Export in a More
dropdown. **Why:** reduce clutter, make the core job primary. **Status:** Active (approved).

### 2026-06 · Sprint 3B — conservative inventory CSS stabilization
**Decision:** Stabilize inventory CSS by annotating in place + removing only provably-dead
rules; **no** rule reordering or relocation. **Why:** the 22 inventory CSS clusters' source
order is load-bearing (theme layers override by order), so moving them risks visual
regression. **Status:** Active. Future deeper refactor (extract to `@layer` module) deferred
to its own sprint.

### 2026-06 · Foundation before Scanner/QR
**Decision:** Do not build Scanner or QR & Labels until Inventory, Categories, Item Details,
and Add/Edit Item UX are stable (Sprints 4–7 first). **Why:** they depend on a solid item
model and would otherwise be built on shifting ground. **Status:** Active.

### 2026-06 · Manual plan approval is a first-class billing path
**Decision:** Keep/grow the existing manual plan-request + admin-activation flow
(`app/request-plan`, `app/admin/plan-requests`, `app/api/admin/activate-plan`) as a supported
way to onboard paid users, alongside any future automated gateway. **Why:** card/gateway
availability is limited in SydIN's target markets (Lebanon/Syria-style); manual approval
unblocks early revenue. **Status:** Active. See [SYDIN_PAYMENTS_STRATEGY.md](SYDIN_PAYMENTS_STRATEGY.md).

### 2026-06 · Payment gateway choice deferred (research-first)
**Decision:** Do not commit to a single automated payment provider yet; research current
eligibility/fees for Paddle / Lemon Squeezy / Stripe (and region constraints) before deciding.
Crypto is optional and **not** a launch priority. **Why:** avoid lock-in and wasted cost; the
founder's account/region eligibility must be checked against current provider rules.
**Status:** Revisit (before billing sprint).

### 2026-07 · Correction: QR Center was already fully built, not a design-foundation greenfield build
Sprint 8 investigation (2026-07) found `app/dashboard/qr-center/page.tsx` and
`app/lib/qrLabelPdf.ts` fully implemented and shipped prior to this sprint. Backlog entries
describing QR & Labels as needing "workspace design foundation" are stale. Redefined Sprint 8
as a brand-alignment polish pass instead. **Status:** Active.

### 2026-07-04 · Button press state built + brand-glow hover added to gradient buttons
**Decision:** `SYDIN_UI_RULES.md`'s "Button active scale (press)" line previously described
intent that was never implemented for `ActionButton` — corrected the doc and added a real
`.dashboard-action-button:active` rule (`translateY(0) scale(0.985)`, 140ms ease, matching the
existing `.action-button`/`.ui-button` press pattern). Also layered a soft brand-color glow
(`0 0 36px rgba(125, 92, 255, 0.18)`) onto the existing hover shadow of all three gradient
save/primary buttons (`dashboard-action-button-primary`, `.item-details-submit`,
EditItemForm's save button) without merging their separate implementations. **Why:** docs
should describe what's actually built, and the three gradient buttons should read as visually
related even though consolidating them into one shared class is a separate future refactor.
**Status:** Active.

### 2026-07-19 · Scanner Transfer mode = whole-item relocation, not partial-quantity transfer
**Decision:** Scanner "Transfer" moves an **entire item** to a different depot and writes an audit
row. It does **not** split quantities across depots. **Why:** `depot_id` is a column on the
inventory **item row** — there is no per-depot stock table — so "move 3 of 10 laptops from A to B"
is literally unrepresentable today. Supporting it would require an `inventory_depot_stock`
(item_id, depot_id, quantity) table plus rewriting every quantity read/write across Inventory,
Dashboard, Reports, Receiving, Stock Counts, Pick Lists and Purchase Orders — a larger project than
the entire Scanner Workspace, with real risk to working stock logic. Transfer UI copy must say
"Move item to depot" and never imply partial quantities. Secondary benefit: depot changes get an
audit trail for the first time (today they leave no trace). **Status:** Active. Revisit only if
genuine multi-depot stock splitting becomes a real requirement.

### 2026-07-19 · Asset tracking is per-unit, opt-in, with derived quantity
**Decision:** Per-unit asset tracking uses two new tables — `inventory_assets` (one row per
physical unit: status, condition, assignee, serial, own `public_id`) and append-only `asset_events`
— mirroring the existing `inventory` + `stock_movements` state/log split. Enabled **per item** via
`inventory.is_asset_tracked` (default false). When on, `inventory.quantity` is **derived by
trigger** from the unit count and `record_stock_movement` raises for that item. **Why:** SydIN
inventory is quantity-based ("Laptops, qty 10") while asset tracking is per-unit ("*this* laptop →
Jane"); putting `assigned_to`/`status` directly on `inventory` is semantically broken for
quantity > 1. Opt-in keeps existing consumable stock completely unaffected, and a single writer for
quantity prevents two conflicting sources of truth. All status transitions go through one
`record_asset_event` RPC gated by a `set_config` sentinel so status can't be set by a plain client
UPDATE (same pattern as `complete_pick_list`). **Status:** Active. **Risk to watch:** the derived-
quantity trigger — if wrong, quantities drift silently; test on one item before rolling out.

### 2026-07-19 · No people/employees table yet — free-text assignee
**Decision:** Asset assignment stores a free-text `assigned_to_name` with a `<datalist>` of
distinct existing names for autocomplete, rather than a normalized people/employees table.
**Why:** it answers "what does Jane have" via a filter and avoids building a whole
people-management sub-module before there's demand for per-person pages, contact details, or
offboarding. Accepted cost: typo variants ("J. Smith" / "john smith") will accumulate; trimming
plus autocomplete mitigates. Promote to a real table when per-person features are actually asked
for — the migration is a straightforward backfill from distinct names. **Status:** Revisit.

### 2026-07-23 · Confirmed: phase-9 (PO payment timeline) migration is live in production
**Decision/fact:** `sql/phase-9-purchase-order-payments.sql` was run — `purchase_order_payments`
exists in the production Supabase project (`hllktjhewivxqumqktzj`) with 8 rows. Sprint B2's log
entry said "code complete; awaiting phase-9 SQL run" with no follow-up confirming it — this entry
closes that loop. **Status:** Active (Sprint B2 fully live, not just code-complete).

<!-- Append the next decision below this line. -->
