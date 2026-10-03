# SydIN — Marketing & Launch Plan

How SydIN goes from "private build" to "people are using it." Claude acts as launch strategist
and content partner here. Keep it founder-led and honest — **do not** make SydIN look like a
fake huge company too early.

---

## Positioning

> **SydIN is a modern, visual inventory SaaS for small businesses and teams that need simple,
> fast, beautiful inventory management.**

- **Category:** modern inventory & asset management (the long-term vision: the operating system
  for inventory and physical assets).
- **Feels like:** Sortly's visual simplicity + Linear's speed + Stripe's polish.
- **Not:** a heavy legacy ERP.
- **Tone:** professional but founder-led. Real, specific, a little personal. No corporate fluff.

**Differentiators to lead with** (once stable): beautiful visual inventory, fast item
management, QR & Labels, and a genuinely good mobile/scan experience.

---

## Audience

- Small businesses, shops, warehouses, workshops, clinics, schools/labs, rental and asset-heavy
  teams that currently use spreadsheets or clunky tools.
- Early focus can include the founder's own region/network; expand outward as proof grows.

---

## Launch phases

### Pre-launch (build in public, quietly)
- Polish a few hero screens (Inventory, Item Details, QR & Labels) for screenshots.
- Capture clean **product screenshots** (desktop + mobile) using the QA screenshot workflow.
- Set up landing pages already in the repo (`app/page.tsx`, `features`, `pricing`, `demo`).
- Start a small founder presence: occasional "building SydIN" posts; collect an early-access /
  waitlist interest list.

### Launch
- Announce on LinkedIn + Instagram with real screenshots and a short demo.
- Clear call to action (try the demo / request access / request a plan — note SydIN supports a
  **manual plan approval** path, see [SYDIN_PAYMENTS_STRATEGY.md](SYDIN_PAYMENTS_STRATEGY.md)).
- A simple **launch checklist** (below) gates the announcement.

### Post-launch
- Steady cadence of feature announcements and founder updates.
- Show real usage, real improvements, customer stories (with permission).

---

## Content calendar (lightweight, sustainable for a solo founder)

| Cadence | LinkedIn | Instagram |
|---|---|---|
| 1–2× / week pre-launch | "Building SydIN" progress, a screenshot, a lesson | Visual teasers, UI close-ups |
| Launch week | Launch post + demo, positioning, CTA | Carousel of key screens, short reel |
| Weekly post-launch | Feature announcement or founder update | Feature highlight, tip, before/after |

**What to post:** new features, before/after polish, a real workflow solved, founder lessons,
short demos. **What to avoid:** fake metrics, "we're a big team" framing, over-promising
unbuilt features.

---

## Launch checklist (gate before announcing)

- [ ] P0 foundation stable (Inventory, Categories, Item Details, Add/Edit; states everywhere).
- [ ] Mobile QA passed (Sprint 7).
- [ ] Core screenshots captured (desktop + mobile).
- [ ] Landing/pricing/demo pages reviewed and accurate.
- [ ] A working way to get access / pay (even if manual approval).
- [ ] Privacy & terms pages reviewed (`app/privacy`, `app/terms`).
- [ ] Verification gate passing on `main` build.

---

## Claude's marketing deliverables (on request)

Launch plan · pre-launch posts · product screenshots direction · social calendar · LinkedIn &
Instagram posts · website copy · positioning · feature announcements · founder updates ·
launch checklist · post-launch content · "when to post and what to post" guidance.

> Keep claims truthful. If a feature isn't shipped, don't market it as available — tease it as
> "coming" at most.

---

## Pre-launch social plan (set 3 Oct 2026)

Decided with Sayed in a marketing session. The full plan (calendar, Arabic + English captions,
video ideas, bios) lives in one artifact — update it rather than writing a new one:
https://claude.ai/artifact/1zi11oQENfVsykHAVxMEtw. Post designs live on the canvas:
https://claude.ai/artifact/6heR6Gdy8SpgA52pW9p5JM.

**Post look (Sayed rejected the first gradient/serif version as "AI-looking"):** two colours only,
SydIN Blue `#2563EB` and Paper `#F5F6F8`, alternated post by post so the profile grid is a
checkerboard; the logo top-centre in the flat two-colour version (see "Logo" below); one Barlow Condensed headline in capitals; a thin 1px frame 36px
inside the edge; a rounded footer pill with handle + Instagram/TikTok/WhatsApp icons; real
photos only (no AI images, no stock). Feed 1080×1350, Stories/Reels/TikTok 1080×1920.

**Platforms:** Instagram = home base · WhatsApp Business (Status + Channel) = where every post
ends · TikTok + Reels = reach (Sayed speaking Lebanese, English subtitles) · LinkedIn = Sayed's
personal profile, weekly, English · Facebook + Threads = automatic copies · X = handle reserved,
not used yet.

**Rhythm:** Mon + Thu feed post 8:30 pm, Tue + Sat video 9 pm, Wed LinkedIn 9:30 am (Beirut),
batched on Sunday. Six weeks from Mon 5 Oct 2026; the launch date is announced only once the
plan-of-record launch steps (pagination, domain, backups) are done.

**Language:** designs in English (the app UI is English-only today); captions Arabic first, then
English. Never claim the app is in Arabic until it is.

**Truth rules for posts:** scanner and Excel/CSV import are Standard/Pro only — say so on the
post. Free = 50 items with photos, low-stock alerts, stock history. No invented numbers,
testimonials or followers.

**Wording (3 Oct 2026, Sayed's call):** public social copy says "depots in Lebanon" /
"للمستودعات بلبنان" — never "wholesale" / "الجملة". The product's target buyer in the plan of
record is unchanged; only the marketing word is dropped so the message does not exclude
non-wholesale shops.

**Logo (3 Oct 2026, Sayed's call — supersedes the "colour logo on a badge" rule):** SydIN moves
to a flat two-colour logo. On blue: everything white. On white/paper: the mark and "IN" in SydIN
Blue `#2563EB`, "Syd" in navy `#0F1F3A`. Profile pictures on every platform: white mark on blue.
Files: `docs/brand-kit/` (`sydin-logo-blue.png`, `sydin-logo-white.png`, `sydin-mark-blue.png`,
`sydin-mark-white.png`) — recoloured from the existing raster logo, so ask for the original
vector file before any large print. **The website, app icons and emails still use the old
gradient logo; Sayed will switch them later as its own sprint — do not change them unasked.**
