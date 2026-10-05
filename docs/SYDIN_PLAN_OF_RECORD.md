# SydIN — Plan of Record

**Last touched:** 5 October 2026 (section R: redesign v2 phase 1 live — fields, font, palette; next: sidebar + top bar)
**Shared view:** https://claude.ai/code/artifact/c7e93db9-8082-47d5-8f06-4ff8b9b8f5c4

> **This is THE plan. One file, one link. It is appended to and ticked off — never
> rebuilt from memory.**
>
> Added 27 Aug 2026 because Sayed said the plan keeps getting messed up after every
> context reset. He is right: it did. Each reset I re-derived it and the numbering
> drifted. The rule now: read this file, edit this file, do not start a new one.
>
> **There is no second plan.** `SYDIN_SESSION_STATE.md` was a rival plan written
> the day before this one and was deleted on 27 Aug — Sayed spotted the duplication
> immediately, which is the whole point. Do not recreate it under any name.
>
> - `SYDIN_ROADMAP.md` — the OLD product roadmap. **Different phase numbers.**
>   Its Phase 5 is Enterprise/RBAC/SSO, not this plan's Phase 5.
> - `SYDIN_SPRINT_LOG.md` — history of what each sprint changed. Append-only.
> - Scope comes from `SydIN_Final_Production_Master_Prompt.pdf` (77 items) plus
>   Sayed's handwritten notes, photographed 27 Aug 2026.

**Live URLs**

- Working site: `sydin-git-main-syd-in-test-s-projects.vercel.app` — always this
  one. The random-hash Vercel URLs are frozen snapshots of old builds, which is
  why the site once looked "still old".
- This plan, shared: https://claude.ai/code/artifact/c7e93db9-8082-47d5-8f06-4ff8b9b8f5c4
- The original production audit, 20 Aug, kept as history:
  https://claude.ai/code/artifact/223456e6-d8a4-46ec-a005-5cd4b4463cde
