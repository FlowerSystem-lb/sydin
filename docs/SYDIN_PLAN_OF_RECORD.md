# SydIN — Plan of Record

**Last touched:** 27 August 2026 (storage · H1/H2 · cards, quick preview, item page)
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
| 6 | Mobile — its own app-shaped design | last, by founder instruction |
| 7 | Print, PDF, export, domain, Vercel | **print done 27 Aug**; PDF exporters already substantial (1,441 lines for inventory); domain + Vercel Pro are launch steps |

**Phase 3 numbers, measured:** photos averaged 396 kB with the largest at 1.71 MB,
and the grid served every one at full size. A 500-item screen projected to ~193 MB;
it is now ~6 MB. The 60 security rules that re-checked the signed-in user on every
row now check once per query.

**A correction on the record:** the audit claimed every page load downloads the whole
inventory and called it a mobile-data problem. Measured, 500 products is ~103 kB of
data. That was overstated. Photos were the real cost.

---

## B. Sayed's handwritten notes — none of this is built yet

### New features

| id | What | Size |
|---|---|---|
| N1 | **Add an item by scanning its barcode.** Scan the printed code on the carton, the app creates the item, then you fill in photo, cost and details. Typing the number by hand must also work. | Medium |
| N2 | **Batch add, POS-style** — several items in one go by barcode. | Large |
| N3 | **Batch photos** — several photos for several different items at once. | Large |
| N4 | **Photos joined to the Excel import** — rows 1,2,3,4 matched to photos 1,2,3,4. | Large |

N3 and N4 are really one feature. Of the four, N4 is the most valuable to a real shop.

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
9. **Mobile.**
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
