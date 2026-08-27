# SydIN — Plan of Record

**Last touched:** 27 August 2026
**Shared view:** https://claude.ai/code/artifact/c7e93db9-8082-47d5-8f06-4ff8b9b8f5c4

> **This is THE plan. One file, one link. It is appended to and ticked off — never
> rebuilt from memory.**
>
> Added 27 Aug 2026 because Sayed said the plan keeps getting messed up after every
> context reset. He is right: it did. Each reset I re-derived it and the numbering
> drifted. The rule now: read this file, edit this file, do not start a new one.
>
> - `SYDIN_SESSION_STATE.md` — short note on what happened last session.
> - `SYDIN_ROADMAP.md` — the OLD product roadmap. **Different phase numbers.**
>   Its Phase 5 is Enterprise/RBAC/SSO, not this plan's Phase 5.
> - Scope comes from `SydIN_Final_Production_Master_Prompt.pdf` (77 items) plus
>   Sayed's handwritten notes, photographed 27 Aug 2026.

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
| 5 | **Limits and abuse protection** | not started — **bigger than thought, see D** |
| 6 | Mobile — its own app-shaped design | last, by founder instruction |
| 7 | Print, PDF, export, domain, Vercel | not started |

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
| H1 | **BUG — the Adjust / Quick-view panel opens half off-screen.** You must scroll before you can reach "Record Movement". It should fit the screen as it opens and open/close smoothly. **Every page, not just Inventory.** |
| H2 | **BUG — blurring down the left and right edges** of the page when that panel opens. |
| A | A header inside the Inventory page for the buttons and the three-dots menu. |
| B | Reorder the buttons by what matters; drop what does not. |
| C | Item cards — new design. Tell Sayed when we reach this so he can pull references. |
| D | Quick preview — new prototype, more classic; the Activity header needs redesign. |
| E | Full-page item view — new layout. Oversized words, empty space down the left. |
| F | Inventory page background fully white, same as the other pages. |
| G | Decide the three-dots contents: Import, Export CSV, Export PDF, Export Excel. |
| S | Dashboard/Overview finished properly, connected to every page, one smart summary. |

### Standing instructions

- **Laptop / tablet / PC only** for now. Phones come last, with their own
  Sortly-style design.
- He will keep adding edits. My job: organise them, be strict, say when something
  is a bad idea.
- He will fetch design references if asked.
- **He likes the Scanner page. Do not redesign it.**

---

## C. My call on his notes, since he asked me to be strict

**First, because it is a bug and it is everywhere:** H1 and H2. A panel that opens
half off-screen is not polish, it is the app not working. His note says every page,
which makes it one fix rather than ten.

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

### Storage security — the real finding (PDF items 28, 29)

1. **Any signed-in user can write into any other customer's product photos.**
   The `products` bucket upload rule checks only `bucket_id = 'products'`. It never
   checks the folder belongs to the uploader. `business-logos` and `po-attachments`
   both check ownership correctly — `products` was missed.
2. **No delete rule on `products`.** Photos can never be removed, so deleted items
   leave their files behind and the storage bill only grows.
3. **The 5 MB limit and the jpeg/png/webp check are browser-side only.** The buckets
   have no size limit and no type restriction, and the key the browser uses is
   public — so both can be walked around.
4. **Purchase-order attachments are readable by anyone with the link.** Those are
   supplier invoices.
5. All product photos are public by URL. That is needed for the QR page, but it
   should be a recorded decision rather than an accident.

### Not started, and genuinely needed before launch

- **Rate limiting (33) and bot protection (34).** Nothing exists. Login, signup,
  password reset, import, export and PDF generation are all unthrottled.
- **CSV/Excel import limits (36, 37, 38).** No row cap. A large file can create
  unlimited records.
- **Backups and recovery (46).** Not reviewed. The PDF is blunt about not launching
  a SaaS without one.
- **Load testing (50)** and the **500-product test (30)**.
- **Print, PDF and export redesign (57, 58, 59)** — untouched.
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
2. **H1 + H2** — the half-open panel and the edge blur.
3. **Inventory sprint** — F, B, G, A; then C/D/E designed together; plus the
   density control from PDF item 14.
4. **Dashboard summary (S).**
5. **Limits and abuse** — rate limiting, import caps, server-side upload caps.
6. **Pagination**, then the real 500-product test.
7. **Print / PDF / export.**
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