- Mobile design, 5 screens, mocked but NOT built:
  https://claude.ai/code/artifact/8f42f751-b185-48e1-9397-2c428afbbb93
  Second pass took the landing page's type (Source Serif 4 at 400) and blue
  (#3977ff → #8357ff), dropped the header bar entirely, and made items square
  photos two to a row. Open question recorded for later: photos that size show
  four items per screen instead of seven — browsing rather than scanning, which
  may be the wrong trade for someone standing in a depot.

Buyer: wholesale accessories depots in Lebanon whose daily problem is not knowing
what is still in stock. Every status below reflects what was **verified in the
running application or the live database**, not what the code appears to do.

---

## A. The production mission — where we are

| # | Phase | State |
|---|---|---|
| 1 | Security — headers, dependencies, database grants | done |
| 2 | Design language — one type scale, one surface rule | done |
| 3 | Survive 500 products | photos done · database done · pagination deferred by Sayed |
| 4 | The real 500-product test | blocked on pagination |
| 5 | **Limits and abuse protection** | mostly done — exports hardened, caps already existed; rate limiting needs Supabase settings + Vercel Pro |
| 6 | Mobile — its own app-shaped design | **DONE 20 Sep.** Every phone page is in one app language (Canva templates + the two most-viewed Dribbble inventory apps): header block, pills, contact rows, feeds, action sheets, tabs; installable from the browser (manifest + icons). Scanner untouched by instruction. Section J is the history. |
| 7 | Print, PDF, export, domain, Vercel | **print done 27 Aug**; PDF exporters already substantial (1,441 lines for inventory); domain + Vercel Pro are launch steps |

**Phase 3 numbers, measured:** photos averaged 396 kB with the largest at 1.71 MB,
and the grid served every one at full size. A 500-item screen projected to ~193 MB;
it is now ~6 MB. The 60 security rules that re-checked the signed-in user on every
row now check once per query.

**A correction on the record:** the audit claimed every page load downloads the whole
inventory and called it a mobile-data problem. Measured, 500 products is ~103 kB of
data. That was overstated. Photos were the real cost.

---

## B. Sayed's handwritten notes

### New features — all four now built

| id | What | State |
|---|---|---|
| ~~N1~~ | **Add an item by scanning its barcode.** Scan the printed code on the carton, the app creates the item, then you fill in photo, cost and details. Typing the number by hand must also work. | ✅ built — the scanner is on Add Item |
| ~~N2~~ | **Batch add, POS-style** — several items in one go by barcode. | ✅ built — commit `f8efe46`, on the Import screen |
| ~~N3~~ | **Batch photos** — several photos for several different items at once. | ✅ **built 1 Sep 2026** — Inventory ⋯ → "Add photos in bulk" |
| ~~N4~~ | **Photos joined to the Excel import** — rows 1,2,3,4 matched to photos 1,2,3,4. | ✅ built — commit `1bcc693` |

**Correction, 1 Sep 2026.** This section said "none of this is built yet" while
three of the four were already in the repository and on `main`. That line was
written from memory of the notes, not from the code — exactly the drift this
file exists to stop. Checked against `git log` and the running app before being
rewritten.

N3 and N4 were called one feature, and they are, but they are not one screen:
N4 matches photos to spreadsheet *rows* that do not exist yet, N3 matches them
to *items* that already do. They share the founder's rule — never match by
upload order — and now share nothing else, on purpose:
`matchImportPhotosToRows` and `matchPhotosToItems` are both small and both
readable on their own.

**What N3 does that N4 could not.** N4 matches on SKU alone. N3 matches on SKU,
barcode, item code, or the exact product name, and — the part that decides
whether it gets used — a photo that matches nothing can be assigned to an item
by hand, while looking at it. Photos off a phone are called `IMG_5383.jpg`, and
nobody renames forty of those. A HEIC file (the iPhone default) is refused with
the setting to change rather than a generic "wrong type".

### Inventory and app work

| id | What |
|---|---|
| ~~H1~~ | ✅ **FIXED 27 Aug.** ~~BUG — the Adjust / Quick-view panel opens half off-screen.~~ You must scroll before you can reach "Record Movement". It should fit the screen as it opens and open/close smoothly. **Every page, not just Inventory.** |
| ~~H2~~ | ✅ **FIXED 27 Aug.** ~~BUG — blurring down the left and right edges~~ of the page when that panel opens. |
| ~~A~~ | **Dropped 27 Aug at Sayed's call** ("forget them"). It was already largely moot: the buttons merged into one row on 26 Aug, so a separate in-page header had little left to carry. |
| ~~B~~ | ✅ **DONE 27 Aug.** Row now reads Filters → sort → view → Select items. "Compact" was a display preference wearing a full label next to the real controls; moved into ⋯ as "Hide stats". |
| ~~C~~ | ✅ **DONE 27 Aug — two designs, user-switchable.** "Grid view" is the standard card, tightened. "Photo grid" is the Sortly-style one: the picture fills a square card, name and quantity sit on a scrim, and status, category and actions stay hidden until you point at it. Same component, same DOM — only CSS differs, so they cannot drift apart. Switch lives in the existing View dropdown, not a second header. |
| ~~D~~ | ✅ **DONE 27 Aug.** 11 boxes → rows. Quantity was printed twice (top strip and "Stock & Unit") and is now printed once. "Stock & Unit" and "Supplier" were headings over a single row repeating their own label — both gone. Activity is a list, not three cards, and "N/A to N/A" no longer prints on edits that did not touch quantity. Fits one screen including the Adjust form, which used to sit below the fold. |
| ~~E~~ | ✅ **DONE 27 Aug.** 42 bordered boxes → 24. The two-column layout already existed but was gated above his screen width, and its columns were near-equal so the photo took half the page — now it engages at laptop width with the photo in a rail. `DetailCard` is a row, so one edit fixed 12 call sites. Stock movements are one line (`1 → 2`, then the change) instead of three boxes. Removed: the page describing itself, three sentences explaining what an item code/SKU/barcode is on every item, and the same privacy promise written twice. |
| ~~F~~ | ✅ **DONE 27 Aug.** Ground is white. Item cards gained a hairline border — they had none, and white-on-white with only a shadow dissolves the grid. Scoped to Inventory so you can judge it before the other pages follow. |
| ~~G~~ | ✅ **Already done.** The menu already held Import, Export CSV, Export PDF, Export Excel and import/export history. Verified on screen; nothing to build. |
| ~~S~~ | **Dropped 27 Aug at Sayed's call.** Recorded once, not argued: he had earlier wanted this *first*, and the Dashboard is the first screen a new customer sees. Nothing built since blocks it, so it can come back whenever he wants it. |

### Standing instructions

- **Laptop / tablet / PC only** for now. Phones come last, with their own
  Sortly-style design.
- He will keep adding edits. My job: organise them, be strict, say when something
  is a bad idea.
- He will fetch design references if asked.
- **He likes the Scanner page. Do not redesign it.**

---

## C. My call on his notes, since he asked me to be strict

**H1 and H2 — done 27 Aug, and they turned out to be one bug.** `.ui-overlay` is
`position: fixed; inset: 0`, which should mean the viewport. But an element with a
`backdrop-filter` becomes the containing block for fixed-position descendants, and
`.dashboard-shell`, `.dashboard-main-canvas` and `.inventory-workspace` all set one —
while the dialog rendered inline, inside them. So the overlay was sized to the
content panel: it never reached the sidebar or the right gutter (H2, the edge blur),
and its height maths were measured against a different box than it scrolled in, so a
tall dialog overflowed a centred container and the part above the top could not be
scrolled to (H1, "half hidden"). Fixed with a portal to `document.body`, plus
`margin: auto` / `max-height: 100%` on the dialog. **This is the second time this
containing-block rule has bitten SydIN** — the sidebar name chip vanished for the
same reason. Verified on two pages and at a 560px-tall viewport, where the dialog now
shrinks and scrolls inside itself.

**Next, because it is cheap and he asked:** F, B, G, A as one focused Inventory
sprint. They unblock C, D and E.

**Then S**, the Dashboard summary. He wants it first and it does matter — but it
reads from every other page, so it settles best once those stop moving.

**Push back:** do not treat C, D and E as three redesigns. Card, quick preview and
full page are the same object at three sizes. Designing them together is how they
end up consistent; designing them separately is how SydIN ended up with 23 type
sizes in the first place.

**On the four features:** N1 is valuable and moderate. N2–N4 are a large build and
they speed up *data entry* — they are not launch blockers. Recommend N1 after the
launch-critical work, N2–N4 after launch. A secure, sellable product beats faster
bulk entry for a shop that cannot buy it yet.

---

## D. What the deep read of the PDF found that we have not done

Checked against the live database and repo on 27 Aug 2026, not assumed.

### Storage security — FIXED 27 Aug 2026 (PDF items 28, 29)

`sql/phase-18-product-storage-ownership.sql`, applied and verified.

1. ~~Any signed-in user can write into any other customer's product photos.~~
   **Fixed.** Upload, update and delete on `products` now all check
   `(storage.foldername(name))[1] = auth.uid()`, the same check
   `business-logos` and `po-attachments` already had.
2. ~~No delete rule on `products`.~~ **Fixed** — photos in your own folder can
   now be removed, so deleted items stop accumulating.
3. ~~Size and type limits were browser-side only.~~ **Fixed** — all three buckets
   now carry `file_size_limit` and `allowed_mime_types`, where the browser
   cannot talk its way around them.

**The app had to be fixed first, and this is the part worth remembering.** Four
screens upload product photos and only two used the `<user-id>/` folder. The
Inventory list and the item detail page both wrote
`` `${Date.now()}-${editImage.name}` `` — no folder, and the browser's original
filename kept as-is. Applying the ownership rule while those existed would have
broken editing an item's photo. All four now share
`app/lib/productImage.ts`, which is the one definition of how a product photo is
validated and named. The edit screens had no size or type validation at all
before this.

**Reads stay public, deliberately:** the customer QR page shows a photo to
someone with no account, and older files sit at the bucket root from before the
path helper existed — an ownership check on reads would blank those items.

### Still open in storage

- **Supplier invoices are readable by anyone with the link.** `po-attachments` is
  a public bucket and the app stores `getPublicUrl(...)` straight into the
  database, so closing it means moving to signed URLs — an application change,
  not a policy change. Not bundled into phase 18 rather than left half-done.
  Its size and type limits are in place.

### Not started, and genuinely needed before launch

- ~~**CSV/Excel import limits (36, 37, 38).** No row cap. A large file can create
  unlimited records.~~ **This was wrong.** Checked the code on 27 Aug: the
  import already caps the file at 5 MB, the sheet at 1,000 rows, and each photo
  at 5 MB, and it refuses an import that would push the account past its plan.
  Better still, two database triggers enforce caps where the browser cannot be
  trusted at all — `trg_enforce_plan_item_limit` on `inventory` and
  `pick_lists_enforce_active_limit` — both verified enabled.

- **Spreadsheet formula injection (35, 36) — FIXED 27 Aug.** This was the real
  hole in the exports, and it was in all four of them. A product name beginning
  `=`, `+`, `-` or `@` is executed as a formula by Excel and Google Sheets. It
  is stored harmlessly, exported correctly, and then runs on the machine of
  whoever opens the file — an accountant or a supplier, not the person who typed
  it. `app/lib/exportSafety.ts` now neutralises it for the inventory CSV, the
  pick-list CSV, the reports CSV and the Excel export.

- **Rate limiting (33) and bot protection (34) — cannot honestly be fixed in
  this codebase, and should not be faked.** The browser talks to Supabase
  directly; there is no server of ours in between except three admin routes. A
  limit written in the app would run in the browser, on the attacker's own
  machine, and could be removed with the developer console. The three places
  that can actually enforce it:
  1. **Supabase Auth rate limits** — built in, set in the dashboard. Covers
     sign-in, sign-up, password reset and email sends. **Sayed's to set.**
  2. **Vercel WAF and bot protection** — needs Pro, so this lands with the
     launch upgrade rather than now.
  3. **Database triggers** — already doing the heavy lifting, above.
- **Backups and recovery (46).** Not reviewed. The PDF is blunt about not launching
  a SaaS without one.
- **Load testing (50)** and the **500-product test (30)**.
- ~~**Print, PDF and export redesign (57, 58, 59)** — untouched.~~ **Print done
  27 Aug.** The only `@media print` rules in the file had been for QR labels, so
  every other page printed the running application — and Pick Lists has a "Print
  Pick Sheet" button wired straight to `window.print()`. There is now a real
  print stylesheet plus a print-only document header (business name, date,
  branding) in the shell. The PDF exporters were already substantial and are not
  the weak point. **Item 59 checked and fixed 27 Aug:** the PDF export already
  asked (selected / filtered / all), but CSV and Excel defaulted to every row in
  the account while the grid showed the filtered set — filter to 4 low-stock
  items, click Export CSV, get all 10. Both now default to what is on screen and
  the menu says so: "Export CSV (4 filtered)".
- **Domain (53)** and **central business contact (54)**.
- **Accessibility audit (23)**.

### A miss of mine worth naming

**PDF item 14 asks for a density control inside Inventory** — 75/85/100/115/125%
changing card size, columns, image size and spacing, remembered between visits.
What I built was a site-wide font scale. Sayed asked for "the whole website
smaller", so his request was answered — but the PDF asked for something better
scoped and I did not connect the two. Worth revisiting in the Inventory sprint.

---

## E. Vercel — the answer

**Yes, upgrade — but at launch, not today.**

- Vercel's Hobby plan is **not licensed for commercial use**. Once SydIN has a
  paying customer or trades as a company, Hobby is wrong for legal reasons before
  performance ones. Pro is about **$20 per member per month**.
- Pro also unlocks the **WAF and bot protection** the PDF asks for in item 34, and
  raises the image-optimisation allowance the Phase 3 photo work now leans on.
- No reason to pay during development. **Upgrade when the real domain goes on, or
  at the first paying customer — whichever comes first.**
- The PDF's own warning applies: paying for Pro does not make the architecture
  correct. It is a launch step, not a fix.

Supabase Pro is a separate question, triggered by backups/PITR (item 46) rather
than speed. Revisit at the same time.

---

## F. Recommended order from here

1. **Storage security** — the cross-tenant upload hole, a delete rule, bucket size
   and type limits. Small, contained, and it is a real hole.
2. ~~**H1 + H2**~~ — done 27 Aug. One containing-block trap caused both; fixed
   at the shared overlay, so all 12 dialog screens got it at once.
3. ~~**Inventory sprint**~~ — B, C, D, E, F and G done 27 Aug. A and S dropped
   at Sayed's call. The density control from PDF item 14 is the one piece of
   this group still worth doing, and it is not urgent.
4. ~~Dashboard summary (S)~~ — dropped at Sayed's call.
5. **Limits and abuse** — rate limiting, import caps, server-side upload caps.
6. **Pagination**, then the real 500-product test.
7. ~~**Print / PDF / export**~~ — done 27 Aug. Print stylesheet, and CSV/Excel now follow the on-screen filters.
8. **Domain, Vercel Pro, backups, final QA.**
9. ~~**Mobile**~~ — done 20 Sep; every phone page rebuilt in the app language (sprint log, 20 Sep). Sayed's walkthrough on a real phone is what is left.
10. **N1**, then N2–N4 after launch.

---

## G. Decisions only Sayed can make

| Decision | Why blocked | Needed |
|---|---|---|
| Social proof | Inventing testimonials costs local trust | One real depot, first name, shop name |
| Prices | $9/$19 is judgement, not market data | Confirm or replace |
| Contact details | Site shows an email and WhatsApp number | Confirm both are real and monitored |
| Leaked-password protection | Supabase setting, not code | One checkbox in Authentication |
| Google / Microsoft sign-in | Testing means signing in as him | Test on the live site |
| QR page logo | Broken locally by a certificate quirk on his machine | Confirm it loads in production |
| Dashboard text size | My dev session expired before I could check | Look at Inventory and Stock Movements |

**Caution on price:** lowering Standard and Pro was a judgement about the Lebanese
market. If wholesalers with real volume would pay more, raising it back is a
one-line change in `PLAN_DEFINITIONS`.

---

## H. Earlier work, done and verified

**Design system** — the Refero/Steep reference adapted to SydIN. SydIN's blue
replaces the reference's peach so the brand stays recognisable. Sign-in keeps its
blue animated panel per the founder's instruction.
See `SYDIN_PHASE5_VISUAL_REFERENCE.md`.

**Landing page** — rewritten for one buyer. The headline names the problem rather
than the product. Six-question FAQ, each answer checked against real app behaviour.

**Plan limits enforced in the database** — `sql/phase-14-plan-item-limit.sql`. Caps
were browser-only and therefore unenforceable. Simulated against all 8 accounts
before running; none blocked. BEFORE INSERT only, so over-cap accounts never freeze.

**Notification Center table** — `sql/phase-13-notifications.sql` with its four RLS
policies.

**Pricing** — Standard $19 to $9, Pro $29 to $19, yearly default at ten months'
price. The real competitor is a notebook and Excel, which cost nothing; twenty
active depots matter more in year one than the revenue difference.

**Settings rebuild** *(half done)* — one form and one save bar per editable tab.
13 of 30 cards are still pointers to other pages rather than settings; deciding
what each becomes is a product call, worth doing deliberately.

**Plan features and limits** *(done)* — no operational module had been gated at all.
Buying (purchase orders, receiving) now starts at Standard and is enforced in the
app. Stock Movements and Activity stay free deliberately: read-only history is part
of the Free promise.

**Performance** *(started)* — removed the `fin-*` system, 118 rules and ~870 lines,
proven unreferenced. A naive scan had returned 213 candidates including classes
built at runtime as template strings; deleting those would have broken every notice
and button in the app.

---

## I. How this work is done

- **Measure, do not assume.** Every real bug has been found by checking computed
  values in the running app, not by reading code.
- **Read the database back after a migration.** Three migrations in a row succeeded
  without doing what was intended: phase-15 revoked from named roles while PUBLIC
  held the grant; phase-17 compared deparsed SQL case-sensitively and wrapped the
  same expression four times. A clean run proves nothing.
- **The stylesheet fights back.** `globals.css` holds several complete redesigns
  stacked on each other; a rule that looks like it wins often does not.
- **Nothing invented.** No fake testimonials or customer counts.
- **Risky things get shown first.** Database changes are written as reviewable files
  and simulated against real accounts before running.
- **Do not scale the site with CSS `zoom`.** Tried and reverted 26 Aug — four
  layout bugs, none measurable, because zoom makes fixed and in-flow elements report
  coordinates in different systems. The scale now comes from the root font size.

---

## J. Mobile — the plan, read off the canvas

**Added 2 Sep 2026**, on Sayed's instruction to start mobile and to take the plan
from the design canvas rather than from memory. Every number below was extracted
from the artboard sources inside
https://claude.ai/code/artifact/8f42f751-b185-48e1-9397-2c428afbbb93 — five
`.dc.html` files plus `canvas.json` — not re-derived.

### What the canvas actually specifies

Five artboards, each 390 x 844 (iPhone 14/15 logical size), laid out left to
right: **Home · Items · Scan · Item detail · More**.

The brief written on the canvas, in full:

> Landing page type: Source Serif 4 at weight 400 for every heading, Inter for
> the rest. Landing blue: the #3977ff -> #8357ff gradient, used for the one
> action per screen. No header bar — the title just sits in white space. Items
> are square photos first, facts underneath. Status is a coloured dot, not a
> pill: less furniture, same meaning.

Design tokens, taken from the artboard CSS:

| Token | Value |
|---|---|
| Heading face | `Source Serif 4`, weight 400, `letter-spacing: -0.03em`, `line-height: 1.05` |
| Body face | Inter, 400/500/600 |
| Ink | `#0b1220` primary, `#64748b` muted, `#94a3b8` eyebrow |
| Accent | `#3977ff` link/active · gradient `#3977ff → #8357ff 65% → #d64bff` |
| Status dots | 7px circle — red `#ef4444` out, amber `#f0a133` low, green in stock |
| Row | min-height 60px, 13px vertical padding, 1px `rgba(15,23,42,0.08)` divider, last row none |
| Thumb | 52px, `border-radius: 11px`, gradient plate `#eef3fb → #dfe8f6` behind a box glyph |
| Screen padding | 22px horizontal; the title block is 34px top, 20px bottom |
| Eyebrow | 11px, weight 500, `letter-spacing: .1em`, uppercase, `#94a3b8` |

**Tab bar** — five columns, 10px top padding, 26px bottom (home indicator), 1px
top divider. Four flat 22px icons at `#94a3b8`, the active one `#3977ff`, labels
11px weight 500. The middle tab is a 56px gradient circle pulled up 26px out of
the bar with a `0 10px 24px rgba(57,119,255,.34)` shadow. Tabs, in order:
**Home · Items · Scan · Activity · More**.

### Screen by screen, from the artboards

- **Home** — serif "Today" at 34px over the date. Two figures side by side: the
  count needing attention at 40px with the gradient clipped to the text, and
  units in stock at 40px in plain ink with tabular numerals. Then "Running low"
  (serif, 21px) with a "See all" link, and the low rows: thumb, name, reason
  ("Out of stock · 3 days", "Below 2"), quantity, status dot.
- **Items** — serif title, one search field reading "Search or scan", filter
  chips All / Low / Out / No photo, then items as **square photos two per row**
  with the name and quantity underneath.
- **Scan** — the camera fills the screen under "Point at the barcode on the
  carton". Three actions: Find, Stock in, Stock out. A result card shows the
  item, its barcode and its quantity.
- **Item detail** — name, then `FP013 · 5283001502369` as one line, the quantity
  as the largest thing on the screen ("1 piece in stock"), "Alerts below 2", then
  Category / Depot / Unit as plain rows, and one gradient action: **Adjust stock**.
- **More** — avatar, name, plan line ("Free plan · 10 of 50 items") and Upgrade.
  Then grouped links: *Buying* (Purchase orders — 3 open, Receiving, Suppliers),
  *Stock* (Stock counts, Pick lists — 1 active, Depots), *Workspace* (Reports,
  Settings).

### A second open question, found while building

The canvas's Home leads with **two** figures — the count needing attention, and
units in stock. Overview shows **four**, two across: total items, depots, total
quantity, inventory value.

That is why the canvas can use 40px and we cannot quite: at 375px each of our
figures gets a 160px cell, and `$1,712,130` needs 181px at that size. Long values
now drop to 28px so nothing is clipped, which works but is a patch over the real
question: **should phone Overview drop to the canvas's two figures?**

Arguments for two: the phone screen gets a real focal point, 40px throughout, and
the two numbers a depot owner actually opens the app for. Against: depots and
inventory value disappear from the phone entirely, and inventory value is the one
figure that makes the business feel measured.

Not decided. It is a content decision, so it is Sayed's.

### ~~The open question the canvas records~~ — SETTLED 2 Sep 2026

Square photos two to a row show four items per screen where the list shows
seven. Browsing versus scanning.

**Sayed's call, after holding the Replit build on a real phone: "two great cause
it is phone."** Photos win. The reasoning that decided it: a phone is the thing
you hold up next to the carton, so matching a picture to what is in your hand
beats reading a name. Seven-per-screen is a laptop argument.

Built the same day. A phone now opens Inventory in the photo grid, two to a row;
the list is still one tap away in the View menu. Two rules in `globals.css` had
already argued about this column count and both lost to a third that forces a
single column — the override is scoped to the photo grid only, since the normal
grid card carries detail text and wants the width.

### What already exists in the app, measured 2 Sep 2026

Mobile is further along than "not started":

- `app/mobile.css` — 340 lines, imported globally in `app/layout.tsx`, scoped to
  `max-width: 767px`.
- A working five-tab bottom bar is already rendered on every dashboard page, in
  the right order, with the raised gradient Scan button. It is close to the
  canvas already.
- `.mobile-shell`, `.mobile-shell-content`, `.mobile-shell-nav`,
  `.mobile-dashboard*` classes exist and are wired.

So the work is **not** "build a mobile app". It is: the screens inside that shell
are still the desktop workspace, shrunk. The canvas is a different information
design, not a different width.

### Order of work

1. ~~**The phone gutter**~~ — done 2 Sep, commit `64dabd4`. Every page sat flush
   against the left edge.
2. **Home** — the one screen where the canvas and the current page differ most,
   and the first thing anyone opens. Serif title, two figures, low-stock rows.
3. **Items** — the square-photo grid, behind the open question above.
4. ~~**Item detail**~~ — done 12 Sep (`0f8c81e`): the empty photo block no
   longer shows, the quantity is 40px serif with the threshold as a line under
   it, facts and Adjust stock fit above the fold. Photo items keep a shorter
   frame. Home also got size tiers so a long currency total never breaks
   mid-number (`d13d7a7`).
5. **More** — the grouped menu.
6. **Scan** — last on purpose. Sayed likes the Scanner page and it is not to be
   redesigned; the canvas screen mostly matches what is there.

### The build document

**[docs/SYDIN_MOBILE_DESIGN_SPEC.md](SYDIN_MOBILE_DESIGN_SPEC.md), written 2 Sep 2026.**
Every colour, type size, row height, radius, animation and screen, written out
precisely enough to rebuild the design on SydIN's own pages without opening the
prototype again. It also records the prototype's four faults, so they are not
copied, and the decisions already settled.

Read that before building any phone screen. This section is the order of work;
that file is what the work has to match.

### Rules for this work

- The canvas is the specification. Where this document and the artboards
  disagree, the artboards win, and this document gets corrected.
- **Do not touch the Scanner's behaviour.** Standing instruction.
- Phone styling belongs in `app/mobile.css` behind its existing media query, not
  in `globals.css`, which already carries several stacked redesigns.
- The desktop layout must not move. Every mobile change is verified at 375px
  *and* checked at 1280px before it is called done.

---

## K. Sales & Invoices — BUILT 4 September 2026

Sayed asked for "a full system sales and invoices like POS, manage sales and
money". He chose **invoices first** over a till, **repeat customers** (so a
Customers list), and **keep Receiving but rename it**.

