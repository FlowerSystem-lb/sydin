# SydIN — Plan of Record

**Date:** 18 August 2026
**Shared view:** https://claude.ai/code/artifact/c7e93db9-8082-47d5-8f06-4ff8b9b8f5c4

Buyer: wholesale accessories depots in Lebanon whose daily problem is not knowing
what is still in stock. Every status below reflects what was **verified in the
running application**, not what the code appears to do.

---

## Done and verified

**Design system** — the Refero/Steep reference adapted to SydIN: serif headlines at
weight 400, pill controls, one card radius, quiet shadows. SydIN's blue replaces the
reference's peach so the brand stays recognisable. Applied across the public site
(landing, pricing, features, demo, contact, sign-in) and the dashboard. Sign-in keeps
its blue animated panel per the founder's instruction.
See [SYDIN_PHASE5_VISUAL_REFERENCE.md](SYDIN_PHASE5_VISUAL_REFERENCE.md).

**Landing page** — rewritten for one buyer. Headline names the problem ("Know what is
in your depot") rather than the product. Floating product cards drift around the
headline, sections fade and rise on scroll, one accent card, and a six-question FAQ
whose answers were each checked against real app behaviour.

**Plan limits enforced in the database** — `sql/phase-14-plan-item-limit.sql`. Item
caps were previously browser-only and therefore unenforceable. Simulated against all
8 accounts before running; none blocked. BEFORE INSERT only, so existing rows and
over-cap accounts are never frozen.

**Notification Center table** — `sql/phase-13-notifications.sql`, created with its
four RLS policies.

**Pricing** — Standard $19 → $9, Pro $29 → $19, with monthly/yearly billing defaulting
to yearly (ten months' price). Rationale: the real competitor is a notebook and Excel,
which cost nothing; twenty active depots matter more in year one than the revenue
difference. Yearly also means one Whish/OMT transfer instead of twelve, which matters
because activation is manual.

**Data cleanup** — removed 2 orphaned `inventory` rows (`user_id` null) from the first
testing day. RLS filters by owner, so they were invisible and undeletable from the app.

---

## Phases from here

Each phase ends with `npm run lint`, `npx tsc --noEmit`, `npm run build`, and a live check.
Status below reflects the six commits made since this plan was first written.

### 01 — Settings rebuild *(half done)*
**Done:** the Workspace tab rendered two separate forms with two "Save settings"
and two "Reset" buttons for the same state -- now one form, one save bar per
editable tab. Removed two buttons that switched to the Workspace section from
*inside* the Workspace section. Added the missing link to Import & Export, the
one destination a section named "Data & Reports" never pointed at. Nested cards
restyled to the app's surface scale.

**Not done:** 13 of the 30 cards are still `ModuleLink` pointers to other pages
rather than settings you can change. Deciding what each becomes -- a real
setting, a move elsewhere, or deletion -- is a product call rather than a
mechanical one, so it is worth doing deliberately rather than in a sweep.

### 02 — Plan features and limits *(done)*
Founder delegated the split. The audit that preceded it is the useful part: no
operational module was gated at all. Purchase Orders, Receiving, Stock Movements
and Activity had zero capability checks, so Free was the entire product minus a
few limits and exports -- there was little reason to pay.

Free now delivers exactly what the landing page promises ("know what is in your
depot"): items with photos, stock history, low-stock alerts, public QR pages, CSV
export. The buying workflow -- purchase orders and receiving -- starts at
Standard, and is **enforced in the app**, not only described on the pricing page.
Stock Movements and Activity stay free deliberately: they are read-only history
of what already happened, which is part of the Free promise.

### 03 — Mobile, designed as an app *(last, by founder instruction)*
Explicitly moved to the end. Not a narrowed desktop layout: its own pass, with
bottom navigation, scan-first entry, thumb-reachable actions and full-height
sheets. See [SYDIN_MOBILE_ROADMAP.md](SYDIN_MOBILE_ROADMAP.md).

### 04 — Proof and launch content *(blocked on the founder)*
Still the single highest-value item, and still not something to invent. One real
depot -- even a friend's -- with a first name and a shop name unlocks the Lebanon
launch content.

### 05 — Performance *(started)*
Removed the `fin-*` system: 118 rules, ~870 lines, proven unreferenced across
every source file in the repo.

The method is the part worth keeping. A naive "classes not found in source" scan
returned 213 candidates including `.dashboard-notice-danger` and
`.dashboard-action-button-ghost`, which are alive and built at runtime as
`` `dashboard-notice-${tone}` ``. Deleting those would have broken every notice
and button in the app. Counting a class as referenced when any leading stem of it
appears in source dropped 213 to 65, all `fin-*`.

Remaining CSS work is older *live* code, which is far riskier than dead code and
is not worth touching before there are customers.

## Decisions only the founder can make

| Decision | Why blocked | Needed |
|---|---|---|
| Social proof | Inventing testimonials costs local trust | One real depot, first name, shop name |
| Prices | $9/$19 is judgement, not market data | Confirm or replace |
| Contact details | Site shows an email and WhatsApp number | Confirm both are real and monitored |

**Caution on price:** lowering Standard and Pro was a judgement about the Lebanese
market. If wholesalers with real volume would pay more, raising it back is a one-line
change in `PLAN_DEFINITIONS`.

---

## How this work is done

- **Measure, don't assume.** Every real bug this week was found by checking computed
  values in the running app. The sidebar name chip was invisible because a
  `backdrop-filter` on its parent silently became the containing block for its
  `position: fixed` — invisible in source, obvious in measurement.
- **The stylesheet fights back.** `globals.css` holds several complete redesigns
  stacked on each other; a rule that looks like it wins often doesn't. Verify on screen.
- **Nothing invented.** No fake testimonials or customer counts. FAQ answers checked
  against real capabilities — CSV export is on Free, so the page says so.
- **Risky things get shown first.** DB changes are written as reviewable files and
  simulated against real accounts before running.
