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
13. ◐ Invoice as a document: number, dates, company block, customer, lines with photos, totals, paid, balance, terms, notes, footer. ✅ due date on the form (13 Sep). ✗ discount/tax lines (schema — own sprint). ☐ signature area.
14. ◐ Document family on `documentPdf.ts`: invoice, purchase order, ✅ goods-received note per delivery with signature lines (13 Sep), ✅ payment receipt on every invoice/PO payment (13 Sep), ✅ customer statement from the customer account sheet (13 Sep). ☐ quote.
15. ✅ Company branding: name, logo, address, phone, email, website, tax/reg no., currency, payment terms, footer. ☐ document prefix/numbering, accent colour.
16. ✅ Live document preview while editing (edit left / preview right) on New invoice and New purchase order, updating on every keystroke; stacks under the form on a phone (13 Sep).
17. ◐ Exports: PDF + Word + Excel for invoice/PO; inventory PDF/Excel; reports PDF/CSV.
18. ✅ Exports actually tested (rendered in Node, read page by page: long names, many lines, empty fields, logo, thumbnails).
19. ✅ Multi-page: headers repeat, footer + page numbers on every page.
20. ✅ Item photos in documents (thumbnail column) and in PO picker/lines, invoice lines, receiving table.
21. ◐ Reporting: sales by month, outstanding invoices, ✅ top-selling items, ✅ sales by customer (13 Sep), purchases by supplier/month, inventory reports, ✅ sales by category, ✅ payments by method — cash in vs cash out, net (13 Sep). ☐ stock aging.
22. ☐ Report builder (date range, columns, grouping, saved reports).
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
35. ◐ Viewports: 375 and 1130/1440 checked routinely; 768/1024/1920 spot-checked.
36. ◐ Mobile operations: Home, Items, Item detail, More done per canvas; Scan untouched by instruction.
37. ◐ Design system: shared FieldGroup/FieldRow, Button, DialogShell, Badge, Select, SearchInput, toasts; `globals.css` still carries stacked redesigns.
38. ◐ Status system: Draft / Ordered / Partially received / Received / Cancelled; Unpaid / Partially paid / Paid; Issued / Paid. Tones consistent on PO and sales.
39. ✅ Document status timelines: Created → Ordered → Received → Paid on the order dialog, Draft → Issued → Paid on the invoice page; cancelled ends in a stopped step (13 Sep).
40. ◐ Relationships: PO → supplier, receipts, payments, movements shown on the order; invoice → customer, payments. ☐ supplier bill link.
41. ◐ Related documents: on the item page (all its invoices and orders); orders show their deliveries and payments; invoices their payments. ☐ supplier bill / statement links.
42. ✅ Customer account view: sales, balance, documents.
43. ✅ Supplier account view: orders, receiving, balance.
44. ◐ Conveniences: PO from low stock (Alerts), receiving from PO, invoice from customer page, inline create customer/depot; ✅ last depot and payment method come back pre-filled on invoice, PO and Stock In; ✅ Duplicate on any order or invoice — same supplier/customer, lines and currency, new number (13 Sep).
45. ✅ Low stock → PO → receive flow.
46. ◐ Report exports (PDF/CSV) per report; ☐ filters before export.
47. ◐ Branded PDF reports: title, date, table, totals, page numbers.
48. ✅ Word export for invoice and PO (real DOCX).
49. ◐ Excel: numeric cells, currency formats; inventory Excel converts to the shown currency.
50. ◐ Realistic test data: used for PDF rendering; live DB kept clean (no seed set).
51. ◐ Long-data tests: done for documents; not for every screen.
52. ◐ States: loading/empty/error present on all list pages.
53. ◐ Accessibility: dialogs focus/escape, labels, aria-pressed chips, touch targets from earlier audit.
54. ◐ Performance: inventory windowed at 60; images sized; no 500-item live test yet.
55. ✅ Business logic preserved; schema changes additive (phases 23–26), all applied live.
56. ◐ Full journey tested: item → PO (photos) → export → receive part → verify stock → receive rest → PO complete → record payment → customer → sale → invoice → PDF/Word/Excel → customer payment → balance. ☐ supplier bill, customer statement, report exports in one run.
57. ✅ Business language everywhere touched ("Stock In", "Receive stock", no dev-speak).
58. ✅ No feature added without a workflow reason.
59. ◐ Final standard: clear, calm, consistent — continuing.
60. ◐ Final full-app audit — the earlier page-by-page audit covers it; recheck after these changes.
61. ◐ Bug hunt: dead buttons, wrong routes, overflow, console errors — ongoing.
62. ◐ Screenshot review of every important screen — ongoing.
63. ◐ Quality gate list — see statuses above.
64. ◐ Final report — to be written when the ☐ items are settled or scheduled.

## Added on top of the prompt (Sayed, later the same day)

- ✅ Currency: prices stored in a base currency; the app shows any currency at
  a live or typed rate; invoices/POs choose their currency and keep the day's
  rate; sums add up in base. (12 Sep)
- ✅ Inventory card values exact under 10,000. (12 Sep)
- Standing: **push later** — commit locally, push when Sayed says.

## Where the state lives

- Plan and order of work: `docs/SYDIN_PLAN_OF_RECORD.md` (section N and "What is left").
- What each sprint changed: `docs/SYDIN_SPRINT_LOG.md`.
- Settled decisions: `docs/SYDIN_DECISION_LOG.md` (currency decision 12 Sep).
- Database: live project `hllktjhewivxqumqktzj`; phases 23–26 applied through
  the Supabase connector; SQL files in `sql/` mirror them.
