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
import { formatExactPrice } from "@/app/lib/currency";

/**
 * "How much do I owe this supplier?" on paper -- the mirror of
 * `customerStatementPdf.ts` with the direction of the money reversed (brief
 * points 40 and 41: a supplier bill/statement link from the relationship).
 * Every order, its own total and balance, and the three-number summary the
 * supplier sheet already shows on screen. Each order prints in the currency
 * it was placed in; the summary is the account total in the currency the
 * account is shown in on screen, since orders in different currencies
 * cannot be summed any other way.
 */
export interface SupplierStatementLine {
  date: string | null;
  number: string;
  title?: string | null;
  status: string;
  currency: string;
  total: number;
  balance: number;
}

export interface SupplierStatementDetails {
  statementNumber: string;
  generatedAt?: string;
  supplierName: string;
  supplierContact?: string;
  supplierAddress?: string;
  displayCurrency: string;
  ordered: number;
  paid: number;
  owed: number;
}

export async function exportSupplierStatementPdf({
  details,
  lines,
  branding,
}: {
  details: SupplierStatementDetails;
  lines: SupplierStatementLine[];
  branding: DocumentBranding;
}) {
  const header = {
    kind: "Supplier Statement",
    number: details.statementNumber,
    meta: formatDocumentDate(details.generatedAt || new Date().toISOString()),
  };
  const context = await openDocument(branding, header);
  const { doc, margin } = context;

  const cursorY = drawColumns(context, context.contentTop, [
    fromColumn(branding),
    {
      heading: "Statement for",
      rows: [details.supplierName, details.supplierContact || "", details.supplierAddress || ""].filter(
        Boolean
      ),
    },
    {
      heading: "Summary",
      rows: [
        `Ordered ${formatExactPrice(details.ordered, details.displayCurrency) || "--"}`,
        `Paid ${formatExactPrice(details.paid, details.displayCurrency) || "--"}`,
        details.owed > 0
          ? `You owe ${formatExactPrice(details.owed, details.displayCurrency) || "--"}`
          : "Settled in full",
      ],
    },
  ]);

  if (lines.length === 0) {
    // An empty table still draws its header row -- a bare "Order / Status /
    // Total" bar with nothing under it reads as broken, not as "none yet".
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...DOCUMENT_MUTED);
    doc.text("Nothing ordered from this supplier yet.", margin, cursorY + 4);
  } else {
    autoTable(doc, {
      startY: cursorY,
      margin: {
        left: margin,
        right: margin,
        top: context.contentTop,
        bottom: context.pageHeight - context.contentBottom,
      },
      head: [["Date", "Order", "Status", "Total", "You owe"]],
      body: lines.map((line) => [
        formatDocumentDate(line.date),
        [line.number, line.title].filter(Boolean).join(" — "),
        line.status,
        formatExactPrice(line.total, line.currency) || "--",
        line.balance > 0 ? formatExactPrice(line.balance, line.currency) || "--" : "Paid",
      ]),
      showHead: "everyPage",
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
      columnStyles: {
        0: { cellWidth: 24 },
        2: { cellWidth: 30 },
        3: { cellWidth: 28, halign: "right" },
        4: { cellWidth: 28, halign: "right", fontStyle: "bold" },
      },
      willDrawPage: (data) => {
        if (data.pageNumber > 1) drawDocumentHeader(context, header);
      },
    });

    const tableEnd =
      (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? cursorY;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...DOCUMENT_MUTED);
    doc.text(`${lines.length} order${lines.length === 1 ? "" : "s"}`, margin, tableEnd + 6);
  }

  finishDocument(context, details.statementNumber);
  doc.save(`${slugifyDocumentName(details.statementNumber, "supplier-statement")}.pdf`);
}
