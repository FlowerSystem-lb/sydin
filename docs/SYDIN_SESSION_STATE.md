# SydIN — where we are

**Living document. Overwrite it, don't append.** The sprint log is the history;
this file is the answer to "what were we doing?" after a break. Update it at the
end of any working session.

Last updated: **2026-08-25**
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

## Next — Phase 3: survive 500 products

The one that actually blocks launch. No visual change.

- Every page load downloads the **entire inventory, all columns**. Fine at 10
  items; bad at 500 on Lebanese mobile data.
- 60 database rules re-check the user **per row** instead of per query.
- 11 missing indexes, 20 unused ones.
- Serve thumbnails, not full-size photos, in the grid.

Estimated 4–5 days. Phase 4 is the real 500-product test, which is meaningless
until Phase 3 lands.

Then: Phase 5 storage/upload/import limits · Phase 6 mobile (its own app-shaped
design, deliberately last) · Phase 7 print, PDF, export, domain and Vercel.

**Launch target: early November.**

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
- **An overflow test is not an overlap test.** Elements can sit on top of each
  other without anything leaving the viewport — that shipped a broken header
  once already.
