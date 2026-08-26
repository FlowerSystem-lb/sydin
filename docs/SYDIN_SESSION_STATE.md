# SydIN — where we are

**Living document. Overwrite it, don't append.** The sprint log is the history;
this file is the answer to "what were we doing?" after a break. Update it at the
end of any working session.

Last updated: **2026-08-27**
Branch: `main` (everything pushed; GitHub and local in sync)
Governing brief: `SydIN_Final_Production_Master_Prompt.pdf` — audit first, stop
between phases, report in business language. See [[sydin-master-mission-protocol]].

---

## Done

### Phase 1 — security  ✅ (one checkbox outstanding)

- Six security headers added (CSP, HSTS, nosniff, frame, referrer, permissions).
  Verified against a real production build, not just dev.
- npm vulnerabilities **8 → 2**. All five high-severity gone. Next 16.2.6 → 16.3.1.
  The 2 remaining are `uuid` via `exceljs`; the only fix is a multi-major
  downgrade that breaks Excel export. **Left deliberately.**
- Database: `anon` could execute **24** functions, now **1** (`get_public_item`,
  the customer QR page). `sql/phase-15` + `sql/phase-16`, both run and verified.
- Supabase security advisor findings **26 → 9**, the 9 reviewed and accepted.

### Phase 2 — the design language  ✅

One type scale and one surface rule across Overview, Inventory and item detail.
Nothing above weight 600.

| Screen | Boxes | Type pairs | Text heavier than 600 |
|---|---|---|---|
| Overview | 33 → **0** | 15 → **7** | — → **0%** |
| Inventory | 65 → **19** | 23 → **11** | 94% → **0%** |
| Item detail | 13 | 15 → **6** | 63% → **0%** |

Also in this phase:

- **Shell** — rail and header are one piece of colour; the seam is a single
  hairline that curves below the header; the page holds still while only the
  content scrolls. The workspace ground was four drifting amber orbs under a
  blue brand; now one light, from the logo.
- **Item card** — a template with fixed slots, so every card is exactly 348px
  and the grid actually aligns.
- **List view** — a real list. 43 boxes → 13, rows 74px → 60px.
- **Table view** — a header that genuinely sticks (it was `position: sticky` and
  still scrolling away, stuck to the wrong ancestor).
- **Public QR page** — the only screen customers see. Three nested frames around
  the photo became one; four boxed facts became hairline rows.
- **Colour** — two passes. Backgrounds 290 → 215, borders 133 → 93. One `--ink`,
  one `--ink-muted`, three white veils.
- **Inventory header** — three rows → two, products start 91px higher.
- **Sidebar** — regrouped by the working day: Workspace / Buying / Stock /
  Set up / Insights / System. Suppliers now sits with Purchase Orders.

---

## Outstanding — needs Sayed, not code

1. **Leaked-password protection** — Supabase → Authentication. One checkbox.
2. **Test Google and Microsoft sign-in on the live site.** Security headers are
   live; they should be unaffected, but testing means signing in as him.
3. **Check the business logo on the public QR page.** Broken locally (a
   certificate quirk on his machine, not a code bug) — confirm it loads in prod.
4. One real depot or shop whose name can appear on the website.
5. Confirm the site's contact email and WhatsApp number are real and monitored.

---

## Phase 3 — survive 500 products  (photos done · database written, not run)

**Correction to the audit.** I said "every page load downloads your entire
inventory" and called it a mobile-data problem. Measured: a row averages 210
bytes, photos are links not embedded, so 500 products is about **103 kB**.
That was overstated. Photos are the real cost.

### Done — photos  ✅

40 stored files average **396 kB**; the biggest is **1.71 MB**; 12 are over
500 kB. The grid was serving every one at full size and drawing it 2 cm wide,
so a 500-item screen projected to about **193 MB**.

Three screens still used a raw `<img>` — and they were exactly the ones that
draw once per product: the grid card, the list and table rows, and the
overview thumbs. All three now use `next/image` with a size matched to the box
they actually fill.

Measured on the real 1.71 MB photo:

| drawn at | before | after | saving |
|---|---|---|---|
| card (256px) | 1.71 MB | 11.6 kB | 99.3% |
| 384px | 1.71 MB | 21.7 kB | 98.7% |
| 640px | 1.71 MB | 46.3 kB | 97.3% |

A 500-item grid: **193 MB → about 6 MB.**

### Written, waiting to be run — the database

`sql/phase-17-rls-per-query-uid.sql`. **Sayed runs this in Supabase; I do not.**

- **60 of 61 security rules** re-ask "who is signed in?" on every row. Wrapping
  the call so it runs once per query is Supabase's own documented fix. Written
  as a loop that rewrites the policies as deployed, rather than 60 hand-typed
  policies — transcribing security rules by hand is where a typo becomes a
  data leak. Safe to run twice.
- **11 foreign keys with no index.** These matter more than the row counts
  suggest: the tables are shared by every customer, so `inventory` is 500 rows
  *per business*, not 500 rows.
- Ships with three verification queries. Expected: `per_row_uid = 0`,
  `wrapped = 60`, `total = 61`, all 61 policy names unchanged, no unindexed
  foreign keys left in `public`.

### Still to do

- **Load products in pages** instead of all at once. This is about the browser
  drawing 500 cards, not download size. Not started — it changes how inventory
  loads, so it wants care.
- Then Phase 4, the real 500-product test.

### Noticed in passing, not fixed

- `plan_requests` has one policy, "Anyone can create plan requests", open to
  the public with no check. That is correct for a public pricing form, but it
  means anyone can post rows into that table. Worth a rate limit or a captcha
  before launch.
- Vercel meters image optimization. This is a cost item at scale, not now.

---

## Live URLs

- Latest `main`: `sydin-git-main-syd-in-test-s-projects.vercel.app`
  Always use this one. The random-hash URLs are frozen snapshots of old builds —
  that is why the site once looked "still old".
- Status page: https://claude.ai/code/artifact/223456e6-d8a4-46ec-a005-5cd4b4463cde

## Working rules that keep being relearned

- **Measure, never assume.** Reading the CSS has been wrong repeatedly; the
  computed value in the browser is the only truth. `globals.css` is ~20k lines
  with rules declared six and eight times over.
- **Restart the dev server after editing `globals.css`.** Turbopack serves stale
  CSS, which has faked at least six "the fix didn't work" moments.
- **The 85% scale lives in one line:** `html { font-size: 85% }` near the top of `globals.css`.
  If something does not shrink with the rest of the site, it is hardcoded in `px` — convert it to
  `rem`. Do **not** use CSS `zoom`: tried and reverted 2026-08-26 —
  four layout bugs, none of them measurable, because zoom makes fixed and
  in-flow elements report coordinates in different systems. Density comes from
  the spacing and type tokens; browser zoom covers the rest. See the decision
  log.
- **Under any transform, trust the screenshot over the measurement.** Every
  number said the list was fully scrolled while the screen showed three rows
  cut off.
- **An overflow test is not an overlap test.** Elements can sit on top of each
  other without anything leaving the viewport — that shipped a broken header
  once already.