The finding that shaped it: **SydIN already had the sell side and no idea about
money.** Pick Lists carried a `customer_name` and deducted stock on completion.
What was missing was price, total, payment and a document. Meanwhile the BUY
side was fully built. So this was not a POS from scratch — it was mirroring a
proven pattern onto the other side of the business.

| Step | What | Migration |
|---|---|---|
| 1 | `customers`, mirroring `suppliers`. Limits 3/25/100. | `phase-19` |
| 2 | `sales_orders` + `sales_order_lines`. Draft, prices, totals, snapshots. | `phase-20` |
| 3 | **Issuing** takes stock out, atomically, in one database function. | `phase-21` |
| 4 | `sales_order_payments`. Paid/part-paid derived by trigger. | `phase-22` |
| 5 | Invoice PDF. | — |

**Rules that live in the database, not the screens:** cannot sell more than is
in stock · cannot issue twice · whole quantities only for stock · a charge line
never moves stock · no payment against a draft or a cancelled invoice · the
lifecycle follows the money (issued → paid → back to issued if a payment is
removed).

**Verified by trying to break it**, not by reading: every constraint was tested
by attempting to violate it, and each migration was read back from the database
rather than trusted from its own success report (the phase-15/17 lesson). All
test rows were removed and stock restored from the movements' own before-values.

