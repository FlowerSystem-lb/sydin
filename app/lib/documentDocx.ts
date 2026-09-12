import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  ImageRun,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
  type ITableCellOptions,
} from "docx";
import { loadExportImage, type LoadedExportImage } from "@/app/lib/exportImage";
import { shrinkForThumbnail, type DocumentBranding } from "@/app/lib/documentPdf";

/**
 * The Word twin of documentPdf: the same header, From block, table, totals
 * and footer, as a .docx a customer can open in Word and edit before
 * printing. Built with the `docx` package, which writes a real OOXML file --
 * not a renamed HTML page.
 *
 * Why Word at all: a wholesale customer's accountant asks for one; a
 * supplier wants to annotate a purchase order and send it back. PDF is the
 * document; DOCX is the document they can type on.
 */

const INK = "0F172A";
const MUTED = "64748B";
const RULE = "E2E8F0";
const FILL = "F8FAFC";
const BLUE = "2563EB";

const A4_CONTENT_WIDTH_DXA = 9638; // 210mm - 2 * 20mm margins, in twentieths of a point
const MM = 56.7; // dxa per mm

function px(mm: number) {
  // ImageRun sizes are in pixels at 96dpi.
  return Math.round((mm / 25.4) * 96);
}

function dataUrlToBytes(dataUrl: string) {
  const base64 = dataUrl.split(",")[1] || "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function fitted(image: LoadedExportImage, boxMm: number) {
  const scale = Math.min(boxMm / image.width, boxMm / image.height, 1e9);
  const width = image.width * scale;
  const height = image.height * scale;
  return { width: px(width), height: px(height) };
}

function imageRun(image: LoadedExportImage, boxMm: number) {
  const size = fitted(image, boxMm);
  return new ImageRun({
    type: image.extension === "png" ? "png" : "jpg",
    data: dataUrlToBytes(image.dataUrl),
    transformation: { width: size.width, height: size.height },
    altText: { title: "", description: "", name: "image" },
  });
}

function text(
  value: string,
  options: { bold?: boolean; size?: number; color?: string; italics?: boolean } = {}
) {
  return new TextRun({
    text: value,
    bold: options.bold,
    size: options.size ?? 20, // half-points: 20 = 10pt
    color: options.color ?? INK,
    italics: options.italics,
    font: "Calibri",
  });
}

function para(
  runs: (TextRun | ImageRun)[] | string,
  options: { align?: (typeof AlignmentType)[keyof typeof AlignmentType]; after?: number; before?: number } = {}
) {
  return new Paragraph({
    children: typeof runs === "string" ? [text(runs)] : runs,
    alignment: options.align,
    spacing: { after: options.after ?? 40, before: options.before ?? 0 },
  });
}

const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const NO_BORDERS = { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER };
const HAIRLINE = { style: BorderStyle.SINGLE, size: 4, color: RULE };
const HAIRLINES = { top: HAIRLINE, bottom: HAIRLINE, left: HAIRLINE, right: HAIRLINE };

function cell(
  children: Paragraph[],
  options: Partial<ITableCellOptions> & { widthDxa?: number; shade?: string } = {}
) {
  return new TableCell({
    children,
    width: options.widthDxa ? { size: options.widthDxa, type: WidthType.DXA } : undefined,
    borders: options.borders ?? NO_BORDERS,
    shading: options.shade ? { type: ShadingType.CLEAR, fill: options.shade } : undefined,
    verticalAlign: options.verticalAlign ?? VerticalAlign.TOP,
    margins: options.margins ?? { top: 60, bottom: 60, left: 80, right: 80 },
  });
}

export interface DocxColumn {
  heading: string;
  rows: string[];
}

export function docxFromColumn(branding: DocumentBranding): DocxColumn {
  return {
    heading: "From",
    rows: [
      branding.businessName,
      ...(branding.address ? branding.address.split(/\r?\n/) : []),
      branding.taxId ? `Tax / Reg. ${branding.taxId}` : "",
      branding.phone || "",
      branding.email || "",
      branding.website || "",
    ].filter(Boolean),
  };
}

