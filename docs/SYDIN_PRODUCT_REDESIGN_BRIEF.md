# SydIN — Product Redesign Brief (Sayed, 12 September 2026)

Sayed's "COMPLETE PRODUCT REDESIGN, UX AUDIT, WORKFLOW ARCHITECTURE & PRODUCTION
UPGRADE" prompt, kept here in full so it survives any session. He asked for it
to be executed — inspect → redesign → implement → screenshot → test → fix —
not summarised. Work is done one surface per commit, verified in the running
app (which writes to the LIVE Supabase project — never leave test rows).

Status key: ✅ done · ◐ partly · ☐ not started · ✗ deliberately not (with reason)

## The 64 points

1. ✅ Understand SydIN first (repo, data model, routes, nav, logic, exports).
2. ◐ Research real products (Sortly, Zoho, Odoo, Cin7, Katana…) for workflow, terminology, sidebar, receiving, invoicing, photos, mobile — applied from knowledge; no fresh web pass.
3. ✅ Rethink structure around Inventory / Sales / Purchasing / Receiving / Payments / Documents / Reports / People / Settings.
4. ✅ Sidebar by business workflow: Daily work · Buying · Selling · Stock control · Insight · Settings & help. Opens on hover, pins with the chevron.
5. ✅ Workflow-first: PO → Stock In → payment linked (Deliveries expected on Stock In, receipts on the order).
6. ✅ Receiving is first-class: "Stock In" naming; ordered / received / remaining; Partially received status.
7. ✅ Receiving screen: PO, supplier, dates, per line ordered / received so far / arriving now, photo, name, code, unit, note.
8. ✅ Partial receiving: multiple deliveries recorded (`purchase_order_receipts`), close short.
9. ✅ Stock movements carry reason + reference (existing) and now the receipt that caused them.
10. ✅ Sales workflow: customer → lines → invoice → payment → paid (existing; currency added).
11. ✅ Daily operation view: Overview has a "Today" line (sold today, units in, units out, or "nothing yet"), the month's money figures, action required and recent activity (13 Sep).
12. ✅ Payments: partial/full, outstanding, method, date, note (existing ledgers on invoices and POs).
13. ✅ Invoice as a document: number, dates, company block, customer, lines with photos, totals, paid, balance, terms, notes, footer. ✅ 20 Sep: due date under the amount owed ("Paid in full" when settled), payment terms as their own block, line numbers, closing block never split across pages; Word export in step. ✅ due date on the form (13 Sep). ✅ signature area — "Authorized by" / "Customer signature" (13 Sep). ✗ discount/tax lines (schema — own sprint).
14. ✅ Document family on `documentPdf.ts`: invoice, purchase order, goods-received note per delivery with signature lines, payment receipt on every invoice/PO payment, customer statement from the customer account sheet, quote — a draft invoice downloads as one automatically (no paid/balance, "Valid until" not "Due"), same record, same number; issuing it later is what turns it into the real invoice (13 Sep).
15. ✅ Company branding: name, logo, address, phone, email, website, tax/reg no., currency, payment terms, footer, ✅ accent colour (13 Sep) — the bar on every invoice/PO/receipt/statement/report; picker in Settings › Company, `business_settings.accent_color` (phase 27). ☐ document prefix/numbering — invoice/PO numbers already continue whatever pattern was last used or derive from the depot, so a fixed prefix setting is lower value; left open, not attempted.
16. ✅ Live document preview while editing (edit left / preview right) on New invoice and New purchase order, updating on every keystroke; stacks under the form on a phone (13 Sep).
17. ✅ Exports: PDF + Word + Excel for invoice/PO (Excel was missing for invoices — PO had all three, invoice only had PDF and Word; added `salesInvoiceExcelExport.ts`, 15 Sep); inventory PDF/Excel; reports PDF/CSV. Word export for both invoice and PO structurally verified — a real .docx generated, unzipped, and read: embedded logo, correct totals, dynamic page-number fields, long content preserved, the PO's Ordered/Received columns and receiving-progress row (16 Sep).
18. ✅ Exports actually tested (rendered in Node, read page by page: long names, many lines, empty fields, logo, thumbnails).
19. ✅ Multi-page: headers repeat, footer + page numbers on every page.
20. ✅ Item photos in documents (thumbnail column) and in PO picker/lines, invoice lines, receiving table.
21. ✅ Reporting: sales by month, outstanding invoices, top-selling items, sales by customer, purchases by supplier/month, inventory reports, sales by category, payments by method (cash in vs cash out, net), stock aging — oldest-idle-first, never-moved items called out separately (13 Sep).
22. ◐ Report builder. ✅ date range, applied to every sales/purchase/payment report at once (14 Sep) — Sayed's pick, over a full custom-columns builder, when asked which was worth building first. ✅ on-screen preview (20 Sep): a money report opens as a table in a sheet first, PDF and CSV one tap from there — the phone no longer downloads a file blind. ☐ columns, grouping, saved reports.
23. ✅ Dashboard hierarchy: figures → action required → recent activity.
24. ✅ Quick actions: Add menu has New item · New invoice · Purchase order · Stock In · New customer (13 Sep). Record payment stays on the document it belongs to.
25. ✅ Global search: items, customers, suppliers, invoices, POs — typed results.
26. ✅ Item detail as source of truth: photo, codes, stock, movement history, and "Documents with this item" — every invoice and purchase order it is on, with quantity, price in the document's currency, received-so-far and status (13 Sep).
27. ✅ Settings rebuilt: Company · Account · Inventory · Plan & billing · Data & reports, one row style, business words.
28. ✅ Help Center rebuilt: searchable articles by category.
29. ✅ Contextual help links on receiving, Stock In, invoice payments.
30. ✅ Sidebar expand/collapse: toggle visible in rail, hover-open, one logo, no header wrap.
31. ✅ Empty space audit on major pages (ongoing).
32. ◐ Interaction polish: toasts, dialogs, unsaved-changes guard exist; page transitions modest.
33. ◐ Button audit done page by page in the earlier audit; keep checking new surfaces.
34. ✅ Visual QA by screenshot for every change (standing practice).
35. ✅ Viewports: 375 / 768 / 1024 / 1280 / 1440 / 1920 all measured during the 16–20 Sep redesign; 375 and desktop re-checked after every phone unit on 20 Sep.
36. ✅ Mobile operations: every phone page in one app language (20 Sep) — Home, Items, Item, Customers, Suppliers, Sales, POs, Categories, Depots, Movements, Activity, Reports, Settings, More, the save bars on the forms, the tile action sheet; installable (manifest + icons). Scan untouched by instruction.
37. ◐ Design system: shared FieldGroup/FieldRow, Button, DialogShell, Badge, Select, SearchInput, toasts; `globals.css` still carries stacked redesigns.
38. ✅ Status system: Draft / Ordered / Partially received / Received / Cancelled; Unpaid / Partially paid / Paid; Issued / Paid. One tone map (draft neutral · in-flight accent · partial warning · done success · cancelled danger) through the shared Badge on both PO and Sales (20 Sep — Sales had its own hand-rolled pill).
39. ✅ Document status timelines: Created → Ordered → Received → Paid on the order dialog, Draft → Issued → Paid on the invoice page; cancelled ends in a stopped step (13 Sep).
40. ✅ Relationships: PO → supplier, receipts, payments, movements shown on the order; invoice → customer, payments. The order's uploaded proof is now labelled "Supplier bill", not "Attachment"; a supplier's order list flags which orders have one ("Bill on file") without opening each order (14 Sep).
41. ✅ Related documents: on the item page (all its invoices and orders); orders show their deliveries and payments; invoices their payments. Supplier statement PDF from the supplier account sheet — mirrors the customer statement, money reversed (14 Sep).
42. ✅ Customer account view: sales, balance, documents.
43. ✅ Supplier account view: orders, receiving, balance.
44. ◐ Conveniences: PO from low stock (Alerts), receiving from PO, invoice from customer page, inline create customer/depot; ✅ last depot and payment method come back pre-filled on invoice, PO and Stock In; ✅ Duplicate on any order or invoice — same supplier/customer, lines and currency, new number (13 Sep).
45. ✅ Low stock → PO → receive flow.
46. ✅ Report exports (PDF/CSV) per report; a date range above the report grid narrows every sales, purchase and payment report before export (Stock Aging is a snapshot of today and ignores it) — the range is stated in the exported file's own subtitle (14 Sep).
47. ✅ Branded PDF reports: title, date, table, totals, page numbers. Stress-tested with a synthetic 60-row report forced across 3 pages: repeated header/logo and column headings on every page, correct running total, no clipped rows, no footer overlap (15 Sep).
48. ✅ Word export for invoice and PO (real DOCX).
49. ◐ Excel: numeric cells, currency formats; inventory Excel converts to the shown currency.
50. ◐ Realistic test data: used for PDF rendering; live DB kept clean (no seed set).
51. ◐ Long-data tests: done for documents; 20 Sep — the phone rows (Customers, Sales, Purchase Orders) tried with 70-character names and a 22-character amount in the live DOM: no page overflow, row height unchanged, names truncate with an ellipsis, digits never hidden. Not yet every screen.
52. ◐ States: loading/empty/error present on all list pages.
53. ✅ Accessibility: dialogs focus/escape, aria-pressed chips from the earlier audit; 20 Sep sweep of nine pages — no unnamed buttons, no missing alt; FieldRow now wires its label to the control (39 rows were unconnected); Notes/title/file inputs labelled; sub-24px targets brought to 24px.
54. ✅ Performance: inventory windowed at 60; photos resized to 1600px before upload (19 Sep); 500-item test run 20 Sep on the production build with the list query intercepted in the browser (nothing written): no long tasks, every "Show more" < 50ms, search 32–41ms, 46MB heap fully expanded. Fixed on the way: search-clear re-rendering the whole expanded list, table view rendering both layouts, mobile alert badge capped at 100 rows.
55. ✅ Business logic preserved; schema changes additive (phases 23–26), all applied live.
56. ✅ Full journey tested: item → PO (photos) → export → receive part → verify stock → receive rest → PO complete → record payment → customer → sale → invoice → PDF/Word/Excel → customer payment → balance, done in pieces across sprints. Customer statement, payment receipt, invoice PDF/Word/Duplicate and the report date range checked live against Sayed's real account on 14 Sep (read-only exports, nothing changed); supplier statement checked live on a real supplier with no orders yet (the empty-state path) since no order on file carries both a supplier and an uploaded bill to click through with real data.
57. ✅ Business language everywhere touched ("Stock In", "Receive stock", no dev-speak).
58. ✅ No feature added without a workflow reason.
59. ◐ Final standard: clear, calm, consistent — continuing.
60. ◐ Final full-app audit — the earlier page-by-page audit covers it; recheck after these changes.
61. ◐ Bug hunt — 20 Sep sweep: every internal link from the main pages fetched (38, all respond); console clean on Overview / Inventory / POs / Sales; missing-item and missing-invoice pages now use the shared empty state (were a hand-rolled card and a red line). Phone overflow sweep clean. Ongoing as surfaces change.
62. ◐ Screenshot review of every important screen — ongoing.
63. ◐ Quality gate list — see statuses above.
64. ◐ Final report — to be written when the ☐ items are settled or scheduled.

