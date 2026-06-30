# SydIN — Master Roadmap

Long-horizon plan. Phases are sequential in priority but not rigid. Do **not** jump ahead to
later phases (e.g. Scanner, QR & Labels) until the current foundation work is explicitly
signed off and the user asks for it.

---

## Phase 1 — Foundation  *(in progress, mostly complete)*

- Design system
- Shared dashboard components
- Motion system
- Dashboard polish
- Settings Control Center
- Inventory polish
- Categories polish
- Item details polish
- Add/Edit Item UX polish

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

## Immediate next work

Do **not** start Scanner or QR features yet.

**Recommended next sprint — Sprint 3B: Inventory CSS Stabilization**

Goal: keep the approved Sprint 3 Inventory UI visually identical, but reduce CSS risk.

- Inspect inventory-specific CSS in `app/globals.css`.
- Keep inventory styles scoped to `.inventory-workspace`.
- Remove clearly obsolete / duplicate inventory CSS rules.
- Organize inventory styles into a clearer, single section.
- Preserve the current approved layout and behavior exactly.

> Do not begin Sprint 3B until explicitly asked.

---

## Founder feature ideas (future — not yet scheduled)

### Scanner System
QR scan · barcode scan · mobile camera scanner · desktop scanner workflows ·
scan to search item · scan to add product · scan to open item · scan modes.
Modes: **Lookup · Receive · Issue · Transfer · Inventory Count · Assign Asset · Repair · Return**.

### QR & Labels
QR generator · barcode generator · bulk QR · label templates · business logo · brand colors ·
small/medium/large labels · printable PDF · PNG/SVG export · label history · branded sticker templates.

### Import / Export Center
CSV/Excel upload · template download · column mapping · row validation · warnings/errors ·
import valid rows · import history · export CSV · export PDF · export Excel.

### Stock Alerts
Per-item low-stock threshold · email notification · dashboard notification · push notification ·
later: automatic purchase-order draft.

### Notification Center
Inventory alerts · billing · AI · system · product updates · team actions · stock-movement updates.

### Custom Fields (dynamic per-category)
- Electronics: serial number, warranty, CPU, RAM
- Food: expiry, origin, batch
- Vehicles: plate, VIN, engine
- Arbitrary custom fields per category

### AI Assistant
What needs restocking · duplicate items · monthly reports · inventory value by supplier ·
inactive items · purchase recommendations · daily activity summary.

### Automation Engine (no-code)
- IF stock < threshold THEN notify
- IF warranty expires THEN notify manager
- IF item added THEN generate QR
- IF stock count mismatch THEN create task
- IF supplier added THEN create checklist