**Not built, on purpose:** a POS till screen. It becomes worthwhile once
invoices are proven in real use, and it should then CREATE an invoice rather
than live beside one.

---

## L. Navigation — regrouped 4 September 2026

Sortly's Workflows page as reference (structure, not visual copy).

  Workspace   Overview · Inventory · Scanner · Workflows · Alerts
  Records     Customers · Suppliers · Depots · Categories
  Reports     Reports
  System      QR Center · Import & Export · Settings · Help

Seven groups became four. `/dashboard/workflows` holds the five things that are
the same KIND of thing — a process ending in a quantity changing: Sales,
Purchase Orders, Stock In, Pick Lists, Stock Counts. Locked cards stay visible
with a padlock, because a feature that vanishes cannot be discovered.

Activity and Stock Movements left the sidebar; both are histories and Reports
was already a directory of histories. Alerts moved INTO Workspace — a list you
act on, not one you read.

**The bug this uncovered, and it was the worst of the night.** The phone had its
own navigation hardcoded in `components/mobile/MobileShell.tsx`, with no
connection to `navigation.ts`. The sidebar carried fourteen destinations; the
phone offered nine. **Customers, Suppliers, Sales, Purchase Orders, Workflows,
Depots, Categories, Import & Export and Help had no route on a phone at all.**
Nothing was broken — the pages simply could not be reached, and nothing linked
the two lists so that anyone would notice. Both now derive from `navigation.ts`.

