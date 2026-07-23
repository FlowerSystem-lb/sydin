# SydIN — Master Roadmap

Long-horizon plan. Phases are sequential in priority but not rigid. Do **not** jump ahead to
later phases (e.g. Scanner, QR & Labels) until the current foundation work is explicitly
signed off and the user asks for it.

---

## Phase 1 — Foundation  *(complete)*

- Design system ✅
- Shared dashboard components ✅
- Motion system ✅
- Dashboard polish ✅
- Settings Control Center ✅
- Inventory polish ✅ (Sprint 3)
- Inventory CSS stabilization ✅ (Sprint 3B)
- Categories polish ✅ (Sprint 4)
- Item details polish ✅ (Sprint 5 slide-over, Sprint 5B full page)
- Add/Edit Item UX polish ✅ (Sprint 6)
- Mobile inventory QA ✅ (Sprint 7)
- Loading / empty / error states everywhere ✅
- Glass 2.0 whole-app visual pass ✅ (Sprints E1–E5, plus A/D1–D3/F cleanup)

## Phase 2 — Operations  *(complete)*

- Scanner Workspace · Barcode scanner · QR scanner · all 8 modes (Lookup, Receive, Issue,
  Transfer, Count, Assign, Repair, Return) ✅ (Sprint 9, stages 0–3)
- Receiving ✅ (Sprint RCV-1) · Transfers ✅ · Stock Count ✅
- Purchase Orders (full module: create, receive, payments/balance/timeline, PDF/Excel export) ✅
  (Sprints PO-A/B/B.1/C/D, B1, B2)
- QR & Labels · label templates · bulk print · brand labels ✅ (Sprint 8)

## Phase 3 — Intelligence  *(complete)*

- Stock Alerts (triage page + per-item alert level) ✅ (Sprint 10 stage 1)
- Activity Feed (unified timeline across stock/edits/POs) ✅ (Sprint 10 stage 2)
- Search Everywhere · Command Palette ✅ (Sprint 12)
- Reports polish (added Supplier + Depot/Location reports) ✅ (Sprint 11)
- Notification Center · Item Timeline deep-dive — **not built**, remains open backlog inside
  this phase (see `SYDIN_FEATURE_BACKLOG.md`)

## Mobile shell  *(in progress — pulled forward from Phase 2/3, per `SYDIN_MOBILE_ROADMAP.md`)*

- M1 — Mobile QA of foundation ✅ (Sprint 7)
- M2 — Mobile shell: bottom nav, mobile dashboard, alert badges, More sheet, mobile item card
  component, scroll-to-top ✅ (Sprint M2, verified 2026-07-23)
- M3 — Scan-first mobile: tuned fast-scan mode on the mobile shell *(next)*.
  **Re-scoped 2026-07-24:** the original "wire `MobileInventoryCard` into Inventory" task was
  dropped — live verification showed the inventory page already has a working CSS-based mobile
  layout (Sprint 7), and `MobileInventoryCard` is unused dead code. Wiring it in would replace
  working UI with a duplicate. Decide instead whether to **delete** that component.
- M4 — Mobile alerts/notification surfacing *(after Notification Center exists)*
- M5 — Offline & push *(Phase 4+, deferred)*

## Phase 4 — Smart Platform  *(not started)*

- AI Assistant · Automation Engine
- Purchase Orders forecasting · Maintenance tracking
- API · Integrations

## Phase 5 — Enterprise  *(not started)*

- RBAC · Audit Logs · SSO
- Marketplace · Multi-workspace / multi-company · White label

---

## Immediate sprint sequence

Phases 1–3 are **complete** (Sprints 1–12 plus the PO/RCV sub-sprints — see
`SYDIN_SPRINT_LOG.md` for the full history). Current work is the **mobile shell** (M2 done,
M3 next), pulled forward from the phase list per the founder's mobile-first priority. Suggested
order from here:

1. **M3 — Scan-first mobile**: wire the existing-but-unused `MobileInventoryCard` into the
   Inventory page's mobile render path; tune the scanner's mobile flow.
2. Decide the fate of the orphaned `/dashboard/mobile-preview` route (flagged in the Sprint M2
   log entry).
3. **Notification Center** (the one undone Phase 3 item) — needed before M4 (mobile alerts).
4. Then move into **Phase 4 — Smart Platform** per the backlog priorities.

> Each sprint: plan-first if risky, verify (`lint`/`tsc`/`build` + screenshots), log it in
> `SYDIN_SPRINT_LOG.md`. Don't begin a sprint until explicitly asked.

For the full "what could we build" list with priorities, see
[SYDIN_FEATURE_BACKLOG.md](SYDIN_FEATURE_BACKLOG.md). Mobile detail lives in
[SYDIN_MOBILE_ROADMAP.md](SYDIN_MOBILE_ROADMAP.md).

---

## Founder feature ideas (future)

The detailed, prioritized feature list — Scanner System, QR & Labels, Import/Export Center,
Stock Alerts, Notification Center, Dashboard, Reports, Activity/Timeline, Search & Command
Palette, Custom Fields, AI Assistant, Automation Engine, Purchase Orders/Receiving, and Mobile
— now lives in **[SYDIN_FEATURE_BACKLOG.md](SYDIN_FEATURE_BACKLOG.md)** with priority (P0–P3),
impact, difficulty, phase, and dependencies. This roadmap stays focused on phases and sprint
sequence; the backlog holds the idea detail.
