# SydIN — UI Redesign v2 brief (5 October 2026)

Sayed pasted this on 5 Oct 2026, right after the data-entry audit (plan of record,
section R). It is the standing mission for the UI upgrade. **This file is the brief
and its status checklist only. The order of work lives in the plan of record
(section R), which stays the only plan.** It is kept here so a context reset does
not narrow it.

His words, condensed faithfully. The headings are his 27 points.

1. **Role.** Act as a senior product designer, UI/UX designer, design-systems
   architect and frontend engineer. Make it a premium commercial SaaS product, not a
   generic dashboard template.
2. **Audit first.** Look at every route, sidebar item, button, dialog, form, table,
   card, dropdown, filter, search, empty/loading/error state, mobile layout, flow,
   type, spacing and repeated pattern. Never remove functionality to redesign; redesign
   the interaction instead.
3. **A real visual reset**, more than changing the blue, radius, shadows or fonts.
   Use Linear, Vercel, Stripe, Notion and Shopify for the quality bar, without
   copying them.
4. **Brand:** professional, smart, fast, organized, reliable, modern, business-focused,
   premium. For small businesses, retail, warehouses, purchasing, sales and owners. It
   must not look like a school project or basic CRUD.
5. **Colour:** don't make everything blue. White / off-white / graphite / charcoal /
   black / greys, SydIN blue as the accent, and a few chosen secondary colours. Primary
   = blue, secondary = neutral, success = sophisticated green, warning = amber, error =
   refined red, info = blue/cyan. No rainbow. Colour carries meaning.
6. **A real design system:** typography hierarchy (page title, section title,
   subtitle, body, label, metadata, numbers, table text, captions) in a professional
   font, spacing rules, a radius system, borders, intentional shadows, elevation levels
   and one icon style.
7. **Workspace/Overview:** compact, intelligent hierarchy. Compact metrics, inventory
   health, low stock, activity, sales/purchases, quick actions, insights, useful charts,
   smart empty states. No giant cards and no wasted space.
8. **Sidebar:** premium navigation with clear groups, a subtle active state, icon +
   label, business identity, collapsible with tooltips, and account/settings at the
   bottom. Not crowded.
9. **Tables & Inventory:** column hierarchy, row height, hover, selection, sorting,
   filtering, search, pagination, bulk actions, stock indicators, thumbnails, badges,
   quantity and price formatting, responsive.
10. **Product pages:** image, information hierarchy, stock status, pricing, SKU/code,
    category, location, history, actions and editing, using hierarchy rather than
    equal-weight cards.
11. **Forms:** clean, fast, predictable, spacious. Clear labels, help text, inline
    validation, grouping, defaults, keyboard-friendly, clear primary/secondary actions.
    Sections or steps where long.
12. **Modals & drawers:** choose modal / drawer / popover / inline / page by context.
    Strong title, description, obvious actions, spacing, keyboard, Escape, loading and
    validation.
13. **Motion:** subtle and fast. Page transitions, sidebar, buttons, hover, modals,
    dropdowns, tables, success, loading, data updates. Never over-animated.
14. **Glass/depth:** allowed carefully (translucency, soft gradients, layered depth).
    Premium enterprise, not gaming.
15. **Login/landing:** memorable and brand-connected rather than "logo + centered white
    card". Split screen, product visuals, animated data, statistics, brand story. It
    should say "serious business platform".
16. **Empty states:** never just "No data". Explanation, a visual, a primary action
    and guidance.
17. **Loading:** skeletons for pages, tables and charts, plus button loading states.
    Few spinners.
18. **Responsive:** desktop, laptop, tablet and phone, adapting layouts rather than
    shrinking them.
19. **Mobile:** a real product. Bottom nav, touch actions, swipe, compact headers,
    drawers, simpler hierarchy.
20. **Simplify:** for every workflow, ask whether it can be faster: add product, stock
    in/out, search, invoices, stock history, reports.
21. **Consistency pass** after the redesign: buttons, colours, spacing, type, icons,
    cards, modals, states, mobile.
22. **Accessibility:** contrast, keyboard, focus, semantics, labels, text size, touch
    targets.
23. **Performance:** no heavy animation, images, blur, re-renders or dependencies.
24. **Shared components improved globally**, not as one-off copies.
25. **Don't break anything:** features, routes, logic, database, APIs, permissions,
    workflows, auth, responsiveness. No fake or placeholder data.
26. **Final QA:** every page and workflow, desktop + mobile, hover/active/focus/loading/
    success/error/empty/disabled/modal/drawer/nav/forms/tables.
27. **Be bold.** He gives explicit permission for major visual decisions. Replace bad
    layouts and refactor limiting components. Don't ask permission for each visual call.
    Goal: "This looks like a real premium SaaS product", not "someone changed the CSS".

## How it is being done (my call, recorded in the decision log)

Bold, but staged, because every push goes live to paying-ready production. One
layer per commit. Each layer is checked in a running copy of the app before it ships.
SydIN's untouchables still hold: no auth, database, routing or business-logic changes.
Mobile stays last (his 5 Oct instruction).

## Status

| # | Area | State |
|---|---|---|
| 2 | Audit | ◐ forms done (plan R); rest audited per phase as each is reached |
| 5–6 | Colour + design system (font, type, palette, radius, elevation, fields) | ✅ Phase 1 live 5 Oct (fdecb30) |
| 11 | Forms | ◐ look (Phase 1) + speed (Phase 3) done; PO layout next |
| 8 | Sidebar + header | ◐ Phase 2: graphite rail built (top bar unchanged) |
| 7 | Overview | ◐ figure strips + quick actions (phase 4); chart/attention next |
| 9–10 | Inventory table + item page | ◐ badges, strip, item panel, full item page redesign + section PDFs; table polish next |
| 12 | Dialogs/drawers | ◐ DialogShell restyled (v2); slide-overs keep their own style |
| 16–17 | Empty + loading states | ◐ empty states restyled (36); skeletons already in place |
| 15 | Login/landing | ✅ already split-screen + brand visual; fields aligned to v2 |
| 13–14 | Motion + depth | ☐ alongside each phase |
| 21–22, 26 | Consistency, accessibility, final QA | ◐ desktop consistency pass done (5 parts); phone + public pages remain |
| 18–19 | Responsive + mobile | ☐ last |
