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

## 6. Notification Center — **Light v1 done (2026-08-12)**

Unread · Inventory · Billing · AI · System · Updates · Team · Low stock · Stock movement ·
Product announcements.  **Priority: P2**, after Activity/Timeline foundation.

Shipped a bell icon (desktop/tablet top bar) with a badge and dropdown, computed live from
existing data — Stock Alerts' own low-stock logic + the Activity feed. No new database table, no
read/unread state; this was an explicit scoping choice (the alternative needed schema changes, so
it was surfaced rather than assumed). **Upgrade path, not yet built:** a real `notifications` table
with persistence, mark-as-read, and category filtering (Billing/AI/System/Team/Updates categories
above aren't meaningful yet without that — Billing has no events to notify on, AI doesn't exist).

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
which broke `position: fixed` app-wide) · the `flwow` → `Flower` category typo · **A / B / G**
(inventory three-tier toolbar, 2026-08-06) · **D** (item quick preview, 2026-08-10) · **C** (card
design — shown mockups, decided to keep current, 2026-08-12) · **E** (full
item page, 2026-08-11) — see the sub-list below.

### 3. Dashboard — **next up, his stated priority**
"Finish the full Dashboard page, start finishing and deploying each page. Dashboard should connect
from all the pages and make a full summary, smart and professional, about stats."

Approach agreed before writing code:
1. **Decide what the stats answer first.** "What needs my attention today?" is a different page from
   "how is my business doing?" Today it shows counts without conclusions.
2. **Every card links to its filtered view** — that is the "connect from all the pages" part.
3. Design last, not first.

### 1. Add items by barcode scan  *(P1 — approved)* — **Done (2026-08-11)**
Scan the QR/barcode printed on the carton, then fill in the rest (photo, cost, details). Manual
entry of the number as a fallback. Correct as specified: a barcode identifies a **product type**,
not a physical unit, so "same barcode = same item" is right for inventory.

Add Item gained a **Scan** button next to the manual Barcode field (opens the same scanner modal
Inventory already uses). A code that matches nothing pre-fills the field; a code that already
belongs to an item shows a link to that item instead of creating a duplicate — the same-barcode-
same-item rule, enforced. Inventory's own Scan button no longer dead-ends on an unmatched code
(it used to fall back to a search guaranteed to find nothing); it now routes straight into Add Item
with the code carried over. `/dashboard/scanner` itself was not touched, per standing instruction.
**Still open:** manually *typing* a duplicate barcode isn't checked yet — only the scan path is.

### 2. Batch add + Excel import with photos  *(P2 — biggest, do last)* — **Done (2026-08-11)**
POS-style batch adding of several items by barcode, plus batch photo upload for several items at
once, compounded with the Excel import.

**Do NOT match photos to rows by order (1,2,3,4).** One failed upload or a phone sorting by date
instead of name shifts every subsequent photo onto the wrong item, silently. **Match by filename
against the SKU in the row** (`FP007.jpg` → row with SKU FP007) — order-independent, and a mismatch
is visible immediately. Same effort, cannot scramble.

The Excel/CSV import already existed (a full wizard at `/dashboard/inventory/import`) and needed no
rebuilding. Added: filename-to-SKU photo matching, never by order, with every non-match (no SKU
match / duplicate SKU claim / wrong file type) reported by filename, not hidden — a failed photo
upload doesn't block the item's import. And a "Start Scanning" entry point on the same page: scan
several new items POS-style, name each one, then continue straight into the same review/import flow
the Excel path uses — one save path, two ways in. A scanned code that already matches an existing
item is skipped, never duplicated, same rule as item 1.

### Inventory sub-list
- **A. Done (2026-08-06).** Page actions sit in the page header: **Add item** filled, **Scan** and **⋯**
  outline (⋯ is now icon-only). The outline is finally *visible* — those buttons had white borders left
  over from the glass era, invisible since the page went flat white.
