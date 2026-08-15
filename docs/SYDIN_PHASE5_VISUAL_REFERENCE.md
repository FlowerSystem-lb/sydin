# SydIN — Phase 5 Visual Reference (Steep-inspired)

Captured 2026-08-15. Sayed shared the "Steep" design system (styles.refero.design) as
inspiration. This is **not a decision** — nothing here is implemented. It's the reference
Phase 5 (colors/shape/motion, per [SYDIN_ROADMAP.md](SYDIN_ROADMAP.md)) should start from.
Full raw token dump lives in the chat history if the exact hex/px values are ever needed again;
this file is the distilled take.

## What to take from Steep

Structural discipline, not its skin:
- **One accent color, rationed.** Steep uses peach for exactly one card type, never as a
  background. SydIN should do the same with **its own existing blue accent** (the
  `#10c4dc → #2563eb → #7d5cff` gradient already shipped on every primary button/logo) —
  not a new color. Don't introduce peach; SydIN already has brand color, this system is
  about using it *less randomly*, not replacing it.
- **One radius scale**, small set of named values (cards / inputs / buttons), not the current
  12+ ad-hoc radii in `globals.css`.
- **Quiet shadows.** Content cards get none; only truly "floating" elements (modals, popovers,
  dropdowns) get a shadow, and it's barely-there. SydIN's cards currently have visible shadow
  on everything — flatten most of them.
- **A real token table with roles**, not just hex values — every color/spacing token states
  *why* it exists and where it's used. Worth doing this for SydIN's own consolidated token set
  in Phase 0/5 regardless of Steep.
- **Named type scale with intent** (caption/body/heading/display), each with its own
  line-height and tracking — more disciplined than SydIN's current ad-hoc Tailwind sizes.

## What NOT to take

- **Serif display headlines at 44–90px.** This is a magazine-spread technique for a marketing
  page read once. SydIN's dashboard is used dozens of times a day for scanning and data entry —
  serif display type there would read as decoration fighting the task, not authority. If used at
  all, confine to the **public marketing site** (landing/pricing/features), never the dashboard
  shell, tables, or forms.
- **Peach/brown accent pair.** SydIN's blue is already shipped across dozens of components.
  Swapping the whole app's accent for an unrelated color is churn with no functional upside.
- **90% white canvas with near-zero chrome.** SydIN's dashboard needs visible structure (table
  borders, card edges, section separation) because it's dense operational data, not an editorial
  scroll. Steep's "everything floats on white" only works because it has very little on screen
  at once.

## Where each idea actually applies

| Steep idea | Dashboard (Inventory, Settings, Pick Lists, ...) | Public site (landing, pricing, features) |
|---|---|---|
| Serif display headlines | No — stays sans-serif | Maybe — could differentiate SydIN from generic SaaS |
| Blue accent, rationed | Yes — one accent, used with intent, not five gradients | Yes |
| Soft radius scale | Yes — pick one small set of values | Yes |
| Near-zero shadow on cards | Yes — flatten most cards, keep it for modals/popovers only | Yes |
| Pill-shaped buttons | Maybe — evaluate against existing `dashboard-action-button` in Phase 5 | Yes, fits marketing tone |
| "Floating artifact" hero collage | No — not a dashboard pattern | Yes — landing page hero could use this instead of a static screenshot |

## Next step (Phase 5, not now)

When Phase 5 starts: build SydIN's own token table in this same role-annotated format, using
SydIN's existing blue accent instead of peach, and decide the radius/shadow scale once —
replacing the 12+ ad-hoc radii and 507 `!important`-driven shadow rules currently in
`globals.css`. See [SYDIN_ROADMAP.md](SYDIN_ROADMAP.md) Phase 5 and the master plan for sequencing.
