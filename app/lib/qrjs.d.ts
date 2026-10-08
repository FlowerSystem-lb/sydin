// qr.js ships no types; it comes with react-qr-code. Only what the PO PDF
// footer uses (purchaseOrderPdfExport.ts) is declared.
declare module "qr.js/lib/QRCode" {
  export default class QRCode {
    constructor(typeNumber: number, errorCorrectLevel: number);
    addData(data: string): void;
    make(): void;
    getModuleCount(): number;
    isDark(row: number, col: number): boolean;
  }
}

declare module "qr.js/lib/ErrorCorrectLevel" {
  const ErrorCorrectLevel: { L: number; M: number; Q: number; H: number };
  export default ErrorCorrectLevel;
}