export interface DocxLineTable {
  head: string[];
  /** Column widths in mm; the first column takes what is left. */
  widthsMm: (number | null)[];
  /** Right-aligned columns by index. */
  rightAligned: number[];
  rows: Array<{ cells: string[]; image?: LoadedExportImage | null; hasImageSlot: boolean }>;
  foot?: string[];
}

export interface DocxDocumentSpec {
  branding: DocumentBranding;
  kind: string;
  number: string;
  meta?: string;
  columns: DocxColumn[];
  table: DocxLineTable;
  /** Right-aligned label/value pairs under the table; the last is emphasised. */
  totals?: Array<[string, string]>;
  notes?: string[];
  filename: string;
}

function headerTable(spec: DocxDocumentSpec, logo: LoadedExportImage | null) {
  const left: Paragraph[] = [];
  if (logo) left.push(para([imageRun(logo, 18)], { after: 60 }));
  left.push(para([text(spec.branding.businessName, { bold: true, size: 30 })], { after: 20 }));
  left.push(para([text(spec.kind, { size: 20, color: MUTED })]));

  const right: Paragraph[] = [
    para([text(spec.number, { bold: true, size: 26 })], { align: AlignmentType.RIGHT, after: 20 }),
  ];
  if (spec.meta) {
    right.push(para([text(spec.meta, { size: 18, color: MUTED })], { align: AlignmentType.RIGHT }));
  }

  return new Table({
    width: { size: A4_CONTENT_WIDTH_DXA, type: WidthType.DXA },
    columnWidths: [Math.round(A4_CONTENT_WIDTH_DXA * 0.62), Math.round(A4_CONTENT_WIDTH_DXA * 0.38)],
    rows: [
      new TableRow({
        children: [
          cell(left, {
            widthDxa: Math.round(A4_CONTENT_WIDTH_DXA * 0.62),
            borders: { ...NO_BORDERS, bottom: { style: BorderStyle.SINGLE, size: 12, color: BLUE } },
          }),
          cell(right, {
            widthDxa: Math.round(A4_CONTENT_WIDTH_DXA * 0.38),
            borders: { ...NO_BORDERS, bottom: { style: BorderStyle.SINGLE, size: 12, color: BLUE } },
            verticalAlign: VerticalAlign.BOTTOM,
          }),
        ],
      }),
    ],
  });
}

function columnsTable(columns: DocxColumn[]) {
  const width = Math.floor(A4_CONTENT_WIDTH_DXA / columns.length);
  return new Table({
    width: { size: A4_CONTENT_WIDTH_DXA, type: WidthType.DXA },
    columnWidths: columns.map(() => width),
    rows: [
      new TableRow({
        children: columns.map((column) =>
          cell(
            [
              para([text(column.heading.toUpperCase(), { bold: true, size: 15, color: MUTED })], {
                after: 60,
              }),
              ...column.rows.map((row) => para([text(row, { size: 19 })], { after: 20 })),
            ],
            { widthDxa: width, margins: { top: 0, bottom: 0, left: 0, right: 120 } }
          )
        ),
      }),
    ],
  });
}

function linesTable(table: DocxLineTable) {
  const fixed = table.widthsMm.reduce<number>((sum, mm) => sum + (mm ?? 0), 0);
  const widths = table.widthsMm.map((mm) =>
    mm === null ? A4_CONTENT_WIDTH_DXA - Math.round(fixed * MM) : Math.round(mm * MM)
  );
  const align = (index: number) =>
    table.rightAligned.includes(index) ? AlignmentType.RIGHT : AlignmentType.LEFT;

  const head = new TableRow({
    tableHeader: true,
    children: table.head.map((label, index) =>
      cell([para([text(label, { bold: true, size: 17, color: "46505F" })], { align: align(index) })], {
        widthDxa: widths[index],
        borders: HAIRLINES,
        shade: "EEF2F8",
      })
    ),
  });

  const body = table.rows.map((row, rowIndex) => {
    const shade = rowIndex % 2 === 1 ? FILL : undefined;
    return new TableRow({
      cantSplit: true,
      children: row.cells.map((value, index) => {
        const lines = value.split("\n");
        if (index === 0) {
          // Photo beside the name: a small table inside the cell keeps the
          // text from wrapping under the picture.
          const runs: (TextRun | ImageRun)[] = [];
          if (row.hasImageSlot && row.image) runs.push(imageRun(row.image, 9), text("   "));
          runs.push(text(lines[0], { size: 19 }));
          const paragraphs = [para(runs, { after: 0 })];
          for (const extra of lines.slice(1)) {
            paragraphs.push(para([text(extra, { size: 16, color: MUTED })], { after: 0 }));
          }
          return cell(paragraphs, { widthDxa: widths[index], borders: HAIRLINES, shade, verticalAlign: VerticalAlign.CENTER });
        }
        return cell(
          lines.map((line) => para([text(line, { size: 19 })], { align: align(index), after: 0 })),
          { widthDxa: widths[index], borders: HAIRLINES, shade, verticalAlign: VerticalAlign.CENTER }
        );
      }),
    });
  });

  const rows = [head, ...body];
  if (table.foot) {
    rows.push(
      new TableRow({
        children: table.foot.map((value, index) =>
          cell([para([text(value, { bold: index > 0, size: 19 })], { align: align(index) })], {
            widthDxa: widths[index],
            borders: HAIRLINES,
            shade: "F1F5F9",
          })
        ),
      })
    );
  }

  return new Table({
    width: { size: A4_CONTENT_WIDTH_DXA, type: WidthType.DXA },
    columnWidths: widths,
    rows,
  });
}