**Rule for anyone adding a page:** add it to `navigation.ts` and it appears in
both places. Never hardcode a nav list again.

---

## N. Product-level redesign — 12 September 2026

The full 64-point prompt, with a status per point, is kept in
[SYDIN_PRODUCT_REDESIGN_BRIEF.md](SYDIN_PRODUCT_REDESIGN_BRIEF.md). This section
is the narrative of what changed; the brief is the checklist.

Sayed's "complete product redesign" prompt (sidebar by workflow, receiving as a
first-class workflow, documents that carry the company, payments visible,
help that teaches). Done incrementally, one surface per commit, verified in
the running app, all pushed. What changed:

- **Sidebar by what the business is doing.** Daily work · Buying (Purchase
  Orders, Stock In, Suppliers) · Selling (Sales, Pick Lists, Customers) ·
  Stock control (Stock Counts, Stock Movements, Depots, Categories) · Insight
  (Reports) · Settings & help. Section L's "Workflows" door is no longer the
  only way in; the route still exists. Stock In takes the phone bar slot.
- **Partial receiving** (`sql/phase-23-partial-receiving.sql`, **needs Sayed
  to run it**): Ordered → Partially received → Received; a receipt row per
  delivery; received quantity per line; close-short when a supplier never
  sends the rest. New POs save as Ordered (drafts on request). Stock In shows
  "Deliveries expected" linking into the order's receiving dialog.
- **Company profile & documents** (`sql/phase-24-company-profile.sql`, **needs
  Sayed to run it**): address, tax number, payment terms, footer line;
  currency editable. `app/lib/documentPdf.ts` is the shared page furniture
  (logo header, From block, thumbnails, repeated table head, footer with page
  numbers); invoice and PO PDFs use it; `documentDocx.ts` writes the Word
  twins. All rendered in Node with realistic data and read page by page.
- **Overview** has a money row (sold this month, customers owe you, you owe
  suppliers, deliveries expected) and an Action required list.
- **Customer and supplier account drawers** with balances and every document.
- **Help Center** rebuilt as searchable step-by-step articles; `HelpLink`
  "what is this?" on receiving, Stock In and invoice payments.
- **Global search** finds invoices, purchase orders and customers.
- **Reports** gains four money reports (PDF + CSV).
- Fixed on the way: the sidebar could not be re-expanded once collapsed; the
  New PO save bar was cut off; the top bar wrapped beside an expanded sidebar.

**Not done, deliberately:** quotes, customer statements as documents, receipt
documents, a report builder, tax/discount lines on invoices, team roles. Each
is a schema change or a new module and should be its own sprint with Sayed's
go-ahead. Known local-only issue: the dev machine's Next image optimizer
returns 500 for Supabase-hosted images; production (Vercel) serves them.

---

## O. Visual redesign — 16–20 September 2026

Sayed: "STOP PATCHING THE CURRENT UI. FULL VISUAL REDESIGN REQUIRED" (51
sections, 16 Sep), then a reference image (grayscale agency dashboard) with
"same image, same graph details". Done as three passes, every step
screenshotted, all on `main`. The sprint log has the detail per commit.

- **Foundation, declared once** at the end of `globals.css`: neutral surfaces
  (#fafafa page, white cards), ink text scale, hairline borders, 8/12/16px
  radii, two-layer soft shadows, 36px controls. The blue washes are gone;
  blue is the one accent ("jewelry"). Every old cyan token remapped.
- **One button system** (primary blue, secondary white hairline, ghost,
  restrained danger, icon) — no pills, no gradients. Inputs: hairline, blue
  focus ring, disabled state. Section eyebrows muted app-wide.
- **Sidebar** as the reference: grey ground, white lifted active card, 30px
  rows, grouped with dividers; collapse toggle fixed at the root and verified
  with real clicks. **Header** quiet and white.
- **Overview** around the owner's questions: compact KPI tiles with a real
  "vs last month"; Needs attention as an action centre with inline Restock;
  Recent activity as a stock feed with deltas and references; and the
  reference's graphs — Sales trend (pixel bars on a dotted grid, Paid / Still
  owed, Weekly / Monthly / Yearly) beside a thin-bar Purchases panel. Figures
  in mono. 1520px ceiling on big monitors.
- **Landing, sign-in, session gate, Help, Settings, empty states, tables**
  (Stock Movements and Sales as real tables) all brought onto the system.
  Item panel gained a stock-level step chart.
- **Breakpoints** 375 / 768 / 1024 / 1280 / 1440 / 1920 measured; the 1024
  laptop got its own Inventory header layout.
- **Found and fixed on the way:** Help could not scroll; photos never
  compressed on upload (now 1600px / ~8× smaller); mobile alert badge counted
  100 rows; 39 form labels not wired to their fields; sub-24px targets.
- **500-product test** run on the production build with the list request
  intercepted in the browser: no long tasks, every action under 50ms.

