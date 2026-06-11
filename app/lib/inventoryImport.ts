import ExcelJS from "exceljs";
import Papa from "papaparse";
import type { Depot } from "@/app/lib/depots";
import type { Category } from "@/app/lib/categories";
import {
  INVENTORY_UNIT_TYPES,
  parseInventoryUnitType,
  type InventoryUnitType,
} from "@/app/lib/inventoryItemModel";

export const INVENTORY_IMPORT_HEADERS = [
  "Name",
  "SKU",
  "Category",
  "Quantity",
  "Depot",
  "Notes",
  "Unit Type",
  "Custom Unit Label",
  "Cost Price",
  "Selling Price",
  "Min Stock Level",
  "Barcode",
] as const;

export const MAX_IMPORT_FILE_SIZE = 5 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 1000;

type ImportColumn =
  | "name"
  | "sku"
  | "category"
  | "quantity"
  | "depot"
  | "notes"
  | "unit_type"
  | "custom_unit_label"
  | "cost_price"
  | "selling_price"
  | "min_stock_level"
  | "barcode";

export interface ParsedInventoryRow {
  rowNumber: number;
  values: Record<ImportColumn, string>;
}

export interface ParsedInventoryFile {
  fileName: string;
  format: "CSV" | "Excel";
  totalRows: number;
  skippedEmptyRows: number;
  rows: ParsedInventoryRow[];
  ignoredItemCodeColumn: boolean;
}

export interface InventoryImportRowError {
  field: ImportColumn;
  message: string;
  type:
    | "required"
    | "quantity"
    | "duplicate-sku"
    | "depot"
    | "unit"
    | "price"
    | "min-stock";
}

export interface ValidatedInventoryRow {
  rowNumber: number;
  values: {
    name: string;
    sku: string;
    category: string;
    quantity: number | null;
    depot: string;
    notes: string;
    unit_type: InventoryUnitType;
    custom_unit_label: string;
    cost_price: number | null;
    selling_price: number | null;
    min_stock_level: number | null;
    barcode: string;
  };
  depotId: number | null;
  categoryId: number | null;
  errors: InventoryImportRowError[];
  isValid: boolean;
}

export interface InventoryImportValidation {
  rows: ValidatedInventoryRow[];
  validRows: ValidatedInventoryRow[];
  invalidRows: ValidatedInventoryRow[];
  duplicateSkuRows: number;
  depotErrorRows: number;
  unmatchedCategoryRows: number;
}

const COLUMN_BY_HEADER: Record<string, ImportColumn> = {
  name: "name",
  sku: "sku",
  category: "category",
  quantity: "quantity",
  depot: "depot",
  notes: "notes",
  unit_type: "unit_type",
  unit: "unit_type",
  custom_unit_label: "custom_unit_label",
  custom_unit: "custom_unit_label",
  cost_price: "cost_price",
  cost: "cost_price",
  selling_price: "selling_price",
  price: "selling_price",
  min_stock_level: "min_stock_level",
  min_stock: "min_stock_level",
  barcode: "barcode",
};

function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeCellValue(value: unknown): string {
  if (value === null || value === undefined) return "";

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") {
      return value.text.trim();
    }

    if ("result" in value) {
      return normalizeCellValue(value.result);
    }

    if (
      "richText" in value &&
      Array.isArray(value.richText)
    ) {
      return value.richText
        .map((part) =>
          part && typeof part === "object" && "text" in part
            ? String(part.text)
            : ""
        )
        .join("")
        .trim();
    }
  }

  return String(value).trim();
}

function isEmptyImportRow(values: Record<ImportColumn, string>) {
  return Object.values(values).every((value) => value.trim() === "");
}

function createEmptyValues(): Record<ImportColumn, string> {
  return {
    name: "",
    sku: "",
    category: "",
    quantity: "",
    depot: "",
    notes: "",
    unit_type: "",
    custom_unit_label: "",
    cost_price: "",
    selling_price: "",
    min_stock_level: "",
    barcode: "",
  };
}

