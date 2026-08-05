# SydIN — Feature Backlog

The prioritized backlog of everything SydIN wants to become. This is the "what could we
build" list; the **sequence** we actually build in lives in [SYDIN_ROADMAP.md](SYDIN_ROADMAP.md).
Before promoting any item into a sprint, run it through the **Feature Review Template** in
[SYDIN_PRODUCT_PRINCIPLES.md](SYDIN_PRODUCT_PRINCIPLES.md).

## Priority legend

| Tag | Meaning |
|-----|---------|
| **P0** | Must be stable before public launch. |
| **P1** | Important post-launch / early paid feature. |
| **P2** | Growth / advanced workflow. |
| **P3** | Enterprise / long-term platform. |

Columns: **Impact** (user value), **Difficulty** (build effort), **Phase** (roadmap phase),
**Deps** (what must exist first). Difficulty/Impact are rough founder-facing estimates, not
engineering commitments.

> Rule of focus: Scanner and QR are exciting and are strong differentiators, but **do not
> jump to them** until Inventory, Categories, Item Details, and Add/Edit Item UX are stable.

---

## 1. Inventory UX  *(foundation — highest near-term priority)*

| Feature | Priority | Impact | Difficulty | Phase | Deps | Notes |
|---|---|---|---|---|---|---|
| Categories workspace polish | P0 | High | Med | 1 | Inventory foundation | Sprint 4. |
| Item Details page/slide-over polish | P0 | High | Med | 1 | Inventory foundation | Sprint 5. |
| Add Item UX polish | P0 | High | Med | 1 | Categories, Item Details | Sprint 6. |
| Edit Item UX polish | P0 | High | Med | 1 | Add Item | Pairs with Sprint 6. |
| Category creation inside Add Item (no redirect) | P1 | High | Med | 1 | Add Item | Removes a workflow break. |
| Dynamic forms by category | P2 | High | High | 4 | Custom fields | Strong differentiator. |
| Custom fields per category | P2 | High | High | 4 | Data model work | See §10. |
| Better item cards | P1 | Med | Low | 1 | — | Iterates on Sprint 3. |
| Grid/table view switch polish | P1 | Med | Low | 1 | — | — |
| Better filters | P1 | Med | Med | 1 | — | — |
| Search by name / SKU / barcode / depot / supplier | P1 | High | Med | 3 | Search foundation | Feeds Search Everything. |
| Bulk actions | P1 | Med | Med | 2 | Selection bar | — |
| Item timeline / history | P1 | High | Med | 3 | Activity foundation | See §8. |
| Item attachments | P2 | Med | Med | 4 | Storage | — |
| Item notes | P1 | Low | Low | 1 | — | — |
| Empty / loading / error states everywhere | P0 | Med | Low | 1 | Shared primitives | Required by UI rules. |
| Mobile-optimized item list | P1 | High | Med | 2 | Mobile roadmap | See [SYDIN_MOBILE_ROADMAP.md](SYDIN_MOBILE_ROADMAP.md). |

## 2. Scanner System

Capabilities: QR scan · barcode scan · mobile camera scanner · desktop scanner workflow ·
scan to search · scan to open item · scan to add item · beep/ready/next-scan loop.

Scanner **modes**: Lookup · Receive · Issue · Transfer · Inventory Count · Assign Asset ·
Repair · Return.

*Inventory Count mode:* start count → scan items → mark found → show expected vs found →
show missing / unexpected.

| Feature | Priority | Impact | Difficulty | Phase | Deps |
|---|---|---|---|---|---|
| Scanner workspace design foundation | P1 | High | Med | 2 | Inventory + Item Details stable |
| Barcode + QR camera scanning | P1 | High | High | 2 | `@zxing/browser` (already a dep) |
| Scanner modes (Lookup/Receive/Issue/…) | P1 | High | High | 2 | Scanner foundation |
| Inventory Count mode | P1 | High | High | 2 | Stock Count module |

> Priority: **P1, after** Inventory / Add-Edit / Item Details are stable.

## 3. QR & Labels  *(strong differentiator)*

Generate QR/barcode per item · bulk labels (10/50/100/custom) · small/medium/large templates ·
asset / shelf / shipping / warehouse labels · company logo · brand colors · PDF + PNG/SVG
export · label history · label preview · bulk print · public item scan page · future
drag-and-drop label designer.

| Feature | Priority | Impact | Difficulty | Phase | Deps |
|---|---|---|---|---|---|
| QR & Labels workspace design foundation | P1 | High | Med | 2 | Item model stable |
| Per-item QR / barcode generation | P1 | High | Med | 2 | `react-qr-code`, `jspdf` (deps exist) |
| Bulk label print → PDF | P1 | High | High | 2 | Label templates |
| Brand labels (logo + colors) | P1 | High | Med | 2 | Business settings |
| Public item scan page | P2 | Med | Med | 2 | Routing/auth review (do not change without ask) |
| Drag-and-drop label designer | P3 | Med | High | 4 | Labels module mature |

