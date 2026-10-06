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

**Language:** every post is a carousel with the Arabic slide(s) first and the English slide(s)
second (Arabic headlines in Cairo ExtraBold, body in Cairo; English in Barlow Condensed / Barlow).
Captions Arabic first, then English. Never claim the app is in Arabic until it is.

**Truth rules for posts:** plan names (Standard/Pro) stay off the post images (Sayed's call, 3 Oct
2026), but scanner and Excel/CSV import are paid-plan features — when someone asks, say so plainly,
and never call them free. Free = 50 items with photos, low-stock alerts, stock history. No invented numbers,
testimonials or followers.

**Wording (3 Oct 2026, Sayed's call):** public social copy says "depots in Lebanon" /
"للمستودعات بلبنان" — never "wholesale" / "الجملة". The product's target buyer in the plan of
record is unchanged; only the marketing word is dropped so the message does not exclude
non-wholesale shops.

**Logo (3 Oct 2026, Sayed's call — supersedes the "colour logo on a badge" rule):** SydIN moves
to a flat two-colour logo. On blue: everything white. On white/paper: the mark and "IN" in SydIN
Blue `#2563EB`, "Syd" in navy `#0F1F3A`. Profile pictures on every platform: white mark on blue.
Files: `docs/brand-kit/` — PNG and SVG of `sydin-logo-blue`, `sydin-logo-white`,
`sydin-mark-blue`, `sydin-mark-white`. The SVGs are real vector paths traced from the old raster
logo (smooth at any size; still ask for the designer's original file before large print). **Update, same day:** at Sayed's
request the website logo, favicon and app icons were switched to the flat logo (PR #3, see the sprint log). The email logo
(`public/email/sydin-logo.png`) still uses the old gradient — change it only when Sayed asks.

**Call to action until launch (3 Oct 2026, Sayed's call):** posts only ever say "reserve your place
on the waitlist" / "احجز مكانك بلائحة الانتظار", link in bio. No "start free", no "50 items", no demo
on social posts. The website itself is unchanged (it still has Start Free and Demo).

---

## Operating rhythm (from 3 Oct 2026)

Sayed asked Claude to act as SydIN's senior marketing, social media and sales lead. Each new
session continues this role from here, not from scratch.

- **Every Sunday:** Sayed sends Instagram/TikTok Insights screenshots and the number of waitlist
  sign-ups and WhatsApp conversations that week. Claude replies with what worked, what to change,
  and the week's posts (images + Arabic/English captions) ready to upload.
- **The numbers that matter, in order:** depots spoken to → depots trying SydIN → WhatsApp/DM
  conversations → waitlist sign-ups → saves/shares → followers. Likes are not a goal.
- **Targets before launch:** 10 depots trying SydIN with Sayed beside them, 1 real story (with
  permission).
- **Paid ads:** none before ~17 Oct. Then a $3–5/day, 5-day Meta test on the best organic post,
  goal "messages", Lebanon 25–55. No TikTok ads yet. Sayed enters his card himself.
- **Sales:** outreach is done by Sayed on WhatsApp and in person, using the scripts Claude
  writes; leads tracked by name, area, stage (contacted → demo → trying → paying).

---

## Problem-story video: "وكان عندك / And you had it" (3 Oct 2026)

Sayed asked for a video about **the problem SydIN solves, not its features**, and whether it could
be made with Higgsfield (AI video).

- **Story (22.5 s, 9:16):** a customer asks for a white Type-C cable, the owner digs through
  identical cartons, the customer gives up, and the cable turns up in the last box ("وراحت البيعة...
  وكان عندك" / "Sale lost. And you had it."). Then a rewind: same question, one look at SydIN
  (Type-C Cable · White, 3 left, low stock), "Sale kept", blue brand card, waitlist call to action.
  Arabic leads on every frame, with English under it; SydIN Blue first appears at the turn.
- **Three versions, safest first:** (A) the motion-graphics version Claude rendered with designed
  sound, no AI footage, ready to post; (B) real footage on Sayed's iPhone in a shop, with a real
  SydIN screen recording, which is the preferred upgrade; (C) Higgsfield only for a shot that
  can't be filmed.
- **Rules for any AI footage:** AI label ON (Instagram/Facebook "AI label", TikTok "AI-generated
  content"). Never generate the app screen, logo, text, faces or a "real customer". Never call a
  staged scene real. Never buy a yearly plan; cancel auto-renew the day you subscribe.
- **Schedule:** the motion version was posted Sun 4 Oct, about 10:50 pm, as an Instagram Reel shared
  to Facebook, and on TikTok. It moved up from Tue 6 because the account had only 10 followers and the
  first carousel reached almost only them: 34 views (19 Instagram, 15 Facebook) and 0 follows in 24 h.
  Reels/TikTok are the only format shown to non-followers. Tue 6 has no new post. "Who I am" (V1)
  moves to Sat 10 Oct.
- **Captions:** one post per platform, with one caption: Arabic, then English, then 5 hashtags
  (`#لبنان #Lebanon #مستودعات #InventoryManagement #SydIN`). LinkedIn and Threads get English only.
- **Kit (shot list, CapCut steps, Higgsfield prompts, captions):**
  https://claude.ai/artifact/3R3U5DaYs4DqVcrrri4EbT

## Nothing personal, LinkedIn paused (6 Oct 2026, Sayed's call)

Sayed does not want personal content: no posts on his personal LinkedIn and no face-to-camera
videos. So:
- **LinkedIn is paused.** The Wednesday LinkedIn slots are gone from the calendar. Revisit at
  launch, possibly as a SydIN company page. Don't re-propose personal posts before then.
- **Videos come from the SydIN accounts only, with no face.** Motion stories (like "And you had it")
  and screen recordings of the app. V1 "Who I am" and V10 "Why I built SydIN" are paused. Sat 10
  becomes V3 (scan a barcode, the item opens), Tue 13 becomes V7 (low stock), and Tue 3 / Tue 10 Nov
  become new motion stories.
- **Trust still needs a human.** That now happens in person and on WhatsApp during depot visits,
  not on social media. Sales scripts should be written for that.

