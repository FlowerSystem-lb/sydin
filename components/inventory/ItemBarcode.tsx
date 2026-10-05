"use client";

import { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";

/**
 * A scannable barcode drawn from the item's own code (item page v3, Sayed's
 * reference, 5 Oct 2026). Retail codes are EAN-13 / EAN-8 / UPC-A and are
 * drawn in that format, so the printed bars match the box; anything else
 * (an internal code with letters) is drawn as CODE128, which encodes any
 * text. A code that is not valid for its look-alike format (a 13-digit
 * number with a wrong check digit) falls back to CODE128 rather than
 * failing.
 */

type BarcodeFormat = "EAN13" | "EAN8" | "UPC" | "CODE128";

const FORMAT_LABELS: Record<BarcodeFormat, string> = {
  EAN13: "EAN-13 barcode",
  EAN8: "EAN-8 barcode",
  UPC: "UPC-A barcode",
  CODE128: "Code 128 barcode",
};

function guessFormat(value: string): BarcodeFormat {
  if (/^\d{13}$/.test(value)) return "EAN13";
  if (/^\d{12}$/.test(value)) return "UPC";
  if (/^\d{8}$/.test(value)) return "EAN8";
  return "CODE128";
}

export default function ItemBarcode({ value }: { value: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drawn, setDrawn] = useState<{ value: string; format: BarcodeFormat | null } | null>(
    null
  );

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const code = value.trim();
    const options = {
      height: 56,
      width: 1.6,
      margin: 0,
      fontSize: 13,
      textMargin: 4,
      font: "monospace",
      background: "#ffffff",
      lineColor: "#111318",
    };
    let format: BarcodeFormat | null = guessFormat(code);
    try {
      JsBarcode(svg, code, { ...options, format });
    } catch {
      try {
        format = "CODE128";
        JsBarcode(svg, code, { ...options, format });
      } catch {
        format = null;
      }
    }
    setDrawn({ value, format });
  }, [value]);

  const format = drawn?.value === value ? drawn.format : undefined;

  return (
    <figure className="item-barcode">
      <svg
        ref={svgRef}
        role="img"
        aria-label={`Barcode ${value}`}
        className={format === null ? "hidden" : undefined}
      />
      {format === null && <p className="item-barcode-fallback">{value}</p>}
      {format && <figcaption>{FORMAT_LABELS[format]}</figcaption>}
    </figure>
  );
}
