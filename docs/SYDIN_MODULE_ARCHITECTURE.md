# SydIN — Module Architecture

How SydIN is organized into modules, where each lives in the repo, and how they connect.
This complements [SYDIN_PRODUCT_BRAIN.md](SYDIN_PRODUCT_BRAIN.md) (architecture overview) by
going module-by-module. Keep this current as modules are added.

> Engineering guardrail: this doc is a **map**, not a license to change wiring. Never modify
> auth, Supabase logic, DB schema, routing, or business logic without an explicit approved
> sprint.

---

## Layering

```
app/dashboard/<route>/page.tsx      ← screen (composition + state)
        │ uses
components/dashboard/Workspace.tsx   ← shared dashboard primitives (one file)
components/ui/*                      ← generic UI kit
components/inventory/*               ← inventory-specific components
        │ calls
app/lib/*.ts                         ← data + domain helpers (Supabase access lives here)
        │ talks to
Supabase                             ← auth + database (do not touch schema)
```

- **Screens** live in `app/dashboard/<route>/page.tsx`. They compose primitives and call
  `app/lib` helpers; they should not embed raw Supabase queries when a helper exists.
- **Shared primitives** are all exported from one file:
  [components/dashboard/Workspace.tsx](../components/dashboard/Workspace.tsx). The app shell
  and navigation live in [components/dashboard/DashboardShell.tsx](../components/dashboard/DashboardShell.tsx)
  and [components/dashboard/navigation.ts](../components/dashboard/navigation.ts).
- **Domain helpers** in [app/lib/](../app/lib/) encapsulate data access and business logic.

---

## Module map

| Module | Screen(s) | Key helpers / components |
|---|---|---|
| **Dashboard / Overview** | `app/dashboard/page.tsx` | `InventoryValueOverview.tsx`, `app/lib/inventoryReports.ts` |
| **Inventory** | `app/dashboard/inventory/page.tsx`, `inventory/[id]`, `EditItemForm.tsx` | `app/lib/inventoryItemModel.ts`, `inventoryHistory.ts`; `components/inventory/InventoryItemCard.tsx`, `ItemDetailsSlideOver.tsx`, `StockMovementDialog.tsx` |
| **Add Item** | `app/dashboard/add-item/page.tsx` | `inventoryItemModel.ts`, `categories.ts` |
| **Categories** | `app/dashboard/categories/page.tsx` | `app/lib/categories.ts`, `sql/phase-6a-categories.sql` |
| **Depots (locations)** | `app/dashboard/depots/page.tsx` | `app/lib/depots.ts` |
| **Suppliers** | `app/dashboard/suppliers/page.tsx` | `app/lib/suppliers.ts`, `sql/phase-4c-suppliers.sql` |
| **Stock Movements** | `app/dashboard/stock-movements/page.tsx` | `app/lib/stockMovements.ts` |
| **Stock Counts** | `app/dashboard/stock-counts/page.tsx` | (counts logic) |
| **Receiving** | `app/dashboard/receiving/page.tsx` | links Suppliers → Inventory |
| **Purchase Orders** | `app/dashboard/purchase-orders/page.tsx` | `app/lib/purchaseOrderPdfExport.ts` |
| **Pick Lists** | `app/dashboard/pick-lists/page.tsx`, `pick-lists/[id]` | `app/lib/pickLists.ts`, `sql/phase-7-pick-lists.sql` |
| **Import / Export** | `app/dashboard/inventory/import/page.tsx` | `inventoryImport.ts`, `inventoryExcelExport.ts`, `inventoryPdfExport.ts` |
| **QR Center / Labels** | `app/dashboard/qr-center/page.tsx` | `app/lib/qrLabelPdf.ts`, `react-qr-code` |
| **Reports** | `app/dashboard/reports/page.tsx` | `app/lib/inventoryReports.ts` |
| **Settings** | `app/dashboard/settings/page.tsx` | `app/lib/businessSettings.ts`, `theme.ts` |
| **Help** | `app/dashboard/help/page.tsx` | `app/lib/helpContent.ts`, `support.ts` |
| **Search (global)** | `components/dashboard/GlobalSearchDialog.tsx` | — |
| **Auth** | `app/login`, `app/signup` | `app/lib/supabase.ts`, `authNavigation.ts`, `components/auth/*` — **do not modify** |
| **Billing / Plans** | `app/request-plan`, `app/admin/plan-requests`, `app/api/admin/*` | `app/lib/subscription.ts`, `adminAuth.ts`, `supabaseAdmin.ts` — see [SYDIN_PAYMENTS_STRATEGY.md](SYDIN_PAYMENTS_STRATEGY.md) |
| **Marketing site** | `app/page.tsx`, `features`, `pricing`, `demo`, `contact`, `privacy`, `terms` | `components/Marketing.tsx` |

---

## Cross-module flows (target design)

**Inbound stock:** `Supplier → Purchase Order → Receiving (finalize) → Inventory update →
Stock Movement → Item Timeline → Reports`. Stock should change **only when receiving is
finalized**, not when a PO is drafted.

**Outbound / movement:** `Item → Stock Movement (issue / transfer) → Item Timeline → Reports`.

**Scanner (future):** a fast front-door into the above — scan resolves to an item, then the
selected **mode** (Lookup/Receive/Issue/Transfer/Count/…) routes into that module's action.

**Alerts (future):** `Item threshold → Stock Alert → Notification Center (+ email/push) →
optional Automation (draft PO)`.

**Activity/Timeline (future):** every module emits events (created/edited/moved/qty-changed/
assigned/returned/QR-generated/label-printed/archived) into a shared feed and per-item timeline.
This is the backbone the Notification Center, AI Assistant, and Reports build on — which is why
it sits early in Phase 3.

---

## Dependency order (why the roadmap is sequenced this way)

1. **Clean item data model + Item Details + Add/Edit** must be solid first — everything reads
   from items.
2. **Activity/Timeline** unlocks Notifications, Alerts, AI, and Item history.
3. **Reports** depend on consistent Stock Movements + finalized Receiving.
4. **AI / Automation** are last because they need clean, consistent data and event streams.

See [SYDIN_ROADMAP.md](SYDIN_ROADMAP.md) for the concrete sprint sequence.