**Not from the reference, on purpose:** its "AI insight" bar and "Export
CSV" header button. **Still Sayed's:** a personal walkthrough on his laptop
and phone — the one QA that cannot be automated.

---

## P. Settings rebuild and team access — 26–28 September 2026

Section N listed team roles as "not done, deliberately". They are now built, at
Sayed's "go team access", after he compared SydIN with Sortly's User Access
Control. The sprint and decision logs have the detail.

- **Settings rebuilt** from his Figma Make design:
  - the menu is grouped into Business, Workspace and Account, and folds to icons
  - rows have the label on the left
  - the save bar appears only when something has changed
  - Account lists the ways you can sign in
- **Team access** (`sql/phase-28-team-access.sql`): a business is its owner's user
  id.
  - Roles: Owner, Admin, Staff and View only.
  - Every security rule (RLS), storage rule and database function is scoped to the
    business.
  - Seats: Free 1, Standard 3, Pro 10.
  - Tested before it went live, with pretend users in a transaction that throws
    everything away.
- **Two ways to add someone** (Settings > Team):
  - *Create a login*: name and role give `name.role@business.sydin.site` plus a
    password like `Cedar-4827-Mint`, with a message to copy that has the steps.
    Reset password and remove go through the owner.
  - *Invite by email*: they sign up with that email and press Join on a banner.
- **Role-aware app:**
  - Staff and View only see only Account in Settings.
  - Delete buttons are hidden for them (the database refuses those deletes
    silently).
  - View only members see a "View only" label instead of Add.
- **"Done by"** (`sql/phase-29-done-by.sql`): Activity, Stock movements, item
  history, invoices, purchase orders, deliveries and payments show "by <name>" when
  the business has 2+ people.
- **Process change:** SQL is again pasted by Sayed in the SQL Editor. Claude's tools
  block it from applying security changes itself. Claude writes the file and a test
  script that throws everything away, then checks the live database read-only
  afterwards.
- **Customers never get logins.** A private "your invoices" link is a later sprint.

---

## M. What is left

0. ~~Run two SQL files in Supabase~~ **Done 12 Sep 2026** — phases 23 and 24
   were applied to the live project through the Supabase connector (recorded
   as migrations `phase_23_partial_receiving` and `phase_24_company_profile`),
   then partial receiving was tested end to end on the live database (order
   for 4, received 3 then 1; stock, receipt and movement all correct) and the
   test rows removed. From now on SQL phases are applied the same way, not
   pasted by Sayed.

1. ~~**Plan gating for Sales**~~ **Done 20 Sep.** The capability existed but
   only the Workflows hub honoured it — the Sales list and New invoice pages
   let a Free account straight in. Both gate now exactly like Purchase Orders
   (padlock after the plan loads, so a paying account never sees it flash).
   Proven by making the browser read the plan as Free for one page load
   (response patched in the browser, nothing written): "Current: Free ·
   Required: Standard", Request Standard → the request-plan page.
2. **Mobile screens** — section J's order still stands: Home, Items, Item, More.
   Scan last, and the Scanner is not to be redesigned.