**Known gap:** items without a `public_id` cannot get a QR/label and are silently filtered
from the printable set in QR Center, with no in-UI way to generate one. Needs a scoped sprint
(backend behavior) if/when prioritized. Flagged 2026-07.

## 4. Import / Export Center

CSV/Excel upload · template download · column mapping · row validation · warnings/errors ·
import valid rows · import history · export CSV/PDF/Excel · scheduled exports (later).

| Feature | Priority | Impact | Difficulty | Phase | Deps |
|---|---|---|---|---|---|
| Import wizard (mapping + validation) polish | P0/P1 | High | Med | 1–2 | Existing import shell (`app/lib/inventoryImport.ts`) |
| Import history | P1 | Med | Med | 2 | — |
| Export CSV / PDF / Excel | P0 | High | Low | 1 | Already wired in More dropdown |
| Scheduled exports | P3 | Low | High | 4 | Automation engine |

## 5. Stock Alerts

Low-stock threshold per item · alert settings from item menu · dashboard alert · email alert ·
push (later) · notification-center alert · future automatic PO draft.

| Feature | Priority | Impact | Difficulty | Phase | Deps |
|---|---|---|---|---|---|
| Per-item low-stock threshold | P1 | High | Med | 3 | Item model |
| Dashboard + notification alerts | P1 | High | Med | 3 | Notification center |
| Email alerts | P1 | Med | Med | 3 | Email infra (verify Supabase/provider) |
| Auto PO draft on low stock | P3 | High | High | 4 | Automation + PO |

## 6. Notification Center

Unread · Inventory · Billing · AI · System · Updates · Team · Low stock · Stock movement ·
Product announcements.  **Priority: P2**, after Activity/Timeline foundation.

## 7. Dashboard  *(answers "what needs attention right now?")*

Inventory health · today's activity · recent changes · low stock · quick actions ·
AI suggestions (later) · scanner activity · pending alerts.  **Priority: P0/P1 polish.**

## 8. Activity Feed / Timeline

Company activity feed + item-specific timeline events: created · edited · moved ·
quantity changed · assigned · returned · QR generated · label printed · archived.
**Priority: P1/P2.** Foundational for Stock Alerts, Notifications, AI, and Item history.

## 9. Reports / Analytics  *(interactive)*

Inventory value · stock movement · supplier · location · low-stock reports · exports ·
saved reports · scheduled reports (later) · click chart → see items.  **Priority: P1/P2.**

## 10. Custom Fields  *(strong differentiator)*

Category-based custom fields with templates: Electronics · Vehicles · Food · Medical ·
Construction · Retail · Library.
Examples — Electronics: serial, warranty, CPU, RAM, storage · Food: expiry, batch, origin,
calories · Vehicles: plate, VIN, engine, color.  **Priority: P2.** Requires careful data-model
work (do not touch schema without an explicit, approved sprint).

## 11. AI Assistant

What needs restocking · find duplicate items / SKUs · monthly report · inventory value by
supplier · inactive items · suggest POs · summarize today's warehouse changes.
**Priority: P3** — only after foundation, activity, reports, and a clean data model exist.
Use the latest Claude models when built (see [claude-api] guidance).

## 12. Automation Engine  *(no-code)*

IF stock < threshold THEN notify · IF item added THEN generate QR · IF warranty expires THEN
notify · IF stock-count mismatch THEN create task · IF supplier added THEN create checklist ·
IF low stock THEN draft PO.  **Priority: P3.**

## 13. Purchase Orders / Receiving

Supplier → order → receiving → inventory update → timeline → reports. PO output/export ·
draft PO · receive against PO · stock updates only when receiving is finalized · supplier
context.  **Priority: P1/P2.**

## 14. Mobile  *(not just responsive desktop)*

Scan-first UX · bottom nav (Home / Inventory / Scan / Activity / More) · large touch targets ·
fast scanner mode · mobile item cards · offline mode (later) · push (later).
**Priority: P1/P2.** Full detail in [SYDIN_MOBILE_ROADMAP.md](SYDIN_MOBILE_ROADMAP.md).

---

## 15. Settings & Account platform  *(migrated out of the Settings UI, 2026-07-25)*

These were previously rendered **inside `/dashboard/settings`** as six "Roadmap" cards (~33
chips) by an earlier ChatGPT-authored pass. They are genuine future features, so they are
preserved here — but they were removed from the Settings UI because Settings is a utility
surface: listing 33 controls a user cannot touch buries the ones that work, and it advertises
how much of the platform is unbuilt (the Security section alone showed 9 missing controls).
**Roadmaps live in this document; Settings shows only working controls.**

### 15a. Branding  **Priority: P2**
Report template colors · custom email sender · branded customer portal.
*Deps:* existing business-settings logo/branding + an email provider (see 15d).

