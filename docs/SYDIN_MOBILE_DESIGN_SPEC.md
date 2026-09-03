# SydIN Mobile — Design Specification

**Written 2 September 2026.** This is the build document for the phone version.
It describes the design exactly enough to rebuild it on SydIN's own pages and
real data, without looking at the prototype again.

Where it came from: the design canvas
(https://claude.ai/code/artifact/8f42f751-b185-48e1-9397-2c428afbbb93) for the
shape, and the Replit prototype for the working detail. Every number below was
read out of the prototype's source, not estimated.

**What this is not.** The prototype's code cannot be dropped into SydIN — its
class names and markup are its own, and its products are invented. This document
is the bridge: the design, written down, so it can be built on real data.

---

## 1. Colour

| Token | Value | Used for |
|---|---|---|
| Ink | `#0b1220` | Titles, row names, numbers, primary text |
| Muted | `#64748b` | Secondary lines, labels, descriptions |
| Faint | `#94a3b8` | Eyebrows, placeholders, meta, disabled |
| Hairline | `rgba(11,18,32,0.08)` | Every divider and row separator |
| Blue | `#3977ff` | Links, active tab, focus, chart line |
| Violet | `#8357ff` | Gradient middle stop |
| Magenta | `#d64bff` | Gradient end stop |
| In stock | `#22c55e` | Status dot |
| Low | `#f0a133` | Status dot; text version `#b47720` |
| Out | `#ef4444` | Status dot and sign-out; text version `#cf3d3d` |
| Positive | `#2e8b68` | Stock-in numbers, confirmations, ticks |
| Negative | `#c05252` | Stock-out numbers |

**The gradient.** `linear-gradient(105deg, #3977ff 0%, #8357ff 54%, #d64bff 100%)`.
Reserved for exactly two things: the single primary action on a screen, and the
raised Scan button. Never on a panel, never on a card, never as decoration. On
the Home attention figure it is clipped to the text itself, not painted behind it.

**Glass.**

| Token | Value |
|---|---|
| Fill | `rgba(255,255,255,0.70)` — SydIN uses `0.72`, see the note below |
| Border | `rgba(255,255,255,0.50)` |
| Blur | `blur(20px)` — SydIN uses `blur(18px) saturate(150%)` |
| Shadow | `0 8px 32px rgba(11,18,32,0.05)` |
| Drawer fill | `rgba(255,255,255,0.85)` |
| Scrim | `rgba(11,18,32,0.30)` with `blur(4px)` |

*The SydIN deviation is deliberate.* This is read at arm's length in a bright
storeroom, not on a desk. **If text is ever hard to read on glass, raise the
opacity — never raise the blur.**

**Page background.** Base `#f1f4fa`, with two fixed radial washes over it:
violet `rgba(131,87,255,0.08)` from the top right, fading out by 40%; blue
`rgba(57,119,255,0.08)` from the bottom left, same fade. Faint on purpose — it
exists so the frosted surfaces have something to frost.

**Accessibility.** All of the above switches off for anyone whose device asks for
reduced transparency: surfaces go solid white, blur goes to none. A design
preference never overrules an accessibility setting.

---

## 2. Type

Two faces only. **Source Serif 4 at weight 400** for headings — never bold, never
another weight. **Inter** at 400/500/600 for everything else.

| Element | Size | Weight | Line height | Letter spacing |
|---|---|---|---|---|
| Screen title | 34px | 400 serif | 1.02 | −0.025em |
| Landing headline | 46px | 400 serif | 0.98 | −0.04em |
| Sheet / section heading (serif) | 26px | 400 serif | 1.08 | — |
| Screen subtitle | 13px | 400 | 1.35 | — |
| Section heading | 17px | 600 | — | −0.02em |
| Row name | 15px | 600 | 1.25 | — |
| Row secondary | 13px | 400 | 1.25 | — |
| Eyebrow | 11px | 600 | — | 0.11em, uppercase |
| Home figure | 38px | 400 | 1 | −0.045em |
| Item quantity | `clamp(54px, 16vw, 72px)` | 400 | 0.92 | −0.06em |
| Count number | 80px | 500 | 0.9 | −0.06em |
| Button | 16px | 600 | — | — |
| Field label | 13px | 500 | — | — |
| Status word | 12px | 400 | — | — |
| Tab label | 11px | 500 | — | — |

All numbers use tabular figures, so they do not jitter while counting up or
changing.

---

## 3. Spacing and shape

- **Side gutter: 22px.** Every screen, no exceptions.
- Title block: 40px above, 17px below, then a hairline.
- Between sections: 30px.
- Data row: **68px minimum**, 10px vertical padding, hairline below, none on the last.
- Info row: 60px minimum.
- Thumbnail: **52px square, 11px radius**. Compact list 42px/9px. Item detail 112px/14px.
- Card radius 16px · sheet 24px top corners · button 14px · input 12px · chip 20px (pill).
- **Nothing tappable under 44px.** Icon buttons are 44×44.
- Content clears the bottom bar by `112px + safe-area`.

---

## 4. The side drawer

**Opened by** the hamburger at the top left of the title row on the main screens.
**Closed by** the X in its header, tapping the scrim, or choosing any link.

320px wide, capped at 85vw, full height, pinned left. Fill
`rgba(255,255,255,0.85)` with the standard blur, a hairline right border, and a
`12px 0 32px rgba(11,18,32,0.05)` shadow. Behind it the scrim dims and blurs the
page. It slides in from −20px with a fade, 200ms ease-out.

**Header:** "SydIN" in the serif at 24px, close button opposite.

**Contents, in order, under small uppercase group headings:**

- **Every day** — Home · Items · Scan · Activity
- **Buying** — Purchase orders · Receiving · Suppliers
- **Stock** — Stock counts · Pick lists · Depots · Categories · QR center
- **Workspace** — Reports · Import and export · Alerts · Settings · Help

**Footer, above the home indicator:** Account, then **Sign out** in the
out-of-stock red.

Each row is 48px, 15px medium, with an 18px muted icon, tinting its background on
press.

---

## 5. The top-left menu button

Appears on the five main screens (Home, Items, Activity, More, and any screen
without a Back button). 44×44, transparent, a 22px hamburger in ink, pulled 12px
left so the icon aligns with the gutter rather than with its own padding box.

Screens reached from somewhere else show **Back** in its place, never both.

---

## 6. The bottom bar

Fixed, full width to 430px, 76px tall plus the safe area, frosted, hairline top
border. Five columns:

**Home · Items · Scan · Activity · More**

Icons 21px at 1.8 stroke. Inactive `#94a3b8`, active `#3977ff`, labels 11px/500,
colour transitions over 200ms.

**Scan** is the exception: a 56px circle in the gradient, lifted 34px above the
bar, with a `0 8px 18px rgba(57,119,255,0.25)` shadow and a white 23px icon.
Content must clear both the bar and the lift — that is what the 112px is for.

SydIN keeps its own floating-pill bar shape rather than this full-width slab. The
surface is borrowed; the shape is not.

---

## 7. The screens

### Home
Title "Today" with the date. Two figures side by side, **bare — no boxes, no
tint** — with one hairline under the pair: *Needs attention* (the count, gradient
clipped to the text, tap opens Alerts) and a second figure that must not sum
mixed units. Then **Running low** with "See all": thumbnail, name, reason
("Out of stock · 3 days", "Below 15 packs"), quantity **with its unit**, and the
status dot with its word. Then **Recent activity**: direction icon, product, note,
signed number.

### Items
Title with "10 products · 2 depots" and a view toggle on the right. One field,
"Search or scan". Chips: All · Low · Out · No photo — selected is filled ink with
white text. A meta line with the count and a Filter button. Then either the
**photo grid, two per row** (square photo, name over two lines, quantity with
unit, small status dot with word) or the compact list. Tap opens the item.

### Item detail
Back, name, `SKU · barcode` beneath. The **quantity is the largest thing on the
screen** — 54–72px — with its unit under it and the status. Then the alert line,
the photo, then plain rows: Category, Depot, Unit, Supplier, Cost, Price. One
gradient action: **Adjust stock**.

### Adjust stock
A sheet from the bottom, on glass. Grab handle, product name in serif, close. A
two-way segmented control **Add / Remove**. One very large centred number field
with a leading + or −. A Reason dropdown. One gradient button naming the result,
e.g. "Confirm +12".

### Scan
Dark, full bleed, no bottom bar. Close and torch at the top. A square viewfinder
with four corner brackets and a blue scan line. "Point at the barcode on the
carton" beneath. Three actions: **Find · Stock in · Stock out**. On a hit a glass
card rises: "Barcode recognized", the product, its barcode, its quantity, and
**Open item**. *Deliberately plain — this screen is not to be decorated.*

### Activity
Movements grouped by day under uppercase day headings; each row an icon, the
product, the note and time, and a signed number.

### More
Avatar, name, plan line, Upgrade. The same groups as the drawer.

### The rest
**Purchase Orders** list → order with its lines and "Mark as received".
**Receiving** list → tick-off screen with a progress line and "Confirm received".
**Suppliers** list → contact block, phone/email/terms, products supplied.
**Stock Counts** list → a dark counting screen: one product, expected quantity, a
huge number, and a 3×4 number pad with Clear and Next. Built for one thumb.
**Pick Lists** list → circular tick-offs, progress, "Pick N more" until complete.
**Categories / Depots** — name and count per row.
**QR Center** — a summary, tick products, "Print labels".
**Alerts** — grouped Urgent then Watch, each with a severity dot.
**Reports** — two figures, a line chart, top categories with bars.
**Import and Export** — export CSV, export Excel, import, and "Add many photos at
once · match photos to SKU names".
**Settings** — grouped rows with toggles.
**Help** — search, expanding answers, a support line.

### Before sign-in
**Landing** — wordmark and Sign in; hero with a glass brand mark, eyebrow,
"Know what is in your depot.", one line, **Start free**, "No card required".
Then what it does (three glass benefits), pricing in a glass panel, an FAQ, a footer.
**Sign in** — "Welcome back", Google and Microsoft, a divider, email and password,
Sign in, forgot password, a link to sign up.
**Sign up · Forgot password · Check email · Verify email · Signed out** — the same
shape, each with one action.
**Account** — avatar, name, email, then Edit profile, Change password, and Sign
out in red.

### Public product page
What a customer sees after scanning a carton. **No navigation, no bottom bar,
nothing private.** Centred photo, name in serif at 28px, `SKU · barcode`, and one
glass panel: "AVAILABILITY" over a 10px status dot and the state in words.

---

## 8. Interactions

- **Chips** filter immediately, no apply button. Selected is filled ink.
- **Search** filters as you type across name, SKU and barcode. A clear button appears once there is text.
- **The view toggle** swaps the photo grid for the compact list and back.
- **Tick-offs** (receiving, picking, QR) toggle on tap; ticked rows go muted and struck through, and the progress line updates.
- **Back** returns to the list the screen came from, never to browser history.
- **Loading** is a skeleton in the shape of the content — a title block and rows — never a spinner. *The prototype fakes 180ms of it on every navigation; do not copy that.*
- **Empty** is a small icon, one calm line saying what to do next, and one action.
- **Error** keeps the screen and states what failed in plain words; a failure never blanks the page.
- **A photo that is missing and a photo that fails to load look identical** — the same calm placeholder. The person cannot see the product either way.

---

## 9. Motion

| What | Duration | Easing |
|---|---|---|
| Page enter | 200ms | ease-out, 8px rise + fade |
| Sheet up | 200ms | ease-out, 24px rise + fade |
| Drawer in | 200ms | ease-out, 20px slide + fade |
| Scrim | 200ms | ease-out, fade |
| Tab colour | 200ms | ease |
| Row / card | 180ms | ease, colour only |
| Skeleton pulse | 1.15s | ease-in-out, alternating |

Nothing bounces, spins or scales on tap. Press feedback is opacity, not movement.
**Under reduced motion every animation collapses to 0.01ms** — things still
appear, they just do not travel.

---

## 10. Known faults in the prototype — do not copy

1. **`100vh` for full-height screens.** On iOS that includes the address bar, so the bottom of the Scan and Count screens falls below the visible area. Use `100dvh`.
2. **A faked 180ms loading skeleton on every navigation.** It performs slowness that does not exist.
3. **No real photos** — coloured plates with three-letter codes. Nothing about photo layout can be judged from it.
4. **Invented products and suppliers.** Sample only. SydIN's real vocabulary is SKU, item code, barcode, depot, category, supplier, and units of piece, box, pack, kilogram and litre.

---

## 11. Settled decisions

- **Items shows two photos per row on a phone.** Sayed, 2 Sep 2026, after holding it: *"two great cause it is phone."* A phone is what you hold next to the carton; matching a picture beats reading a name. The list stays one tap away.
- **A status dot never ships alone.** It is always paired with the state in words. Colour alone is not a label.
- **Every quantity carries its unit.** A depot holds boxes, pieces and kilograms; a bare number is meaningless, and mixed units must never be summed.

---

## 12. Still open

- Whether phone Home drops to the canvas's **two** figures, losing depots and inventory value from the phone entirely. Content decision, Sayed's.