function buildHeaderMap(headers: unknown[]) {
  const headerMap = new Map<number, ImportColumn>();
  const seenColumns = new Set<ImportColumn>();
  let ignoredItemCodeColumn = false;

  headers.forEach((header, index) => {
    const normalizedHeader = normalizeHeader(header);

    if (normalizedHeader === "item_code") {
      ignoredItemCodeColumn = true;
      return;
    }

    const column = COLUMN_BY_HEADER[normalizedHeader];

    if (!column) return;

    if (seenColumns.has(column)) {
      throw new Error(`The file contains more than one "${header}" column.`);
    }

    seenColumns.add(column);
    headerMap.set(index, column);
  });

  if (!seenColumns.has("name") || !seenColumns.has("quantity")) {
    throw new Error(
      'The file must include "Name" and "Quantity" columns. Download a SydIN template and try again.'
    );
  }

  return {
    headerMap,
    ignoredItemCodeColumn,
  };
}

function normalizeRows(
  rawRows: unknown[][],
  headerRowIndex: number,
  headerMap: Map<number, ImportColumn>
) {
  const rows: ParsedInventoryRow[] = [];
  let skippedEmptyRows = 0;

  for (let index = headerRowIndex + 1; index < rawRows.length; index += 1) {
    const rawRow = rawRows[index] || [];
    const values = createEmptyValues();

    headerMap.forEach((column, columnIndex) => {
      values[column] = normalizeCellValue(rawRow[columnIndex]);
    });

    if (isEmptyImportRow(values)) {
      skippedEmptyRows += 1;
      continue;
    }

    rows.push({
      rowNumber: index + 1,
      values,
    });
  }

  if (rows.length > MAX_IMPORT_ROWS) {
    throw new Error(
      `This file has ${rows.length} inventory rows. Import up to ${MAX_IMPORT_ROWS} rows at a time.`
    );
  }

  return {
    rows,
    skippedEmptyRows,
  };
}

function findHeaderRow(rawRows: unknown[][]) {
  const headerRowIndex = rawRows.findIndex((row) =>
    row.some((value) => normalizeCellValue(value) !== "")
  );

  if (headerRowIndex === -1) {
    throw new Error("This file is empty. Add inventory rows and try again.");
  }

  return headerRowIndex;
}

async function parseCsvFile(file: File) {
  const csvText = await file.text();
  const result = Papa.parse<unknown[]>(csvText, {
    skipEmptyLines: false,
  });

  const blockingError = result.errors.find(
    (error) => error.type === "Quotes" || error.type === "Delimiter"
  );

  if (blockingError) {
    throw new Error(
      `We could not read this CSV file. ${blockingError.message}`
    );
  }

  return result.data.map((row) => (Array.isArray(row) ? row : []));
}

async function parseExcelFile(file: File) {
  const workbook = new ExcelJS.Workbook();
  const arrayBuffer = await file.arrayBuffer();

  await workbook.xlsx.load(arrayBuffer);

  const worksheet = workbook.worksheets[0];

  if (!worksheet) {
    throw new Error("This Excel file does not contain a worksheet.");
  }

  const rawRows: unknown[][] = [];

  for (let rowNumber = 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const values: unknown[] = [];

    for (
      let columnNumber = 1;
      columnNumber <= worksheet.columnCount;
      columnNumber += 1
    ) {
      const cell = row.getCell(columnNumber);

      values.push(cell.text || cell.value);
    }

    rawRows.push(values);
  }

  return rawRows;
}

export async function parseInventoryImportFile(
  file: File
): Promise<ParsedInventoryFile> {
  if (file.size > MAX_IMPORT_FILE_SIZE) {
    throw new Error("Import file must be 5MB or smaller.");
  }

  const extension = file.name.split(".").pop()?.toLowerCase();

  if (extension !== "csv" && extension !== "xlsx") {
    throw new Error("Choose a CSV or Excel (.xlsx) file.");
  }

  let rawRows: unknown[][];

  try {
    rawRows =
      extension === "csv"
        ? await parseCsvFile(file)
        : await parseExcelFile(file);
  } catch (error) {
    if (error instanceof Error) throw error;

    throw new Error("We could not read this import file. Try another file.");
  }

  const headerRowIndex = findHeaderRow(rawRows);
  const { headerMap, ignoredItemCodeColumn } = buildHeaderMap(
    rawRows[headerRowIndex] || []
  );
  const normalized = normalizeRows(rawRows, headerRowIndex, headerMap);

  if (normalized.rows.length === 0) {
    throw new Error(
      "No inventory rows were found. Add data below the header row and try again."
    );
  }

  return {
    fileName: file.name,
    format: extension === "csv" ? "CSV" : "Excel",
    totalRows: normalized.rows.length + normalized.skippedEmptyRows,
    skippedEmptyRows: normalized.skippedEmptyRows,
    rows: normalized.rows,
    ignoredItemCodeColumn,
  };
}