- **B. Done (2026-08-06).** Three tiers: page actions in the header · one control row (search flexes,
  Filters/Compact/sort/view/Select fixed) · chips + count below, with "Showing X of Y" as plain text.
  The ~5-row stack was two rules firing together at ~1070px — a viewport `@media` and a `@container`
  rule disagreeing about the width. Measured 1070×800: toolbar **252px → 114px**, control rows
  **4 → 1**. All inventory-layout thresholds are now `@container`.
- **C. Closed, keep current (2026-08-12).** Unblocked after D/E, then decided rather than deferred:
  shown three mockups against a real item (`ead`) — Compact (same layout, ~40% shorter, status
  collapsed to one dot instead of a pill *and* a badge saying it twice), a data-first row (rejected
  outright — it's the existing list view; building it as the card would make two views look
  identical), and a visual-first card (rejected — 8 of 10 items have no photo today, so it would
  render mostly empty placeholders). **His call: current is good.** No Pinterest references sent;
  none needed. Not revisiting without a specific complaint.
- **D. Done (2026-08-10).** Regrouped the flat 14-row Details tab into Identity · Stock & Unit ·
  Supplier · Pricing & Value · Tracking Codes, mirroring the order already established on the full
  item page — that's the "more classic, reorganised" part. Adjust Stock moved below the fact groups
  (previously it sat *above* every fact about the item). Activity tab now merges movements +
  history into one design (icon badge + consistent row style) instead of two visually different
  lists glued together.
  - ~~*Still open: clicking a card's own ⋯ in the Inventory grid opens this preview instead of the
    card's menu.*~~ **RETRACTED 2026-08-12 — this was never a real bug; I misdiagnosed it.**
    Re-tested properly: clicking the ⋯ element directly opens its menu with all 7 items and does
    **not** open the preview. `toggleMenu` in `components/inventory/InventoryItemCard.tsx` already
    calls both `preventDefault()` and `stopPropagation()`, and the card root is an
    `<article role="button">`, so there is no nested-`<button>` problem either. The original
    "reproduction" was a **test-harness coordinate artifact**: the browser viewport is 1440×900
    while its screenshots are 800×500 (a 1.8× factor), so coordinate clicks landed ~1.8× off —
    delegated event logging proved the click target was an `<img>` in a *different* card
    (`inMenuBtn=false`), i.e. the ⋯ was never hit. **Lesson for future sessions:** verify
    click-target bugs with a coordinate-free test (dispatch on the element, or assert
    `elementFromPoint` immediately before clicking) before believing a harness click.
- **E. Done (2026-08-11).** The "dead space" was measurable: the image panel was a fixed-height box
  stretched across its column into a **~1.82:1 letterbox**, so a real 4:3 product photo pillarboxed
  to **~27% empty space** (a portrait phone photo, ~59%). Reframed to `aspect-[4/3]` capped at 26rem
  — **waste for a 4:3 photo ~27% → 0%**. Section headings/figures scaled down one step (the page
  `<h1>` was checked against the Inventory hero convention and left alone — it already matched).
  Also removed **four content duplications** found in the audit: the item name shown twice, "Item QR
  Code" twice, two sentences saying the same thing under the QR, and the quantity repeated as a
  "Current stock" card right under the heading already showing it. First-letter avatars ("S", "C")
  in Stock Movements / Item History replaced with real tone-colored icons.
- **G. Done (2026-08-06).** Menu = Import inventory → the wizard · Export CSV / PDF / Excel → the
  in-page exports · **Import & export history** → `/dashboard/import-export` (new link). The menu does
  not route *through* that page: it is a history log whose own Export button is disabled with the note
  "Export from inventory page", and whose Import button just forwards to the wizard.
  **Still Sayed's call:** CSV and Excel export **all** items, but PDF exports the **filtered** view.
  Recommendation: make all three follow the current view — what you're looking at is what you export.
  Left unchanged because it alters working export behaviour.

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
