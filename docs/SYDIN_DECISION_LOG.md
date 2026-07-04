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

<!-- Append the next decision below this line. -->
