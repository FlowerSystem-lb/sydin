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

### 2026-07-24 · M3 open question resolved — `MobileInventoryCard` deleted, not adopted
**Decision:** Removed `components/mobile/MobileInventoryCard.tsx` (+ its sole CSS block
`.mobile-inventory-card*` in `app/mobile.css`) rather than wiring it into the Inventory page.
**Why:** it had zero references repo-wide, and the Chrome-Audit entry already established that the
live mobile inventory page renders correctly via its own Sprint-7 CSS treatment — adopting the
component would *replace working layout with a duplicate* for no user-visible gain. This closes the
"delete or adopt" question the Chrome-Audit sprint left open. Recoverable from git history if a
deliberate adoption is ever wanted. **Status:** Active.

### 2026-07-24 · Mobile shell CSS duplication consolidation stays a dedicated sprint (not a drive-by)
**Decision:** The mobile-shell nav rules duplicated (with conflicting values) across
`app/globals.css:17213-17316` and `app/mobile.css` will **not** be consolidated as part of a polish
pass. **Why:** it is the same "fold `mobile.css` into `globals.css`" refactor already deferred (M2
deferred #4, Chrome-Audit deferred #3); resolving it correctly requires a **live computed-value /
device check** (the project's own METHOD rule: don't trust source-order reasoning here), and the
mobile nav has already gone fully invisible once from this exact class of CSS fragility. Do it in its
own sprint with a real browser/device visual pass, not blind. **Status:** Revisit (dedicated sprint).

### 2026-07-24 · Engineering gotcha — unlayered `.inventory-*` (globals.css) silently override Tailwind color utilities
**Fact/decision:** `app/globals.css` authors its custom rules **unlayered**, while Tailwind v4
compiles utilities into `@layer utilities`. Per CSS cascade-layer rules, **unlayered always beats
layered**, regardless of specificity or source order. Verified against compiled CSS
(`.inventory-card-tag` → not in a layer; `.bg-red-50` → in a layer). **Consequence:** putting Tailwind
color/background/border utilities (`bg-*`, `text-*`, `border-*`) on an element that also carries an
unlayered class like `.inventory-card-tag` that sets those same properties means the **Tailwind
classes are silently dead** — this is what killed the inventory card's status-badge color-coding
(see Sprint Log 2026-07-24). **How to apply:** when an element needs both a hand-written globals class
and tone/color variation, drive the color from a **higher-specificity unlayered selector**
(e.g. `.base.base--tone`) or a hook class defined in globals.css — do **not** rely on a Tailwind color
utility to override an unlayered base. **Status:** Active (reference).

<!-- Append the next decision below this line. -->

### 2026-07-27 · One Add Item implementation — the page; the Inventory quick-add modal is deleted
**Decision:** "Create an inventory item" now exists **once**, at `/dashboard/add-item`. The ~528-line
quick-add modal inside `app/dashboard/inventory/page.tsx` (plus `handleAddItem`, its 20 pieces of form
state, and four image helpers — **846 lines total**) is removed; both Inventory entry points (header
button and empty state) navigate to the page. **Why:** the page had **7 entry points** (Overview ×3,
Categories with `?category=` deep-link, global search, onboarding, top-bar "+ Add") against the modal's
**2**, and it is the only one that supports deep-linking. Decisively, the two had **already drifted** —
the progressive quick-add built for note #14 landed on the page and never reached the modal, so the
same task behaved differently depending on where you started it. Two implementations of one form means
every future field must be added twice. **Rejected alternatives:** (a) delete the page and make
everything modal — breaks `?category=` deep-links, requires rewiring 7 call sites, and the modal lacks
the #14 form; (b) extract a shared `<AddItemForm />` used by both a route and a modal — architecturally
the best answer and the right eventual target, but it means refactoring a 1,345-line form plus a
528-line modal in one pass on a live app, which conflicts with the standing "few cohesive batches, not a
big-bang rewrite" rule. **If the modal presentation is wanted again, do (b) — do not reintroduce a
second copy of the form.** **Status:** Active.

### 2026-08-06 · Inventory responsive thresholds are `@container`, never viewport `@media`
**Decision:** Anything that decides how the inventory workspace **lays itself out** must be keyed to
`@container`, because `.inventory-workspace` is an `inline-size` container. Viewport `@media` stays only
for things that genuinely track the screen (mobile shell, safe-area insets, hover capability).
**Why (measured):** the container is ~127px narrower than the viewport — **1153px at a 1280px viewport,
943px at 1070px**. A rule written as `@media (max-width: 1100px)` therefore fires while the row it
governs still has 943px to work with. That mismatch is exactly what produced the founder's five-row
toolbar: the viewport rule stacked the row early *and* a `@container (max-width: 1040px)` rule split the
controls into a 2-column grid, so both fired at once at ~1070px. **How to apply:** when a toolbar, grid,
or action cluster inside the inventory workspace needs a breakpoint, derive the number from a measured
container width (`.inventory-workspace` bounding box), not from a screen size, and write it as
`@container`. Note the corollary: the shell wrappers (`.dashboard-shell`, `.dashboard-workspace-shell`)
**are** present at mobile widths too, inside `.mobile-shell` — so `:has()`-scoped rules apply at every
width and a plainer `.inventory-workspace` selector will lose to them on specificity.
**Status:** Active (reference). See Sprint Log "Inventory toolbar — three-tier layout".

### 2026-08-10 · Detail-panel grouping stays local (`DetailField`); don't reach for `DashboardFormSection`
**Decision:** When a screen needs a titled/grouped section **inside a component that already uses
flat solid surfaces** (no frosted-glass), extend the local field-grid pattern (`DetailField` /
`DetailGroup` in `ItemDetailsSlideOver.tsx`) rather than importing `DashboardFormSection` from
`components/dashboard/Workspace.tsx`. **Why:** `DashboardFormSection` (and every
`.dashboard-form-section` selector) picks up a dashboard-wide frosted-glass `!important` treatment
(`app/globals.css` ~16711: `backdrop-filter: blur(16px) saturate(1.45)`) intended for full page-level
cards. Surfaces like the item slide-over were deliberately kept flat/solid in Sprint 5
(`.item-details-panel` has no backdrop-filter anywhere), so dropping in the shared primitive as-is
would inject a mismatched frosted card into an otherwise flat panel. This is a **narrow exception**
to "prefer the shared primitives" (`SYDIN_UI_RULES.md`) — it applies specifically when a primitive's
*styling*, not its shape, conflicts with the target surface's established visual language. When
that's not the case, still prefer `DashboardFormSection`. **Status:** Active.

### 2026-08-10 · `getActivityFeed` is user-scoped only; do not filter its output by item client-side
**Decision:** `app/lib/activityFeed.ts`'s `getActivityFeed(userId, limit)` has no `itemId`
parameter and its `po_received` events carry no `itemId` (a PO can cover many items with no
per-item attribution available without a join to order lines that doesn't exist yet). **Do not**
call it and filter the result by `itemId` to get "an item's activity" — its `limit` caps the
*global* feed before your filter ever runs, so an item's own older events silently disappear once
other items' activity fills that window first. Correct today at low activity volume, a latent bug
once usage grows. If a future surface needs a genuinely per-item feed that includes PO events, add
a real `itemId` filter to the function itself (joining through order lines for POs), don't
filter its output. The item slide-over's Activity tab (backlog §16D) instead merges its own
already-item-scoped queries (`getStockMovementsForItem` + `inventory_history` filtered by
`item_id`) and reuses only `activityFeed.ts`'s pure presentation helpers
(`getActivityEventIcon/Label/Tone`). **Status:** Active.

### 2026-08-06 · Inventory's ⋯ menu owns import/export; the Import & Export page owns history
**Decision:** The Inventory three-dot menu keeps the **real actions** — Import inventory (straight to
`/dashboard/inventory/import`) and the three in-page exports — and gains one link to
`/dashboard/import-export` for **history**. The menu does **not** route through the Import & Export page.
**Why:** that page is a history log; its own Export button is permanently disabled with the caption
"Export from inventory page", and its Import button only forwards to the wizard. Routing through it
would add a hop to the import and export nothing. Conversely its history table had no entry point from
Inventory, which is the gap worth closing. **Open for Sayed:** CSV and Excel export **all** items while
PDF exports the **filtered** view. Recommendation is to make all three follow the current view (what you
are looking at is what you export), but that changes working export behaviour, so it needs his word.
**Status:** Active.

### 2026-08-04 · Dashboard "conclusions" pass deferred to last — the data cannot support it yet
**Decision:** The Dashboard rework (founder note 3, backlog §16) moves to the **end** of the queue.
Predictive stats — "what will run out", "cash tied up in dead stock", "what hasn't moved" — are
**not computable on the current data** and would have to be fabricated. **Why (measured, not
assumed):** the production database holds **12 stock movements total**, of which only **2 are
`stock_out`, across 2 items**, spanning Jun 11 – Jul 27; and only **2 of 19 items carry a
`cost_price`**. A consumption rate cannot be derived from two outflow events, and a "dead stock
value" cannot be derived from 2 priced items. "Hasn't moved in 90 days" computes but returns 17 of
19 items, which is noise. **Consequence already live:** the Dashboard's **"Inventory Value"** card
is computed from those 2 priced items and presented as the workspace total — it currently
understates by ~90% and is misleading. Worth fixing or captioning regardless of when the rework
happens. **→ The captioning half is DONE (2026-08-12):** the card now reads
`"USD · priced items only (2 of 10)"` whenever any item is unpriced, so the number no longer
presents itself as a workspace total (see Sprint Log, "Inventory Value presented a partial sum").
Re-measuring at that point showed the "~90%" estimate here was far too kind — the $480 came from 2
items holding **8 of 35,185 units**. **What the Dashboard should do in the meantime:** drive **data
completeness** (items missing a cost price, items with no movement history), which is true today and
is precisely what unlocks the predictive metrics later. **→ DONE (2026-08-12):** "Get your data
ready" panel on the Dashboard — no-price/no-photo/no-activity/no-depot counts, each linking to the
matching Inventory filter (see Sprint Log, "Item 3: Dashboard 'Get your data ready'"). **The
predictive half remains deferred** — 12 lifetime stock movements is still nowhere near enough for
forecasting or dead-stock valuation. **Revisit that half** after ~2–3 months of real operating use,
when there is genuine movement history — check the actual count before starting, don't assume time
alone is sufficient. **Status:** Active (predictive half only).

### 2026-08-11 · A scanned code matching an existing item never creates a duplicate — it points at it
**Decision:** Anywhere a scan can lead to creating a new item, resolving the code against existing
inventory first is mandatory, and a match **blocks** creation rather than silently prefilling a
duplicate. **Why:** the founder specified this himself when approving barcode-scan-to-add ("a
barcode identifies a product type, not a physical unit, so 'same barcode = same item' is right for
inventory") — this is implementing his own stated rule, not a judgment call. **How it's
implemented:** `app/dashboard/add-item/page.tsx`'s scan handler queries a lean candidate list and
runs it through the existing `resolveScannedCode()` (`app/lib/scannerResolve.ts`, unmodified) before
ever touching the Barcode field's value — `kind: "item"` shows a link to the existing item instead
of filling the field. **Scope note:** this check currently runs only on the **scan** path; manually
*typing* a barcode that happens to match an existing item is still unchecked (pre-existing gap, not
introduced here). Extending the same `resolveScannedCode` check to manual entry (e.g. on blur) would
directly serve this same decision and is a reasonable small follow-up — do it as its own explicit
step, not folded silently into an unrelated change. **Status:** Active.

### 2026-08-11 · Scanner Workspace stays off-limits; new scan entry points build on the layer below it
**Decision:** "Leave the Scanner page alone" means the `/dashboard/scanner` route/page and its 8
modes specifically — it does **not** mean scanning capability can't be added anywhere else. New
scan-driven features should build on `components/scanner/BarcodeScannerView.tsx` (camera/decode) and
`components/scanner/ScannerModal.tsx` (the generic modal wrapper already decoupled from the Scanner
Workspace, already used by Inventory's own Scan button) plus `app/lib/scannerResolve.ts`'s
`resolveScannedCode()` — all three already existed and were already used somewhere other than
`/dashboard/scanner` before this decision, confirmed by reading the code rather than assumed. The
barcode-scan-to-add-item feature (backlog item 1) added a new call site on the Add Item page to
these existing pieces; it added zero lines to `/dashboard/scanner/page.tsx`. **How to apply:**
before concluding a scan-related request requires touching the Scanner Workspace, check whether the
underlying camera/decode/resolve pieces are already reusable independently — they usually are.
**Status:** Active.

### 2026-08-12 · `as UiIconName` casts are a lint/tsc blind spot — verify icon names live
**Decision:** Any place that does `someString as UiIconName` (rather than passing a value TypeScript
can check against the real union) needs its actual rendered output verified in the browser at least
once — `npm run lint`/`tsc --noEmit` cannot catch a string that isn't a real case inside `UiIcon`,
because the cast tells TypeScript to trust it. **Why this matters, concretely:**
`getActivityEventIcon()` (`app/lib/activityFeed.ts`, Sprint 10) returned 4 icon names —
`arrow-down`/`arrow-up`/`sliders`/`edit` — that had no matching case in `components/UiIcon.tsx`.
Every caller cast the result `as UiIconName`, so this passed lint, `tsc`, and `build` for weeks
across three surfaces before being caught by directly counting each icon `<svg>`'s child nodes live
(see Sprint Log "Fix: four activity icon types rendered blank since Sprint 10"). A screenshot alone
didn't catch it either at first — a same-size, same-color, empty circle reads as "an icon" at a
glance. **How to apply:** when reviewing or reusing a call site with an `as UiIconName` (or any
similar string-union cast), check the DOM (child node count, not just visual size/color) rather than
trusting the cast or a cursory screenshot. **Status:** Active (reference).

### 2026-08-12 · Notification Center: generation lives in the TypeScript wrapper, not the SQL RPC
**Decision:** `notifyIfCrossedIntoLowStock()` is called from `recordStockMovement()`
(`app/lib/stockMovements.ts`) — the TypeScript wrapper every one of the 6 movement call sites already
goes through — not added to the `record_stock_movement` Postgres RPC that wrapper calls. **Why:**
low-stock threshold resolution (`getEffectiveLowStockThreshold` / `getEffectiveItemLowStockThreshold`
in `app/lib/subscription.ts` / `app/lib/inventoryItemModel.ts`) depends on plan-capability gating
(`customLowStockThreshold`) and business settings — real business logic that already lives in
TypeScript. Porting it into the SQL function would duplicate that logic in two languages with no
shared source of truth, and the two would eventually drift. Putting the notification check in the
wrapper instead keeps threshold logic in exactly one place while still getting complete coverage,
since every call site already funnels through this same function — verified by grep, all 6 call
sites (Scanner, item page, slide-over, Receiving, Stock Counts, Stock Movement dialog) go through
`recordStockMovement()`, none call the RPC directly. **Corollary:** if a future notification type
needs data the RPC doesn't currently return, extend the RPC's return columns before reaching for a
second query inside the wrapper — but keep all *business rules* (thresholds, plan gates) in
TypeScript. **Status:** Active.

### 2026-08-12 · Notification Center only generates categories with a real trigger
**Decision:** Of the backlog's full category list (Inventory · Billing · AI · System · Updates ·
Team · Low stock · Stock movement · Product announcements), only **low_stock** and **out_of_stock**
generate real notification rows. **Why:** Billing needs a payment webhook that doesn't exist, AI
needs the Assistant (not started, Phase 4), Team needs multi-user (this is a single-user account
today), Product announcements need an authoring surface for someone to write them. Generating rows
for any of these would mean fabricating notifications with no real event behind them — the same
category of mistake already corrected twice this session (the Inventory Value card presenting a
partial sum as a total; the retracted "card ⋯ opens preview" bug report). A notification center that
occasionally lies is worse than a small one that's always true. **How to apply:** when one of the
missing categories gets real infrastructure (a billing webhook, the AI Assistant, multi-user
support), add its notification generation at that point — don't pre-build the UI/schema for
categories with nothing to say yet. The `notifications.type` check constraint in
`sql/phase-13-notifications.sql` intentionally only allows the two values that exist today; widen it
when a third one earns its place. **Status:** Active.

### 2026-08-20 · Size carries hierarchy; weight stops at 600
**Decision:** One type scale across every workspace screen — 12/500 uppercase label, 12/400
secondary, 14/400 body, 14/500 emphasis, 18/600 section heading, 28/600 page title, 28–32/500
figure. **Nothing above weight 600.** **Why:** measured on the live app, Inventory drew 94% of its
text heavier than 600 across weights up to 950, and item detail used six different weights
(400–900) at the same 14px. Six steps of weight at one size is a distinction the eye cannot make,
so nothing could out-rank anything — which is precisely what "it still looks messy" was describing.
Sizes were equally broken: nine steps inside a 2px band (9.92 / 10.88 / 11.2 / 11.52 / 12 / 12.48px).
**How to apply:** when a new element needs emphasis, move it up a *size* step, never past weight
600. If a page appears to need an eighth pair, the composition is wrong, not the scale.
**Status:** Active.

### 2026-08-20 · A border must mean "separate surface" or "pressable"
**Decision:** Four levels only — page (no box) · section (whitespace and an optional hairline, no
border, no shadow) · interactive row or card (hairline only) · floating dialog/menu/popover (the
only thing that gets a shadow). **Why:** an earlier pass in this repo forced one radius and one
shadow onto eleven card classes with `!important`, and `.dashboard-shell-content main > div >
section` painted every section inside a page grid as a card by DOM position rather than by meaning.
The result was technically consistent and visually fatal: every container looked equally important,
so none were. Overview carried 33 boxed regions on its first screen, Inventory 65 — of which 8 were
buttons outlined *inside* an already-outlined card and 7 were filter pills outlined whether selected
or not, which made the selected one unfindable. **How to apply:** before adding a border, say which
of the four levels the element is. A button inside a card it belongs to is not a separate surface.
An unselected filter is not a state worth drawing. **Status:** Active.

### 2026-08-20 · A page is titled by its own heading, not by the chrome
**Decision:** Overview, Inventory and item detail each render a visible `<h1>`; the top bar's
page-name label is switched off (via `:has()`) on exactly those pages. Pages still using the shared
`DashboardPageHeader` keep the chrome label and their visually-hidden `<h1>`. **Why:** an earlier
pass correctly identified that the page name printed twice — and then deleted the wrong copy,
leaving screens with no title of their own. Deleting the chrome copy instead keeps the document
self-titling. **How to apply:** as each remaining page is rebuilt, unhide its `<h1>` and add it to
the `:has()` list in the "ONE PAGE NAME, NOT TWO" block, so no page is ever left untitled *and* none
prints its name twice. **Status:** Active — list grows as pages are converted.

### 2026-08-20 · Revoking a Postgres privilege means revoking it from PUBLIC
**Decision:** Function grants are managed by revoking `EXECUTE` from `PUBLIC` (plus
`ALTER DEFAULT PRIVILEGES` for future functions), then granting explicitly to `authenticated` — and
to `anon` only for `get_public_item`. **Why:** `sql/phase-15` revoked from `anon` and
`authenticated`, every statement succeeded, and nothing changed: PostgreSQL grants `EXECUTE` to
`PUBLIC` on function creation, and a named-role revoke is a no-op while `PUBLIC` still holds the
privilege. It showed in the ACL as an entry with an empty grantee (`=X/postgres`). Caught only
because the migration shipped with its own verification query. **How to apply:** never conclude a
permission change worked because the statement parsed — check `proacl`/`has_*_privilege` after, and
ship migrations with a verification query that states the expected row count. **Status:** Active.

### 2026-08-20 · The workspace ground carries the brand light; the page stays white
**Decision:** The plane behind the sidebar is tinted and carries a blue bloom anchored on the logo
mark; the content panel stays white. The rail and header are translucent so the light passes
through them. **Why:** this reconciles two of Sayed's notes that read as contradictory — "make the
page background white" (2026-08 founder decision, still honoured: the *page* takes no colour) and
"make a shadow blue come from the logo to the sidebar and header, not fully, appear with distance".
They are two different surfaces. It also removed the actual colour clash he was reporting: the
ground was four drifting **amber and orange** orbs sitting under a blue brand. **How to apply:** the
ground is defined in exactly one place (the "THE WORKSPACE GROUND" block at the end of
`globals.css`). It had previously been declared eight times, four of them repainting a layer a later
rule set to `display: none` — do not add a ninth; edit that block. **Status:** Active.
