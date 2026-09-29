import SydINMark from "@/components/brand/SydINMark";

/* The drawing on the left of the upgrade window (29 Sep, Sayed: "look how he
   uses images and drawings"). An open SydIN box with things coming out of it
   -- a QR label, a rising chart, a scanned barcode -- so the picture says
   "more you can do" without words. Pure SVG + the real brand mark, no image
   files; colours come from the upg-* classes so it follows the theme. */
export default function UpgradeIllustration({ className = "" }: { className?: string }) {
  return (
    <div className={`upg-art ${className}`.trim()} aria-hidden="true">
      <svg viewBox="0 0 260 240" className="upg-art-svg">
        <ellipse cx="130" cy="206" rx="92" ry="14" className="upg-art-shadow" />

        {/* floating cards behind the box */}
        <g className="upg-float upg-float-a">
          <rect x="22" y="46" width="62" height="62" rx="12" className="upg-art-card" />
          <g className="upg-art-ink">
            <rect x="32" y="56" width="16" height="16" rx="3" />
            <rect x="58" y="56" width="16" height="16" rx="3" />
            <rect x="32" y="82" width="16" height="16" rx="3" />
            <rect x="58" y="82" width="6" height="6" rx="1.5" />
            <rect x="68" y="92" width="6" height="6" rx="1.5" />
            <rect x="58" y="92" width="6" height="6" rx="1.5" />
          </g>
        </g>
        <g className="upg-float upg-float-b">
          <rect x="172" y="30" width="70" height="54" rx="12" className="upg-art-card" />
          <rect x="184" y="62" width="8" height="12" rx="2" className="upg-art-bar" />
          <rect x="197" y="54" width="8" height="20" rx="2" className="upg-art-bar" />
          <rect x="210" y="46" width="8" height="28" rx="2" className="upg-art-bar upg-art-bar-strong" />
          <rect x="223" y="40" width="8" height="34" rx="2" className="upg-art-bar upg-art-bar-strong" />
        </g>

        {/* the box */}
        <path d="M58 118 L130 98 L202 118 L130 140 Z" className="upg-art-box-inside" />
        <path d="M58 118 L130 140 L130 204 L58 180 Z" className="upg-art-box-left" />
        <path d="M202 118 L130 140 L130 204 L202 180 Z" className="upg-art-box-right" />
        <path d="M58 118 L30 100 L102 80 L130 98 Z" className="upg-art-flap" />
        <path d="M202 118 L230 100 L158 80 L130 98 Z" className="upg-art-flap upg-art-flap-r" />

        {/* barcode label on the box side */}
        <g className="upg-art-label">
          <path d="M148 156 L188 144 L188 164 L148 176 Z" />
          <path d="M154 158 v12 M159 157 v12 M162 156 v12 M167 154 v12 M171 153 v12 M176 152 v12 M180 150 v12" className="upg-art-barcode" />
        </g>

        {/* sparkles */}
        <g className="upg-sparkle upg-sparkle-a">
          <path d="M112 30 l4 10 10 4 -10 4 -4 10 -4 -10 -10 -4 10 -4 z" />
        </g>
        <g className="upg-sparkle upg-sparkle-b">
          <path d="M150 60 l2.5 6 6 2.5 -6 2.5 -2.5 6 -2.5 -6 -6 -2.5 6 -2.5 z" />
        </g>
        <g className="upg-sparkle upg-sparkle-c">
          <path d="M226 132 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3 z" />
        </g>
      </svg>
      {/* the real mark, on the front of the box */}
      <span className="upg-art-mark">
        <SydINMark size="sm" />
      </span>
    </div>
  );
}