## Added on top of the prompt (Sayed, later the same day)

- ✅ Currency: prices stored in a base currency; the app shows any currency at
  a live or typed rate; invoices/POs choose their currency and keep the day's
  rate; sums add up in base. (12 Sep)
- ✅ Inventory card values exact under 10,000. (12 Sep)
- ✅ Top-bar breadcrumb ("Selling / Sales") on the plain top-level pages;
  hidden where a page already prints its own on-screen heading (Overview,
  Inventory), same as before. (14 Sep)
- ✅ A real 14-day sparkline on the Overview "Sold this month" figure —
  daily totals, today drawn solid. Not added to Customers-owe/Owe-suppliers:
  those are snapshot balances, not a daily flow, and a trend line there
  would need the whole payment history replayed per day to be honest, not a
  quick pass. Sayed sent a reference dashboard screenshot and asked for an
  opinion first; this and the breadcrumb were the two pieces recommended and
  approved — bulk row selection and a real trend chart were also identified
  as worth having but scoped to their own sprints, not done today. (14 Sep)
- Standing: **push as we go** — Sayed has been asking for this each sprint
  since 13 Sep; commit and push once verified, don't hold commits back.

## Where the state lives

- Plan and order of work: `docs/SYDIN_PLAN_OF_RECORD.md` (section N and "What is left").
- What each sprint changed: `docs/SYDIN_SPRINT_LOG.md`.
- Settled decisions: `docs/SYDIN_DECISION_LOG.md` (currency decision 12 Sep).
- Database: live project `hllktjhewivxqumqktzj`; phases 23–26 applied through
  the Supabase connector; SQL files in `sql/` mirror them.