3. ~~**Pagination**~~ — done 13 Sep as windowing (60 at a time, "Show 60
   more"). ~~500-product test~~ **Done 20 Sep** on the production build, list
   request intercepted in the browser, nothing written: no long tasks, every
   "Show more" under 50ms, search 32–41ms.
4. **Limits and abuse** — rate limiting needs Supabase settings + Vercel Pro.
5. ~~`po-attachments` is public-read~~ **Done 12 Sep 2026** — bucket private,
   owner-only read policy, the app opens attachments through one-hour signed
   URLs (`sql/phase-26-private-po-attachments.sql`, applied live).
6. **Still needs Sayed:** leaked-password checkbox in Supabase · ~~test Google
   sign-in~~ (28 Sep: works on www.sydin.site after he added it to Supabase's
   redirect list) · test Microsoft sign-in · confirm prices, contact email and
   WhatsApp are real.
7. **Team follow-ups** (section P):
   - customer "your invoices" link
   - per-location permissions
   - an audit-log page
   - revoke `team_seat_limit` from signed-in users (it only reveals a seat count)

---

## Q. Field Operations (Jobs & Crews) — PLANNED 1 October 2026, approved by Sayed

Brief: [SYDIN_FIELD_OPS_BRIEF.md](SYDIN_FIELD_OPS_BRIEF.md). Status: **Phase 1 not started.** Build it in a fresh session.


### Context
Sayed brought `SYDIN-FIELD-OPS-MODULE-BRIEF.md`. It describes a scheduling layer covering projects, sites, jobs, crews, vehicles, timesheets and Arabic PDFs. The layer connects back to inventory ("stock that knows which job it is standing in"). The brief's examples (setup, strike, events, trucks) match Flower Plus's own event work, so **the first tenant is Sayed's own business**. That is the best possible test user.

The brief is roughly 5 phases, each about the size of Sales & Invoices. This plan builds **Phase 1 only**. Each later phase is approved on its own, in a fresh session, to keep the cost down.

### Where the brief conflicts with SydIN as built, and how I'd deviate
| Brief says | SydIN reality | Decision |
|---|---|---|
| shadcn/ui, Zustand, Framer Motion | None of these are used. SydIN has its own `components/ui`, `components/dashboard/Workspace.tsx` primitives, Tailwind v4 and globals.css | Reuse SydIN primitives. Add no new UI libraries. |
| Route `/ops` | All app pages live under `/dashboard/*` in `DashboardShell` | `/dashboard/jobs/*`, with a new "Jobs" nav group in `components/dashboard/navigation.ts` |
| "Tenant" | The business is the owner's user id: `current_business_id()`, with RLS on `user_id` (phase 28) | New tables get `user_id` plus the same policies as `customers`/`sales_orders` |
| Roles Manager/Supervisor/Crew/Driver | Login roles are Owner/Admin/Staff/Viewer (`business_members`) | Logins keep their roles. **Workers are records, not logins.** Crew and drivers get a private link (Phase 2), so there are no fake accounts. `ops_workers.role` = supervisor/crew/driver is just a label. |
| Client entity | A `customers` table already exists (phase 19) | Projects point to `customers.id`. No second client table. |
| Separate audit ledger forbidden | `stock_movements` plus `inventory_history` is the ledger | Phase 4 adds `ops_job_id` to `stock_movements`, plus movement types job_out/job_return. |
| Arabic everywhere, server PDFs via headless Chrome | The app has no i18n today. PDFs use jspdf, which mangles Arabic. | Arabic is scoped to the module (worker view and printouts) first. PDFs become **print-ready HTML pages** that the browser prints to PDF. Arabic shaping is then perfect, with no Chrome-on-Vercel cost. Stored server PDFs come later only if really needed. |
| Drag-and-drop board | Nothing in SydIN uses drag and drop | Phase 1 uses click-to-edit (open a card, change the day, crew or truck). Drag comes later. Fewer bugs, and it works on a phone. |

### Phase 1: what ships (manager only, English UI with Arabic-ready fields)

### Database: `sql/phase-36-field-ops.sql` + `-TEST.sql` (Sayed pastes; I verify read-only)
- **`ops_workers`**
  - Columns: `id, user_id, name_en, name_ar, role (supervisor|crew|driver), phone, hourly_rate, active, created_at`
- **`ops_vehicles`**
  - Columns: `id, user_id, name, kind (truck|van|car), capacity_note, default_driver_id, active`
- **`ops_job_types`**
  - Columns: `id, user_id, key, label_en, label_ar, color, sort_order`
  - This is the tenant-editable "enum". Defaults are seeded on first open: prep, setup, install, delivery, pickup, strike, cleaning.
- **`ops_projects`**
  - Columns: `id, user_id, code (auto #1001…), customer_id → customers, title, start_date, end_date, status (draft|confirmed|in_progress|done|cancelled), value, notes`
- **`ops_sites`**
  - Columns: `id, user_id, customer_id nullable, name_en, name_ar, address, maps_url, contact_name, contact_phone, spec jsonb default '{}'`
  - Sites are **reusable per customer**, not per project, so the same venue is never retyped.
  - Linked to projects through **`ops_project_sites (project_id, site_id, sort_order, roles text[])`**. This covers "one place, two roles".
- **`ops_jobs`**
  - Columns: `id, user_id, project_id nullable, site_id nullable, job_type_id, date, start_time, end_time nullable, supervisor_id, helper_count int default 0, vehicle_id nullable, status (planned|done|cancelled), notes, actor_id default auth.uid()`
  - A null `project_id` means the Depot/Workshop row.
- **`ops_job_crew (job_id, worker_id)`**
  - A join table, not an array, so crew conflicts are one indexed query.
- **`ops_job_steps`**
  - Columns: `id, job_id, position, time nullable, text_en, text_ar, done_at`
- **`ops_job_changes`**
  - Columns: `id, user_id, job_id, actor_id, field, old_value, new_value, created_at`
  - Filled by an AFTER UPDATE trigger on `ops_jobs` and `ops_job_crew`. This is the "Changes this week" feed, and nobody types into it.
- **Security**
  - RLS copied from the phase 28 pattern: select for any role, insert/update with `can_write()`, delete with `can_delete()`.
  - Child tables check the parent through EXISTS.
  - `search_path` pinned. No public execute.
- **Feature flag:** `business_settings.ops_enabled boolean default false`, switched on in Settings > General.
  - Plan gate is **Pro**, reusing the capability gating in `app/lib/subscription.ts` exactly like Purchase Orders and Sales. Flower Plus is already on a paid plan.

### Conflict check (the key feature)
- **Rule:** two jobs on the same date whose time ranges overlap conflict when they share:
  - a worker (supervisor or crew),
  - or a vehicle.
- **Missing end time:** it counts as "until end of day", so a job with no end time is never silently safe.
- **Write path (source of truth):** an RPC `ops_save_job(payload)` (SECURITY DEFINER, business-scoped) does two things in one transaction:
  - saves the job, crew and steps;
  - returns `conflicts[]` (`worker|vehicle`, name, other job id and time), using `tsrange(date+start, date+coalesce(end,'23:59'))` overlap `&&` on indexed `(user_id, date)`.
- **Warn, don't block:** a manager sometimes double-books on purpose, for example a truck doing two short drops. The save succeeds and the dialog shows the warning.
- **Read path:** a view `ops_conflicts` (security_invoker) supplies the board's red flags. Anything written by any path, including a future API, shows up.
- **Client:** the week board already has every job for the week loaded, so a pure function `findConflicts(jobs)` in `app/lib/opsConflicts.ts` gives instant feedback while editing. It uses the same rule, and the server result wins on save.

### Screens (`app/dashboard/jobs/…`, built with Workspace.tsx primitives)
1. **Week board** `/dashboard/jobs`, the main screen
   - Layout (the §4.1 layout):
     - rows are the pinned Depot row plus each active project;
     - columns are 7 days, with the week arrows;
     - a job card shows the type colour, time, site, "Lead +2 · Truck 1", and ⚠.
   - A conflict bar under the board ("Truck 3 double-booked 11:00 and 12:00 · Resolve") opens the job.
   - **Mobile:** the same data as a day list (one day at a time, with a swipe/arrow day picker). A 7-column grid on a phone is unusable.
2. **Job dialog.** This is not a separate page in Phase 1 (fewer screens, faster).
   - Fields: type, date, time, project, site, supervisor, crew (multi-pick), helpers (a number stepper), vehicle, and ordered steps (the §4.3 movement plan, add/reorder), plus notes.
   - The conflict warning shows inline as you pick.
3. **Project page** `/dashboard/jobs/projects/[id]`, the §4.2 layout.
   - Header: code, customer, dates, status menu.
   - Sites as tabs; each tab shows maps link, contact and the jobs at that site.
   - Brief/spec and photos wait for Phase 5.
4. **Workers & vehicles**: two simple list tabs at `/dashboard/jobs/team` with add/edit dialogs.
5. **Changes this week**: a side panel on the week board, fed by `ops_job_changes`.

### Arabic/RTL groundwork, laid in Phase 1 so it is never retrofitted
- Every name and step has `_en`/`_ar` columns. The job dialog shows an optional "Arabic" field next to English.
- All new CSS uses logical properties only: `ms-/me-/ps-/pe-`, `text-start`, `border-inline-start`, inset-inline. A grep check in the sprint-done step: **zero `left`/`right`/`ml-`/`mr-`/`text-left` in the new files.**
- Times, codes, phones and plates are wrapped in `<bdi>` through one tiny `<Ltr>` helper.
- Real Arabic test data (Flower Plus workers and venues) is used from day one, not lorem ipsum.

### Later phases (each approved separately)
2. **Field:** a private link per worker (`/w/<token>`, served by a token-checked RPC that returns only that worker's jobs today and tomorrow).
   - AR/EN switch with `dir` on the page. Noto Naskh Arabic via next/font, line-height 1.7, no letter-spacing.
   - Mark done, add a progress photo.
   - In-app and batched email notifications using the existing Resend setup (`app/lib/billingEmails.ts` pattern).
   - WhatsApp: a "Send to WhatsApp" button that opens wa.me with the job text. Free, and it matches how the teams talk. The WhatsApp API waits.
3. **Paper parity:** timesheet and transport tables (hours and cost computed), plus print pages in the house style.
   - The house style uses the logo, accent colour and company block already in `business_settings`.
   - Arabic and English, verified by printing real Arabic before calling it done.
4. **Inventory link:** a job checks items out and back in.
   - Every movement goes through `stock_movements` with `ops_job_id`, so it shows in the existing Stock movements and item history.
   - Damaged items are logged.
   - **Availability** for a date is on hand minus quantities on jobs whose date range covers it and which aren't returned yet.
   - Could reuse the pick-list flow (`complete_pick_list`) as the checkout UI.
5. **Briefs and photos:** per-site spec fields (`ops_sites.spec` jsonb plus a per-business field list in `business_settings`) and galleries in the existing private storage pattern.

### Defaults for the brief's open questions (my calls, changeable later)
- Cost: a flat hourly rate per worker.
- Vehicles: owned.
- Helpers: headcount only.
- Clients and sites: reusable records.
- Currency: the business's existing currency setting.
- No client portal.

### Verification (Phase 1)
- **TEST SQL** runs in a rolled-back transaction with pretend users:
  - the owner sees and edits;
  - Staff can add but can't delete;
  - View only can't add;
  - a stranger sees nothing;
  - the `ops_save_job` conflict result is correct for worker overlap, vehicle overlap, no end time, and back-to-back (11:00–12:00 and 12:00–13:00 = **no** conflict).
- `get_advisors` security check: no new warnings.
- A unit-style check of `findConflicts` against the same cases, run with node in the scratchpad.
- **Browser (preview, sydin-dev):**
  - create 2 workers, 1 truck, 1 project with 2 sites, and 3 jobs, one deliberately double-booking the truck;
  - the ⚠ appears on the board and in the conflict bar;
  - edit the time and the ⚠ clears;
  - "Changes this week" lists the edit;
  - check the mobile day list at 375px.
  - **Delete every test row the same turn** (dev writes to live data).
- `npm run lint`, `npx tsc --noEmit`, `npm run build`. Commit and push. Update the plan of record (new section Q), the sprint log and the decision log (the deviations table above).

### Size and cost honesty
Phase 1 is about 1 large SQL file, 3 pages, 1 dialog and 2 lib files, the size of the Sales & Invoices sprint. Start it in a **fresh session** so it isn't paying to re-read this long one.


---

## R. UI upgrade: data entry. Audit 5 October 2026 (no code changed)

Sayed, 5 Oct: drop the promo video, make data entry easy, focus on design (colours,
shapes, spacing), mobile last. The four forms audited: Add Item, New Invoice, New
Purchase Order, Add Customer. Each was read in code and opened in the running app at
1440×900. Nothing was saved.

**What was measured (verified):**

1. **Three kinds of input in one form.** Dropdowns are white boxes 36px tall. Typed
   fields (quantity, prices, SKU) have no box at all, are 26px tall and look like
   plain text ("0", "Business default"). Invoice/PO line fields are a third style,
   boxed at 37px. The PO's "New depot" dialog uses a fourth, older style (44px, 12px radius).
2. **Small type.** Section headings are 9.8px, field labels 11.2px and typed text 11.9px.
3. **Errors appear in the wrong place.** On the Invoice and PO, a failed save puts its
   message at the top of the page while the Save button is at the bottom. Nothing
   scrolls there, so Save looks dead. The invoice's line errors don't say which line.
4. **The invoice's Save is off screen.** It sits at y=1024 on a 900px-tall laptop.
   The PO has a pinned save bar and the invoice doesn't.
5. **Adding the same product twice makes two lines.** It should add 1 to the
   quantity. Seen on the invoice.
6. **The cursor doesn't land where typing starts.** Add Item, the customer dialog and
   a new invoice line all leave focus on the page/dialog, not the first field.
7. **Add Item has no "Save & add another"**, which is the most common need when
   loading stock. The name field has no visible label or required mark. A plan/usage
   strip sits at the top of the form.
8. **The PO buries its lines.** 17 fields (order, supplier, five payment fields) come
   before the first line. Supplier is three fields: a saved-supplier dropdown plus a
   free-text name plus a contact. The item picker is a pop-up that closes after every
   item. The invoice adds products inline. The two pages give the same job two designs.
9. **The customer dialog** isn't a real form, so Enter doesn't save. Phone and
   WhatsApp are plain text fields, so phones don't show the number pad. There is no
   "same as phone" for WhatsApp. Notes has no label.
10. **Small inconsistencies:** the PO is headed "Operations / New Purchase Order"
    while the invoice says "Selling / New invoice". There are three Cancel styles.
    Error boxes and the barcode notice are hand-coloured red/amber/green instead of
    the palette. Dates show US mm/dd/yyyy. The due date ignores the payment terms
    already saved in Company settings.

**Not checked:** phone widths (mobile is last by instruction), Arabic/RTL, Edit Item,
Suppliers/Depots dialogs, screen readers.

**Proposed phases (desktop first, one surface per commit):**

- ✅ **Phase 1: one field system — LIVE 5 Oct (fdecb30), with the Geist font and v2 palette.** One input look for every typed field, dropdown and
  line field (a light box, same height, same radius, blue focus ring). Bigger labels and
  headings. Palette colours for errors and notices. This changes the UI rule "no box
  around each field", so it needs Sayed's OK and a decision-log entry first.
- **Phase 2: speed fixes.** Focus on the first field. Save & add another on Add Item.
  Same product → quantity +1. Errors next to Save, naming the line. A pinned save bar
  on the invoice. Enter saves the customer. Number pad for phones. Ctrl+Enter saves.
- **Phase 3: layout.** PO lines moved up, payment folded into "Payment (optional)" and
  supplier made one picker like the invoice's customer. Add Item order changed to
  name → quantity → prices → the rest. Due date pre-filled from payment terms.
- Then Edit Item, Suppliers, Depots, Stock Counts get the same pass. Mobile comes last.

### R.1 Item page v3 — Sayed's reference, saved for later (5 Oct 2026)

Reference: [docs/references/item-page-reference-2026-10-05.png](references/item-page-reference-2026-10-05.png)
(an AI-generated mockup Sayed shared; "we will do this later"). **His must-have: a big image
preview.**

Take from it:
- low-stock banner with actions (Create purchase order, Adjust minimum)
- margin figure and a cost / margin / price bar
- an "Item setup" checklist (category, depot, supplier, SKU)
- one Activity timeline with filter tabs (All / Movements / Edits / Created)
- identifiers with a rendered barcode
- inline notes
- delete as a separate danger card
- a "…" overflow menu

Fix or add when building it:
1. **Big photo.** It should lead the page, large and zoomable, not a small side card. The mockup
   hides it lower down.
2. **Keep the section PDF buttons** and the newest-10 + "Show more" limits. The mockup has
   neither, and they were built today at Sayed's request.
3. **Sentence-case labels**, not "CATEGORY" capitals. Use the primary blue for "Create purchase
   order", not dark brown. Activity text is one size (the mockup mixes 13px and 20px).
4. **Real data only.** "The last purchase order was cancelled" must come from the item's real
   documents, or not be shown.
5. **Worth adding:** sold in the last 30 days and "about N days of stock left" (from invoice lines
   already loaded), and the last purchase cost.
6. **A rendered EAN-13 barcode needs a small library** (e.g. jsbarcode). Decide whether to add a
   dependency or show the digits only.
7. **The phone layout** isn't in the mockup. Mobile comes last anyway.

**R.1 status — LIVE 5 Oct 2026 (laptop width checked; 1024px and phone still to check).** Sayed said "do it now". Built in
`app/dashboard/inventory/[id]/page.tsx` + an "ITEM PAGE v3" CSS block at the end of
`globals.css`. Local commit on branch `claude/data-entry-screens-audit-aaed7f`, NOT yet pushed.
**If a session resets here:** start the test server (`sydin-worktree`, port 3200; clear `.next` if
CSS edits don't show), open `/dashboard/inventory/37`, and check the header, banner, big photo,
figures, details/pricing, chart, Activity tabs + PDF + Show more, documents table + PDF, notes,
setup list, identifiers, QR and delete card at 1440 and 1024 wide. Then lint/tsc/build, sprint
log, push to `origin main`.