### 15b. Reports automation  **Priority: P2**
Saved report templates · scheduled email delivery · delivery preferences.
*Deps:* email provider (15d). Report generation/export already exists (Sprint 11).

### 15c. Billing system  **Priority: P1**
Invoices · payment methods · checkout & upgrades · billing history · seat/team billing ·
usage metering.
*Deps:* payment provider decision — still open, see [SYDIN_PAYMENTS_STRATEGY.md](SYDIN_PAYMENTS_STRATEGY.md).
Today's manual plan-request + admin-activation flow stays the supported path until then.

### 15d. Email & notifications  **Priority: P1**
Low-stock alerts · stock-movement alerts · receiving confirmations · pick-list updates ·
scheduled report emails · branded sender · reply-to controls · domain verification.
*Deps:* **email-provider/infra decision is the blocker** — this is the single dependency that
unlocks 15a, 15b and half of Notification Center (§6). Highest-leverage unblock in this section.

### 15e. Advanced security  **Priority: P2 → P3**
MFA · active sessions · trusted devices · sign out of all devices · security notifications
*(P2)* · team roles · audit log · approval flows · provider management *(P3 — enterprise, see
Phase 5)*.
*Note:* team roles/audit log overlap Phase 5 RBAC; build them there, not as Settings toggles.

### 15f. Advanced data tools  **Priority: P2**
Workspace backups · restore points · audit snapshots · advanced exports.
*Caution:* restore/backup are destructive-adjacent; they need confirmation flows and a tested
restore path before shipping. Import/export already exist today.

---

## 16. Founder edit list — 2026-08-04 (handwritten notes)

Captured verbatim-in-substance from Sayed's handwritten pages so a cold session can act on
them. **Next action: item 3 (Dashboard).** He will open a new session and say "start dash".

**Already done from this list:** F (white page background) · 4 (dialogs opening half off-screen —
root cause was `.dashboard-route-transition` retaining a transform via `animation-fill-mode: both`,
which broke `position: fixed` app-wide) · the `flwow` → `Flower` category typo.

### 3. Dashboard — **next up, his stated priority**
"Finish the full Dashboard page, start finishing and deploying each page. Dashboard should connect
from all the pages and make a full summary, smart and professional, about stats."

Approach agreed before writing code:
1. **Decide what the stats answer first.** "What needs my attention today?" is a different page from
   "how is my business doing?" Today it shows counts without conclusions.
2. **Every card links to its filtered view** — that is the "connect from all the pages" part.
3. Design last, not first.

### 1. Add items by barcode scan  *(P1 — approved)*
Scan the QR/barcode printed on the carton, then fill in the rest (photo, cost, details). Manual
entry of the number as a fallback. Correct as specified: a barcode identifies a **product type**,
not a physical unit, so "same barcode = same item" is right for inventory.

### 2. Batch add + Excel import with photos  *(P2 — biggest, do last)*
POS-style batch adding of several items by barcode, plus batch photo upload for several items at
once, compounded with the Excel import.

**Do NOT match photos to rows by order (1,2,3,4).** One failed upload or a phone sorting by date
instead of name shifts every subsequent photo onto the wrong item, silently. **Match by filename
against the SKU in the row** (`FP007.jpg` → row with SKU FP007) — order-independent, and a mismatch
is visible immediately. Same effort, cannot scramble.

### Inventory sub-list
- **A.** New header inside the page for buttons + the three-dot (More) menu.
- **B.** Reorder/organize the buttons — decide what is actually important. *(Toolbar currently
  stacks into ~5 rows at some widths.)*
- **C.** New card design sourced from the web. **Deferred** — cards were just made uniform; revisit
  after D/E. He offered to send Pinterest references; ask for them at that point.
- **D.** Quick preview (slide-over) needs a new prototype — more classic, reorganised; Activity tab
  needs its own design.
- **E.** Full item page needs a new layout — text too large, dead space on the left.
- **G.** Three-dot menu: decide what Import inventory / Export CSV / Export PDF / Export Excel do.
  *(An Import & Export page already exists at `/dashboard/import-export` to point at.)*

### Standing instructions from the notes
- Act as software engineer **and** UI/UX designer; prototype, organise, be **strict** and say when
  an idea is not good.
- Target **laptop / tablet / PC**. Phones come later as a separate Sortly-style mobile pass.
- He will keep adding edits; organise them rather than doing them in arrival order.
- He is happy to supply design references from Pinterest when asked.
- **Scanner page: he likes it as-is — leave it alone.**

### Open, his decision
- 4 no-op rows remain in `inventory_history` (ids 31, 32, 37, 39). Blocked for me by the safety
  classifier — deleting audit rows needs to be run by him. Harmless if left; the bug that created
  them is fixed.
- Category `hj` (id 2) belongs to a **different** `user_id` than his other categories — likely an
  old test account. FK is `ON DELETE SET NULL`, so deleting it is safe.
