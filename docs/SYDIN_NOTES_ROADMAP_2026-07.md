# SydIN — Founder Notes Roadmap (Sayed's 14 handwritten notes, 2026-07-24)

Transcribed and triaged from Sayed's notebook. **Strict triage per his explicit request**
("be a devil — if the idea isn't great, delete or edit it"). Grouped by what the work actually
is, not by note order. Nothing here is built yet — this is the plan.

---

## ⚠️ READ FIRST — verify which build you're testing

Roughly **half of these notes describe bugs that are already fixed on `main`** (and on
`origin/main`) — confirmed in git: Sprint A (card hover blue→grey, list/table images, button
gradient), D1 (sidebar tooltip, per-page icons), D2 (site-wide small-image polish), D3
(collapsible stats), B1 (PO balance + month collapse), B2 (payment timeline).

If you're seeing the *old* look, the cause is almost certainly one of:
1. **An old Vercel deploy** — check which commit is live; `origin/main` may not be deployed yet.
2. **Stale local `.next` cache** — the recurring Turbopack issue in this repo. Fix: stop dev,
   delete `.next`, restart.

**Action:** before building anything in the "already fixed" bucket, confirm the bug still exists
on a fresh build. Don't pay to rebuild finished work.

---

## Bucket A — Likely ALREADY FIXED on main (verify build before touching)

| # | Note | Fixed by | Verdict |
|---|------|----------|---------|
| 1 | PO partial payment — show "still owe $4500", payment history inside each PO | Sprint B1 (balance strip: Total / Paid / **Still owe**) + B2 (payment timeline) | **Done.** Verify live. Possibly a small polish pass on wording/preview, not a rebuild. |
| 2 | PO history as collapsible month accordions ("March 2027 ▾" → POs) with dropdown motion | Sprint B1 | **Done.** Verify live. |
| 8b | Card hover = grey not blue; motion only on hover | Sprint A | **Done.** Verify — if still blue, it's an old build. |
| 9 | List/Table view images small + ugly border; wrap long text | Sprint A + D2 | **Mostly done.** Verify. Text-wrap was added; if still truncating, flag the exact cell. |
| 10 | Edit-item modal border softened | Sprint A (`rounded-[24px]` + lighter border) | **Done.** "Broken design in all pages" is too vague — needs specific screenshots per page. |
| 13a | Sidebar hover reveals page name with motion | Sprint D1 | **Done.** See Bucket C for the *icon upgrade* half. |

---

## Bucket B — VERIFIED still-present bugs (real work, low risk)

| # | Note | Evidence | Fix |
|---|------|----------|-----|
| 12a | Top-tab hover "goes up and touches the hidden line" | **Confirmed**: `translateY(-1px)` still on `.dashboard-top-tab:hover` (`globals.css:12149`); D1 added a highlight but left the lift | Remove the lift from the top-tab hover (keep it for the icon/pill buttons if wanted). ~1 line. |

*(More may exist but can't be confirmed without seeing your exact build. As you retest on a fresh
build, anything still broken drops into this bucket with a screenshot.)*

---

## Bucket C — NEW features / redesigns (real forward work)

### C1 · New PO page redesign — compact 2-column cards (notes #3 + wireframe)
Current New PO page is one long vertical form. Sayed's wireframe:
- Row 1: **Order details** | **Location & Supplier**
- Row 2: **Payment** | **Notes**
- Then: **Lines** (items / purchases / things bought)
- Sticky save bar
**Verdict: GOOD.** "Wide, not long, simple." Presentation refactor of `purchase-orders/new`.
**Risk:** must preserve ALL of PO-A's logic (auto PO number, depot dialog, mixed lines,
receive-now checkbox, attachment, payment). Presentation only. Research a reference layout first.

### C2 · General "+ Add ▾" dropdown in the header (note #4)
Replace the single "Add Item" with a **"+ Add ▾"** menu (Add Item · Add Purchase Order · Add
Receiving…) in the website header next to the Scan button. On **Dashboard** and **PO/Receiving**
pages. **Keep** the direct "Add Item" on the Inventory page (he agrees).
**Verdict: GOOD** — standard SaaS pattern (Linear/Notion "+ New"). Low risk, presentation + routing.

### C3 · Import & Export as real pages, not hidden in the three-dots (note #6)
- Move Import/Export out of the Inventory three-dots into proper pages (like PO/RCV).
- **Export:** preview the PDF/Excel layout before downloading. ✅ reasonable.
- **Import:** dedicated page + **import history** (file, what was added, when, how) + a sample
  template. History needs a small `import_logs` table (**SQL migration** — your manual step).
**Verdict: GOOD, with one cut.** ✂️ **"Edit the Excel before export" — dropped.** Building a
spreadsheet editor in-app is a huge scope for little gain; the standard flow is download → edit in
Excel → re-import. Keep a *preview*, not an editor.

