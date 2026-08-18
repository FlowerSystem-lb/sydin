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

### 01 — Settings rebuild *(next)*
The look is fixed; the structure is not. ~16 of 30 cards are links to other pages
rather than settings, and the 6 tabs are 10 older panels composed together.
- One renderer per section, no duplication
- Move or remove the pointer-only cards
- One form control style, one column layout

### 02 — Plan features and limits *(needs founder input)*
The machinery already exists: `app/lib/subscription.ts` defines all three plans, and
both the pricing page and the app's feature locks read from it. Adding a feature is a
change in one place. Missing: which features to add, and to which plan.

### 03 — Mobile, designed as an app *(after Settings)*
Founder decision, deliberately not a narrowed desktop layout. Own pass: bottom
navigation with real IA, scan-first entry, thumb-reachable actions, full-height sheets
instead of centred dialogs. See [SYDIN_MOBILE_ROADMAP.md](SYDIN_MOBILE_ROADMAP.md).

### 04 — Proof and launch content *(needs founder input)*
The site has no social proof and none will be invented. One real depot — even a
friend's — with a first name and shop name unlocks the Lebanon launch content.

### 05 — Performance and launch checks *(before launch)*
`globals.css` still carries several stacked redesign passes. Trimming it is the largest
single speed win available, and is safest once the design has stopped moving.

---

## Decisions only the founder can make

| Decision | Why blocked | Needed |
|---|---|---|
| Plan features | Unknown what to sell per tier | A feature + its plan |
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
