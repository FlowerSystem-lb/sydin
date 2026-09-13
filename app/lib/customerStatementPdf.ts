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
 * "How much does this customer owe me?" on paper -- every invoice, its own
 * total and balance, and the three-number summary the customer sheet already
 * shows on screen (brief point 14). Each invoice prints in the currency it
 * was issued in; the summary is the account total, in the currency the
 * account is shown in on screen, since invoices in different currencies
 * cannot be summed any other way.
 */
export interface CustomerStatementLine {
  date: string | null;
  number: string;
  title?: string | null;
  status: string;
  currency: string;
  total: number;
  balance: number;
}

export interface CustomerStatementDetails {
  statementNumber: string;
  generatedAt?: string;
  customerName: string;
  customerContact?: string;
  customerAddress?: string;
  displayCurrency: string;
  billed: number;
  paid: number;
  owed: number;
}

export async function exportCustomerStatementPdf({
  details,
  lines,
  branding,
}: {
  details: CustomerStatementDetails;
  lines: CustomerStatementLine[];
  branding: DocumentBranding;
}) {
  const header = {
    kind: "Customer Statement",
    number: details.statementNumber,
    meta: formatDocumentDate(details.generatedAt || new Date().toISOString()),
  };
  const context = await openDocument(branding, header);
  const { doc, margin } = context;

  const cursorY = drawColumns(context, context.contentTop, [
    fromColumn(branding),
    {
      heading: "Statement for",
      rows: [details.customerName, details.customerContact || "", details.customerAddress || ""].filter(
        Boolean
      ),
    },
    {
      heading: "Summary",
      rows: [
        `Invoiced ${formatExactPrice(details.billed, details.displayCurrency) || "--"}`,
        `Paid ${formatExactPrice(details.paid, details.displayCurrency) || "--"}`,
        details.owed > 0
          ? `Owes ${formatExactPrice(details.owed, details.displayCurrency) || "--"}`
          : "Settled in full",
      ],
    },
  ]);

  if (lines.length === 0) {
    // An empty table still draws its header row -- a bare "Invoice / Status
    // / Total" bar with nothing under it reads as broken, not as "none yet".
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...DOCUMENT_MUTED);
    doc.text("Nothing invoiced to this customer yet.", margin, cursorY + 4);
  } else {
    autoTable(doc, {
      startY: cursorY,
      margin: {
        left: margin,
        right: margin,
        top: context.contentTop,
        bottom: context.pageHeight - context.contentBottom,
      },
      head: [["Date", "Invoice", "Status", "Total", "Balance"]],
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
    doc.text(`${lines.length} invoice${lines.length === 1 ? "" : "s"}`, margin, tableEnd + 6);
  }

  finishDocument(context, details.statementNumber);
  doc.save(`${slugifyDocumentName(details.statementNumber, "customer-statement")}.pdf`);
}
