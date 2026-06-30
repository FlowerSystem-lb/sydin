# SydIN — Mobile Roadmap

Mobile is a **first-class product**, not a shrunk desktop. On a phone, SydIN is a fast,
scan-first tool someone uses while standing in a warehouse or stockroom. This doc defines how
mobile should feel and the order to build it. Responsive rules for current pages live in
[SYDIN_UI_RULES.md](SYDIN_UI_RULES.md); module wiring in
[SYDIN_MODULE_ARCHITECTURE.md](SYDIN_MODULE_ARCHITECTURE.md).

---

## Mobile principles

1. **Scan-first.** The fastest path to "find/receive/move an item" is the camera, not typing.
2. **Thumb-friendly.** Large touch targets, reachable primary actions, no tiny desktop controls.
3. **One job per screen.** Don't cram desktop multi-pane layouts onto a phone.
4. **Fast and forgiving.** Skeletons over spinners; clear empty/error states; minimal taps.
5. **Glanceable.** Mobile dashboard answers "what needs attention right now?" instantly.

---

## Target mobile shell

**Bottom navigation (5 tabs):**

| Tab | Purpose |
|---|---|
| **Home** | Mobile dashboard: alerts, low stock, recent activity, quick actions. |
| **Inventory** | Mobile item list + search/filter; tap to item details. |
| **Scan** | Center action — opens the scanner with mode selection. |
| **Activity** | Recent company activity / timeline feed. |
| **More** | Reports, settings, import/export, account. |

- Mobile **item cards** optimized for small screens (image, name, qty, status, key tags).
- **Fast scanner mode**: open → ready/beep → result → next, with minimal chrome.

---

## Phased mobile build

| Stage | Scope | Roadmap phase | Notes |
|---|---|---|---|
| **M1 — Mobile QA of foundation** | Inventory, Categories, Item Details, Add/Edit on phones; states; touch targets | Phase 1 (Sprint 7) | No new features — make existing screens excellent on mobile. |
| **M2 — Mobile shell** | Bottom nav, mobile dashboard, mobile item list/cards | Phase 2 | Establishes the app feel. |
| **M3 — Scan-first** | Fast scanner mode + scanner modes on mobile | Phase 2 | Pairs with the Scanner workspace. |
| **M4 — Mobile alerts** | Stock alerts + notification surfacing on mobile | Phase 3 | After notification center. |
| **M5 — Offline & push** | Offline capture, push notifications | Phase 4+ | Later; needs infra + careful data sync. |

---

## Priorities & guardrails

- **Sprint 7 (Mobile Inventory QA)** is the near-term mobile milestone — it's QA/polish, not
  new features.
- Offline mode and push notifications are **later** (P2/P3); they add real complexity and
  must not block launch.
- Mobile work still obeys the untouchables: no auth/Supabase/schema/routing/business-logic
  changes without an explicit approved sprint.
