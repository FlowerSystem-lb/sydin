import autoTable from "jspdf-autotable";
import {
  DOCUMENT_FILL,
  DOCUMENT_INK,
  DOCUMENT_MUTED,
  DOCUMENT_RULE,
  drawColumns,
  drawDocumentHeader,
  finishDocument,
  formatDocumentDate,
  fromColumn,
  openDocument,
  slugifyDocumentName,
  type DocumentBranding,
} from "@/app/lib/documentPdf";

/**
 * One section of an item's record, on paper: its stock movements, its edit
 * history, or the invoices and purchase orders it appears on (Sayed, 5 Oct
 * 2026: "a PDF button beside each title, professional layout, non
 * breakable").
 *
 * Same furniture as every SydIN document (documentPdf.ts): the branded
 * header bar, From / Item / Summary columns, footer with page numbers. The
 * table repeats its head on every page and never splits a row across a page
 * break (`rowPageBreak: "avoid"`), so a long note moves to the next page
 * whole instead of being cut in half.
 */

/* jsPDF's built-in Helvetica only knows the WinAnsi characters. The app's
   typographic minus (U+2212) printed as "˜5" and an arrow would vanish, so
   anything outside that set is mapped to its plain equivalent first. */
function pdfText(value: string | null | undefined) {
  return (value || "")
    .replace(/−/g, "-")
    .replace(/→/g, "->")
    .replace(/←/g, "<-")
    .replace(/[  ]/g, " ");
}

export type ItemActivityReportKind = "movements" | "history" | "documents";

export interface ItemActivityReportItem {
  name: string;
  code?: string | null;
  sku?: string | null;
  barcode?: string | null;
  category?: string | null;
  depot?: string | null;
  quantityLabel: string;
  lowStockLevel?: string | null;
}

export interface ItemActivityReportTable {
  head: string[];
  rows: string[][];
  /** Column index -> width (mm) and alignment. Unlisted columns share the rest. */
  columns?: Record<number, { width?: number; align?: "left" | "right" | "center"; bold?: boolean }>;
}

const TITLES: Record<ItemActivityReportKind, string> = {
  movements: "Stock Movements",
  history: "Item History",
  documents: "Sales & Purchases",
};

const EMPTY: Record<ItemActivityReportKind, string> = {
  movements: "No stock movements recorded for this item yet.",
  history: "No history recorded for this item yet.",
  documents: "This item is not on any invoice or purchase order yet.",
};

const NOUN: Record<ItemActivityReportKind, [string, string]> = {
  movements: ["movement", "movements"],
  history: ["entry", "entries"],
  documents: ["document", "documents"],
};

export async function exportItemActivityPdf({
  kind,
  item,
  table,
  branding,
  /** ISO dates of the oldest and newest row, for the "Period" line. */
  period,
}: {
  kind: ItemActivityReportKind;
  item: ItemActivityReportItem;
  table: ItemActivityReportTable;
  branding: DocumentBranding;
  period?: { from: string | null; to: string | null };
}) {
  item = {
    ...item,
    name: pdfText(item.name),
    category: pdfText(item.category),
    depot: pdfText(item.depot),
    quantityLabel: pdfText(item.quantityLabel),
  };
  table = {
    ...table,
    head: table.head.map(pdfText),
    rows: table.rows.map((row) => row.map(pdfText)),
  };
  const reference = item.code || item.sku || item.name;
  const header = {
    kind: TITLES[kind],
    number: reference,
    meta: formatDocumentDate(new Date().toISOString()),
  };
  const context = await openDocument(branding, header);
  const { doc, margin } = context;

  const [one, many] = NOUN[kind];
  const count = table.rows.length;

  const cursorY = drawColumns(context, context.contentTop, [
    fromColumn(branding),
    {
      heading: "Item",
      rows: [
        item.name,
        [item.code ? `Code ${item.code}` : "", item.sku ? `SKU ${item.sku}` : ""]
          .filter(Boolean)
          .join("  ·  "),
        item.barcode ? `Barcode ${item.barcode}` : "",
        [item.category, item.depot].filter(Boolean).join("  ·  "),
      ].filter(Boolean),
    },
    {
      heading: "Summary",
      rows: [
        `In stock now: ${item.quantityLabel}`,
        item.lowStockLevel ? `Low-stock level: ${item.lowStockLevel}` : "",
        `${count} ${count === 1 ? one : many}`,
        period?.from && period?.to
          ? `${formatDocumentDate(period.from)} – ${formatDocumentDate(period.to)}`
          : "",
      ].filter(Boolean),
    },
  ]);

  if (count === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...DOCUMENT_MUTED);
    doc.text(EMPTY[kind], margin, cursorY + 4);
  } else {
    const columnStyles: Record<number, Record<string, unknown>> = {};
    for (const [index, spec] of Object.entries(table.columns || {})) {
      columnStyles[Number(index)] = {
        ...(spec.width ? { cellWidth: spec.width } : {}),
        ...(spec.align ? { halign: spec.align } : {}),
        ...(spec.bold ? { fontStyle: "bold" } : {}),
      };
    }

    autoTable(doc, {
      startY: cursorY,
      margin: {
        left: margin,
        right: margin,
        top: context.contentTop,
        bottom: context.pageHeight - context.contentBottom,
      },
      head: [table.head],
      body: table.rows,
      showHead: "everyPage",
      // Non-breakable: a row that does not fit moves to the next page whole.
      rowPageBreak: "avoid",
      styles: {
        font: "helvetica",
        fontSize: 8.5,
        cellPadding: 2.6,
        overflow: "linebreak",
        valign: "middle",
        lineColor: DOCUMENT_RULE,
        lineWidth: 0.12,
        textColor: DOCUMENT_INK,
      },
      headStyles: { fillColor: [238, 242, 248], textColor: [70, 80, 95], fontStyle: "bold" },
      alternateRowStyles: { fillColor: DOCUMENT_FILL },
      columnStyles,
      willDrawPage: (data) => {
        if (data.pageNumber > 1) drawDocumentHeader(context, header);
      },
    });

    const tableEnd =
      (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ??
      cursorY;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...DOCUMENT_MUTED);
    doc.text(`${count} ${count === 1 ? one : many}, newest first`, margin, tableEnd + 6);
  }

  finishDocument(context, `${reference} ${TITLES[kind]}`);
  doc.save(
    `${slugifyDocumentName(`${reference}-${TITLES[kind]}`, "item-report")}.pdf`
  );
}