### C4 · Inventory bulk multi-select actions (notes #7, #8)
Select N items → **Export PDF/Excel**, **Edit stock**, or **Create a PO** for those items, in one
action. Plus per-item **"Create PO from this item"** fast button on the card.
**Verdict: GOOD** — genuinely useful for a stock operator. Presentation + reuse existing PO/export
helpers. (The "collapse stats/search/grid in one click" part of #7 is **already done** — Sprint D3
Compact toggle; verify.)

### C5 · Quick-add-first item flow (note #14)
Add an item fast inline in Inventory, then press **(+)** to fill the rest of the details later,
instead of always opening the full Add-Item page.
**Verdict: GOOD direction.** A "Quick Add" modal already exists in the codebase (noted in Sprint 6)
but isn't wired as the primary flow. ✂️ **Don't delete the full Add-Item page** — keep it as the
"add all details" path; just make quick-add the default entry point.

### C6 · Sidebar custom per-page icons (note #13b)
Upgrade each sidebar icon to a distinctive custom symbol per section.
**Verdict: NICE-TO-HAVE, low priority.** Note: I can't pull copyrighted icons "from the internet";
I'd refine the existing icon set or build simple custom SVGs. Cosmetic — do last.

---

## Bucket D — DECISIONS I need from you (can't guess)

### D1 · Button colors (notes #11, #10) — you keep rejecting the brand gradient
You've now asked twice to change the "Add Item / primary" button color — but it was deliberately
unified to the logo gradient (`#10c4dc → #2563eb → #7d5cff`) in Sprint A, and that's a settled
decision. I won't flip it on a vague "it's ugly." **I'll propose 2–3 concrete alternatives
(solid brand-blue, softer gradient, neutral-dark) as a side-by-side, and you pick one.** Then it's
applied everywhere at once.

### D2 · Remove the top-tab bar? (note #12b)
You want to remove the header tabs (Overview/Activity/Inventory/Orders/Receiving) + search + scan
+ profile, and make a dedicated Search page with filters/profile/settings/plans.
**My take (agrees partly):** my own chrome audit found the **top tabs duplicate the sidebar** — so
removing them is defensible. **But** search is already solved (Cmd/Ctrl+K + `/dashboard/search`),
and a full "search-only page" would duplicate that. **Recommendation:** remove the redundant
top-tab bar, keep a slim header (logo · global search · +Add · scan · account), and *don't* build a
new search page. **Confirm** before I touch the shared chrome (it's on every screen).

---

## 🛑 Strict pushback — one idea to NOT build as written (note #5)

**"Scan a QR on the laptop → open your account on your phone → scan items there."**
This is a **device-pairing / session-handoff auth system** (WhatsApp-Web style). It's complex,
**security-sensitive, and touches authentication** — which is a hard untouchable — for very little
gain, because:
1. SydIN is already a responsive web app. On a phone you **just open SydIN and log in** — the
   camera scanner already works there (that's the whole M2 + Scanner mobile design).
2. **Public item review without login already exists** — `/item/[id]` is a public QR page. Anyone
   who scans an item's QR with their phone camera already sees it with no website login.

**What to build instead (small, safe):** when the laptop Scan button is clicked (no camera), show a
helper — "No camera on this device. Open SydIN on your phone to scan," optionally with a QR that
just deep-links to the SydIN mobile URL (a *link*, not an account handoff). The valuable half of
your idea (scan → item page with full RCV/PO/History/Qty preview) is already the public item page —
we just enrich it.

---

## Recommended sequence

1. **Verify build** (clear `.next` / check the live deploy). Re-triage Bucket A — most may vanish.
2. **Bucket B** — quick verified-bug fixes (top-tab lift). Cheap, immediate.
3. **D2 decision** → slim the header / remove redundant top tabs (pairs with my chrome audit).
4. **C2** — general "+ Add ▾" dropdown (small, high daily value).
5. **C1** — New PO 2-column redesign (research a reference first; presentation only).
6. **C4** — Inventory bulk multi-select actions (+ create-PO-from-item).
7. **C3** — Import/Export as pages + import history (needs one SQL migration).
8. **D1** — button-color proposal → your pick → apply site-wide.
9. **C5** — quick-add-first flow.
10. **C6** — custom sidebar icons (cosmetic, last).
11. **#5** — the *small* scan-helper + enriched public item page (never the auth pairing).

**Rules that still apply to all of it:** one surface per batch · presentation-only unless a note
truly needs data (only C3 import-history does) · no new dependencies / no Framer Motion · verify
`lint`+`tsc`+`build` + a live browser check · log each batch in `SYDIN_SPRINT_LOG.md`.
