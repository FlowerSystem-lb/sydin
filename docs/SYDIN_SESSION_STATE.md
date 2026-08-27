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

### Done — the database  ✅ (applied 2026-08-27)

`sql/phase-17-rls-per-query-uid.sql` + `sql/phase-17b-flatten-nested-uid.sql`.

- **60 of 61 security rules** re-ask "who is signed in?" on every row. Wrapping
  the call so it runs once per query is Supabase's own documented fix. Written
  as a loop that rewrites the policies as deployed, rather than 60 hand-typed
  policies — transcribing security rules by hand is where a typo becomes a
  data leak. Safe to run twice.
- **11 foreign keys with no index.** These matter more than the row counts
  suggest: the tables are shared by every customer, so `inventory` is 500 rows
  *per business*, not 500 rows.
Verified after applying: 61 policies, 60 wrapped exactly once, 0 nested,
0 unwrapped, all 61 names unchanged, all 11 indexes present.

**It took three attempts, and the reason is worth keeping.** Running the file
through the Supabase SQL editor reported "Success. No rows returned" and
changed nothing; the migration API is the path that works. Then phase-17's
own "safe to run twice" guard turned out to be case-sensitive — PostgreSQL
stores the rewrite as `( SELECT auth.uid() AS uid)` in upper case, so the
guard never recognised its own work and each re-run wrapped the expression
again, four deep. phase-17b flattens it. Permissions were never affected.

This is the third migration in a row where the statement succeeded and the
intent did not (phase-15 revoked from named roles while PUBLIC held the
grant; phase-17 compared deparsed SQL case-sensitively). The rule earned
three times over: **read back what the database says afterwards — do not
trust that a migration ran without error.**

### Deliberately deferred — pagination

**Load products in pages** instead of all at once. Sayed's call, 2026-08-27:
leave it until last. Reasonable — it is the only part of Phase 3 that changes
how inventory loads, and the two parts that were pure wins (photos, database)
are already in. The browser drawing 500 cards is a real cost, but it is a
smoothness problem, not a cost-of-data or a security one.

Phase 4 (the real 500-product test) is blocked on this, so it moves back too.

---

## The rest of the production plan

From `SydIN_Final_Production_Master_Prompt.pdf`. **Careful: these numbers are
not the ones in `SYDIN_ROADMAP.md`.** That file numbers *product* phases and
its Phase 5 is "Enterprise" (RBAC, audit logs, SSO, white label) — a much
later, much bigger thing. The numbers below are the production plan we are
actually working through.

| # | What | State |
|---|---|---|
| 1 | Security — headers, dependencies, database grants | ✅ done |
| 2 | The design language — one type scale, one surface rule | ✅ done |
| 3 | Survive 500 products — photos, database, pagination | photos + database done; pagination deferred |
| 4 | The real 500-product test | blocked on pagination |
| 5 | **Limits — storage, upload size, import size** | not started |
| 6 | Mobile — its own app-shaped design | deliberately last |
| 7 | Print, PDF, export, domain and Vercel | not started |

**Phase 5 in plain terms:** stop one customer filling the account. Today there
is no cap on how large a photo can be uploaded (the biggest already stored is
1.71 MB), no cap on how many rows a CSV import can carry, and no ceiling on
total storage per plan. The free plan promises 50 items but nothing enforces
the space those items occupy. It is a cost and abuse problem, not a
performance one — it decides the bill before it decides the speed.

**Launch target: early November.**

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