export function validateInventoryImportRows({
  rows,
  depots,
  categories = [],
  existingSkus,
}: {
  rows: ParsedInventoryRow[];
  depots: Depot[];
  categories?: Category[];
  existingSkus: string[];
}): InventoryImportValidation {
  const normalizedExistingSkus = new Set(
    existingSkus
      .map((sku) => sku.trim().toLowerCase())
      .filter(Boolean)
  );
  const incomingSkuCounts = new Map<string, number>();

  rows.forEach((row) => {
    const normalizedSku = row.values.sku.trim().toLowerCase();

    if (!normalizedSku) return;

    incomingSkuCounts.set(
      normalizedSku,
      (incomingSkuCounts.get(normalizedSku) || 0) + 1
    );
  });

  const validatedRows = rows.map<ValidatedInventoryRow>((row) => {
    const name = row.values.name.trim();
    const sku = row.values.sku.trim();
    const category = row.values.category.trim();
    const quantityText = row.values.quantity.trim();
    const quantity = quantityText === "" ? null : Number(quantityText);
    const depotName = row.values.depot.trim();
    const notes = row.values.notes.trim();
    const unitTypeText = row.values.unit_type.trim();
    const unitType = parseInventoryUnitType(unitTypeText);
    const customUnitLabel = row.values.custom_unit_label.trim();
    const costPriceText = row.values.cost_price.trim();
    const costPrice = costPriceText === "" ? null : Number(costPriceText);
    const sellingPriceText = row.values.selling_price.trim();
    const sellingPrice =
      sellingPriceText === "" ? null : Number(sellingPriceText);
    const minStockLevelText = row.values.min_stock_level.trim();
    const minStockLevel =
      minStockLevelText === "" ? null : Number(minStockLevelText);
    const barcode = row.values.barcode.trim();
    const errors: InventoryImportRowError[] = [];
    let depotId: number | null = null;
    const matchingCategory = category
      ? categories.find(
          (managedCategory) =>
            managedCategory.name.trim().toLowerCase() ===
            category.toLowerCase()
        )
      : null;
    const categoryId = matchingCategory?.id || null;

    if (!name) {
      errors.push({
        field: "name",
        message: "Name is required.",
        type: "required",
      });
    }

    if (
      quantity === null ||
      !Number.isFinite(quantity) ||
      !Number.isInteger(quantity) ||
      quantity < 0
    ) {
      errors.push({
        field: "quantity",
        message: "Quantity must be a whole number of 0 or more.",
        type: "quantity",
      });
    }

    if (!unitType) {
      errors.push({
        field: "unit_type",
        message: `Unit "${unitTypeText}" is not supported.`,
        type: "unit",
      });
    }

    if (unitType === "custom" && !customUnitLabel) {
      errors.push({
        field: "custom_unit_label",
        message: "Custom unit label is required when unit is custom.",
        type: "unit",
      });
    }

    if (
      costPrice !== null &&
      (!Number.isFinite(costPrice) || costPrice < 0)
    ) {
      errors.push({
        field: "cost_price",
        message: "Cost price must be empty or 0 or more.",
        type: "price",
      });
    }

    if (
      sellingPrice !== null &&
      (!Number.isFinite(sellingPrice) || sellingPrice < 0)
    ) {
      errors.push({
        field: "selling_price",
        message: "Selling price must be empty or 0 or more.",
        type: "price",
      });
    }

    if (
      minStockLevel !== null &&
      (!Number.isFinite(minStockLevel) ||
        !Number.isInteger(minStockLevel) ||
        minStockLevel < 0)
    ) {
      errors.push({
        field: "min_stock_level",
        message: "Minimum stock must be empty or a whole number of 0 or more.",
        type: "min-stock",
      });
    }

    if (sku) {
      const normalizedSku = sku.toLowerCase();

      if ((incomingSkuCounts.get(normalizedSku) || 0) > 1) {
        errors.push({
          field: "sku",
          message: `SKU ${sku} appears more than once in this file.`,
          type: "duplicate-sku",
        });
      }

      if (normalizedExistingSkus.has(normalizedSku)) {
        errors.push({
          field: "sku",
          message: `SKU ${sku} already exists in inventory.`,
          type: "duplicate-sku",
        });
      }
    }

    if (depotName) {
      const matchingDepots = depots.filter(
        (depot) =>
          depot.name.trim().toLowerCase() === depotName.toLowerCase()
      );
      const activeMatches = matchingDepots.filter((depot) => depot.is_active);

      if (activeMatches.length === 1) {
        depotId = activeMatches[0].id;
      } else if (activeMatches.length > 1) {
        errors.push({
          field: "depot",
          message: `Depot "${depotName}" matches more than one active depot.`,
          type: "depot",
        });
      } else if (matchingDepots.length > 0) {
        errors.push({
          field: "depot",
          message: `Depot "${depotName}" is inactive.`,
          type: "depot",
        });
      } else {
        errors.push({
          field: "depot",
          message: `Depot "${depotName}" does not exist.`,
          type: "depot",
        });
      }
    }

    return {
      rowNumber: row.rowNumber,
      values: {
        name,
        sku,
        category,
        quantity,
        depot: depotName,
        notes,
        unit_type: unitType || "piece",
        custom_unit_label:
          unitType === "custom" ? customUnitLabel : "",
        cost_price: costPrice,
        selling_price: sellingPrice,
        min_stock_level: minStockLevel,
        barcode,
      },
      depotId,
      categoryId,
      errors,
      isValid: errors.length === 0,
    };
  });
  const validRows = validatedRows.filter((row) => row.isValid);
  const invalidRows = validatedRows.filter((row) => !row.isValid);

  return {
    rows: validatedRows,
    validRows,
    invalidRows,
    duplicateSkuRows: validatedRows.filter((row) =>
      row.errors.some((error) => error.type === "duplicate-sku")
    ).length,
    depotErrorRows: validatedRows.filter((row) =>
      row.errors.some((error) => error.type === "depot")
    ).length,
    unmatchedCategoryRows: validatedRows.filter(
      (row) => Boolean(row.values.category) && !row.categoryId
    ).length,
  };
}