function totalsBlock(totals: Array<[string, string]>) {
  return totals.map(([label, value], index) => {
    const last = index === totals.length - 1;
    return new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { after: last ? 120 : 40, before: last ? 60 : 0 },
      border: last ? { top: { style: BorderStyle.SINGLE, size: 6, color: RULE, space: 4 } } : undefined,
      children: [
        text(`${label}    `, { size: last ? 24 : 20, color: last ? INK : MUTED, bold: last }),
        text(value, { size: last ? 24 : 20, bold: last }),
      ],
    });
  });
}

/** Builds the .docx and hands it to the browser as a download. */
export async function saveDocx(spec: DocxDocumentSpec) {
  const loadedLogo = spec.branding.businessLogoUrl
    ? await loadExportImage(spec.branding.businessLogoUrl)
    : null;
  const logo = loadedLogo ? await shrinkForThumbnail(loadedLogo, 512) : null;

  const footerLeft =
    spec.branding.footerLine ||
    [spec.branding.phone, spec.branding.email, spec.branding.website].filter(Boolean).join("  ·  ") ||
    spec.branding.businessName;

  const children: (Paragraph | Table)[] = [
    headerTable(spec, logo),
    para("", { after: 200 }),
    columnsTable(spec.columns),
    para("", { after: 160 }),
    linesTable(spec.table),
    para("", { after: 160 }),
  ];
  if (spec.totals) children.push(...totalsBlock(spec.totals));
  if (spec.notes && spec.notes.length > 0) {
    children.push(para([text("NOTES", { bold: true, size: 15, color: MUTED })], { before: 120, after: 60 }));
    for (const note of spec.notes) children.push(para([text(note, { size: 19 })], { after: 40 }));
  }

  const document = new Document({
    creator: "SydIN",
    title: `${spec.kind} ${spec.number}`,
    styles: { default: { document: { run: { font: "Calibri", size: 20, color: INK } } } },
    sections: [
      {
        properties: {
          page: {
            size: { width: Math.round(210 * MM), height: Math.round(297 * MM) },
            margin: { top: Math.round(18 * MM), bottom: Math.round(18 * MM), left: Math.round(20 * MM), right: Math.round(20 * MM) },
          },
        },
        headers: { default: new Header({ children: [] }) },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                border: { top: { style: BorderStyle.SINGLE, size: 4, color: RULE, space: 6 } },
                tabStops: [{ type: "right", position: A4_CONTENT_WIDTH_DXA }],
                children: [
                  text(footerLeft, { size: 15, color: MUTED }),
                  new TextRun({ text: "\t", size: 15 }),
                  text(`${spec.number}  ·  Page `, { size: 15, color: MUTED }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 15, color: MUTED, font: "Calibri" }),
                  text(" of ", { size: 15, color: MUTED }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 15, color: MUTED, font: "Calibri" }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(document);
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement("a");
  link.href = url;
  link.download = spec.filename;
  link.style.display = "none";
  window.document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return blob;
}
