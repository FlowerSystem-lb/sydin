# SydIN — Master Roadmap

Long-horizon plan. Phases are sequential in priority but not rigid. Do **not** jump ahead to
later phases (e.g. Scanner, QR & Labels) until the current foundation work is explicitly
signed off and the user asks for it.

---

## Phase 1 — Foundation  *(in progress)*

- Design system ✅
- Shared dashboard components ✅
- Motion system ✅
- Dashboard polish ✅
- Settings Control Center ✅
- Inventory polish ✅ (Sprint 3)
- Inventory CSS stabilization ✅ (Sprint 3B)
- Categories polish *(next — Sprint 4)*
- Item details polish *(Sprint 5)*
- Add/Edit Item UX polish *(Sprint 6)*
- Mobile inventory QA *(Sprint 7)*
- Loading / empty / error states everywhere
- QA screenshot workflow

## Phase 2 — Operations

- Scanner Workspace · Barcode scanner · QR scanner · Scanner modes
- Receiving · Transfers · Stock Count
- QR & Labels · Label templates · Bulk print · Brand labels

## Phase 3 — Intelligence

- Activity Feed · Notification Center · Item Timeline · Stock Alerts
- Search Everywhere · Command Palette
- Reports polish · Analytics

## Phase 4 — Smart Platform

- AI Assistant · Automation Engine
- Purchase Orders improvements · Forecasting · Maintenance tracking
- API · Integrations

## Phase 5 — Enterprise

- RBAC · Audit Logs · SSO
- Marketplace · Multi-workspace / multi-company · White label

---

## Immediate sprint sequence

Sprint 3B (Inventory CSS Stabilization) is **complete**. Build in this order — finish the
foundation before the exciting Scanner/QR work:

1. **Sprint 4 — Categories Workspace Polish**
2. **Sprint 5 — Item Details Polish**
3. **Sprint 6 — Add/Edit Item UX Polish**
4. **Sprint 7 — Mobile Inventory QA**
5. **Sprint 8 — QR & Labels Workspace Design Foundation**
6. **Sprint 9 — Scanner Workspace Design Foundation**
7. **Sprint 10 — Stock Alerts + Activity Foundation**
8. **Sprint 11 — Reports Polish**
9. **Sprint 12 — Search / Command Palette Foundation**

> ⚠️ Scanner and QR are exciting and are strong differentiators, but **do not jump to them**
> (Sprints 8–9) until Inventory, Categories, Item Details, and Add/Edit Item UX are stable
> (Sprints 4–7). Each sprint: plan-first if risky, verify (`lint`/`tsc`/`build` + screenshots),
> log it. Don't begin a sprint until explicitly asked.

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
