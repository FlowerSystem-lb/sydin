import ExcelJS from "exceljs";
import { supabase } from "@/app/lib/supabase";

/*
 * "Download all my data" (Settings > Account). One Excel file, one sheet per
 * kind of record, every column as stored. Read-only: it only selects, and the
 * database's own rules (RLS) decide what this login may see -- the user_id
 * filter below is for speed, not for safety. Tables without a user_id (lines
 * of invoices, orders, pick lists, receipts) are scoped by RLS through their
 * parent.
 */

const SHEETS: Array<{ table: string; sheet: string; ownRows: boolean }> = [
  { table: "business_settings", sheet: "Business", ownRows: true },
  { table: "inventory", sheet: "Items", ownRows: true },
  { table: "categories", sheet: "Categories", ownRows: true },
  { table: "depots", sheet: "Locations", ownRows: true },
  { table: "stock_movements", sheet: "Stock movements", ownRows: true },
  { table: "inventory_history", sheet: "Item history", ownRows: true },
  { table: "inventory_depot_transfers", sheet: "Transfers", ownRows: true },
  { table: "inventory_assets", sheet: "Assets", ownRows: true },
  { table: "asset_events", sheet: "Asset events", ownRows: true },
  { table: "customers", sheet: "Customers", ownRows: true },
  { table: "sales_orders", sheet: "Invoices", ownRows: true },
  { table: "sales_order_lines", sheet: "Invoice lines", ownRows: false },
  { table: "sales_order_payments", sheet: "Invoice payments", ownRows: true },
  { table: "suppliers", sheet: "Suppliers", ownRows: true },
  { table: "purchase_orders", sheet: "Purchase orders", ownRows: true },
  { table: "purchase_order_lines", sheet: "PO lines", ownRows: false },
  { table: "purchase_order_payments", sheet: "PO payments", ownRows: true },
  { table: "purchase_order_receipts", sheet: "Receipts", ownRows: true },
  { table: "purchase_order_receipt_lines", sheet: "Receipt lines", ownRows: false },
  { table: "pick_lists", sheet: "Pick lists", ownRows: true },
  { table: "pick_list_items", sheet: "Pick list items", ownRows: false },
];

const PAGE = 1000;

async function fetchAll(table: string, businessId: string, ownRows: boolean) {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PAGE) {
    let query = supabase.from(table).select("*").order("id", { ascending: true }).range(from, from + PAGE - 1);
    if (ownRows) query = query.eq("user_id", businessId);
    const { data, error } = await query;
    if (error) {
      // business_settings has no id column; a missing optional table is skipped.
      if (/column .*id.* does not exist/i.test(error.message) && from === 0) {
        let retry = supabase.from(table).select("*");
        if (ownRows) retry = retry.eq("user_id", businessId);
        const second = await retry;
        if (second.error) throw second.error;
        return (second.data || []) as Record<string, unknown>[];
      }
      if (/does not exist|schema cache/i.test(error.message)) return rows;
      throw error;
    }
    rows.push(...((data || []) as Record<string, unknown>[]));
    if (!data || data.length < PAGE) return rows;
  }
}

function cellValue(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return value as string | number | boolean;
}

export async function exportAllBusinessData(businessId: string, businessName: string) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "SydIN";
  workbook.created = new Date();

  const summary = workbook.addWorksheet("Read me");
  summary.columns = [{ width: 26 }, { width: 14 }];
  summary.addRow([`${businessName} -- all data from SydIN`]).font = { bold: true, size: 14 };
  summary.addRow([`Downloaded ${new Date().toLocaleString()}`]);
  summary.addRow([]);
  summary.addRow(["Sheet", "Rows"]).font = { bold: true };

  for (const { table, sheet, ownRows } of SHEETS) {
    const rows = await fetchAll(table, businessId, ownRows);
    summary.addRow([sheet, rows.length]);
    const worksheet = workbook.addWorksheet(sheet);
    const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
    if (columns.length === 0) {
      worksheet.addRow(["No records"]);
      continue;
    }
    worksheet.columns = columns.map((key) => ({ header: key, key, width: Math.min(40, Math.max(12, key.length + 2)) }));
    worksheet.getRow(1).font = { bold: true };
    worksheet.views = [{ state: "frozen", ySplit: 1 }];
    for (const row of rows) {
      worksheet.addRow(columns.map((key) => cellValue(row[key])));
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const safeName = (businessName || "SydIN").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "") || "SydIN";
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${safeName}-all-data-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