function downloadBlob(blob: Blob, filename: string) {
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = downloadUrl;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(downloadUrl);
}

export function downloadInventoryCsvTemplate() {
  const csv = Papa.unparse({
    fields: [...INVENTORY_IMPORT_HEADERS],
    data: [
      [
        "Example Product",
        "SKU-1001",
        "General",
        25,
        "Main Depot",
        "Example row",
        "piece",
        "",
        "2.50",
        "5.00",
        3,
        "0012345678905",
      ],
      [
        "Unassigned Product",
        "",
        "Supplies",
        0,
        "",
        "SKU, depot, prices, and barcode are optional",
        "piece",
        "",
        "",
        "",
        "",
        "",
      ],
    ],
  });

  downloadBlob(
    new Blob([csv], {
      type: "text/csv;charset=utf-8",
    }),
    "sydin-inventory-import-template.csv"
  );
}

export async function downloadInventoryExcelTemplate() {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Inventory Import");

  workbook.creator = "SydIN";
  worksheet.views = [
    {
      state: "frozen",
      ySplit: 1,
    },
  ];
  worksheet.columns = [
    { header: "Name", key: "name", width: 28 },
    { header: "SKU", key: "sku", width: 20 },
    { header: "Category", key: "category", width: 20 },
    { header: "Quantity", key: "quantity", width: 14 },
    { header: "Depot", key: "depot", width: 24 },
    { header: "Notes", key: "notes", width: 36 },
    { header: "Unit Type", key: "unit_type", width: 18 },
    { header: "Custom Unit Label", key: "custom_unit_label", width: 22 },
    { header: "Cost Price", key: "cost_price", width: 16 },
    { header: "Selling Price", key: "selling_price", width: 16 },
    { header: "Min Stock Level", key: "min_stock_level", width: 18 },
    { header: "Barcode", key: "barcode", width: 22 },
  ];
  worksheet.addRow({
    name: "Example Product",
    sku: "SKU-1001",
    category: "General",
    quantity: 25,
    depot: "Main Depot",
    notes: "Example row",
    unit_type: "piece",
    custom_unit_label: "",
    cost_price: 2.5,
    selling_price: 5,
    min_stock_level: 3,
    barcode: "0012345678905",
  });
  worksheet.addRow({
    name: "Unassigned Product",
    sku: "",
    category: "Supplies",
    quantity: 0,
    depot: "",
    notes: "SKU, depot, prices, and barcode are optional",
    unit_type: "piece",
    custom_unit_label: "",
    cost_price: "",
    selling_price: "",
    min_stock_level: "",
    barcode: "",
  });

  const headerRow = worksheet.getRow(1);

  headerRow.height = 26;
  headerRow.eachCell((cell) => {
    cell.font = {
      name: "Calibri",
      size: 11,
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0F172A" },
    };
    cell.alignment = {
      vertical: "middle",
      horizontal: "center",
    };
    cell.border = {
      top: { style: "thin", color: { argb: "FF334155" } },
      left: { style: "thin", color: { argb: "FF334155" } },
      bottom: { style: "thin", color: { argb: "FF334155" } },
      right: { style: "thin", color: { argb: "FF334155" } },
    };
  });

  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);

    row.height = 24;
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = {
        name: "Calibri",
        size: 11,
        color: { argb: "FF0F172A" },
      };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: rowNumber % 2 === 0 ? "FFF8FAFC" : "FFFFFFFF" },
      };
      cell.alignment = {
        vertical: "middle",
        wrapText: true,
      };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
    });
  }

  worksheet.getColumn("D").numFmt = "0";
  worksheet.getColumn("D").eachCell((cell, rowNumber) => {
    if (rowNumber === 1) return;

    cell.dataValidation = {
      type: "whole",
      operator: "greaterThanOrEqual",
      allowBlank: false,
      formulae: [0],
      showErrorMessage: true,
      errorTitle: "Invalid quantity",
      error: "Enter a whole number of 0 or more.",
    };
  });
  worksheet.getColumn("G").eachCell((cell, rowNumber) => {
    if (rowNumber === 1) return;

    cell.dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [`"${INVENTORY_UNIT_TYPES.join(",")}"`],
      showErrorMessage: true,
      errorTitle: "Invalid unit",
      error: "Choose a unit from the list or leave blank for piece.",
    };
  });
  ["I", "J"].forEach((columnName) => {
    worksheet.getColumn(columnName).numFmt = "0.00";
    worksheet.getColumn(columnName).eachCell((cell, rowNumber) => {
      if (rowNumber === 1) return;

      cell.dataValidation = {
        type: "decimal",
        operator: "greaterThanOrEqual",
        allowBlank: true,
        formulae: [0],
        showErrorMessage: true,
        errorTitle: "Invalid price",
        error: "Enter 0 or more, or leave blank.",
      };
    });
  });
  worksheet.getColumn("K").numFmt = "0";
  worksheet.getColumn("K").eachCell((cell, rowNumber) => {
    if (rowNumber === 1) return;

    cell.dataValidation = {
      type: "whole",
      operator: "greaterThanOrEqual",
      allowBlank: true,
      formulae: [0],
      showErrorMessage: true,
      errorTitle: "Invalid minimum stock",
      error: "Enter a whole number of 0 or more, or leave blank.",
    };
  });
  worksheet.getColumn("L").numFmt = "@";
  worksheet.autoFilter = {
    from: "A1",
    to: "L1",
  };

  const buffer = await workbook.xlsx.writeBuffer();

  downloadBlob(
    new Blob([buffer as BlobPart], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    "sydin-inventory-import-template.xlsx"
  );
}
