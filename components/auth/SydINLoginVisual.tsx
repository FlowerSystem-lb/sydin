import UiIcon, { type UiIconName } from "@/components/UiIcon";

/* Right half of sign-in / sign-up / reset (28 Sep 2026, from Sayed's design):
 * a calm light stage, the line "Everything in sync.", a glass ribbon drawn in
 * SVG that sways slowly, and three floating readouts joined by thin curves
 * with a dot travelling along each. It is an illustration of what SydIN
 * does, not live data -- the figures are examples. Every motion stops under
 * prefers-reduced-motion. Decorative only (aria-hidden).
 *
 * Two layers: the ribbon keeps its shape (fixed aspect, anchored bottom
 * right); the links and chips are placed in percentages of the whole panel
 * so they never sit behind the headline or run off the edge. */

const chips: Array<{
  id: string;
  icon: UiIconName;
  value: string;
  label: string;
}> = [
  { id: "items", icon: "box", value: "12,480", label: "Items" },
  { id: "accuracy", icon: "shield", value: "98.4%", label: "Stock accuracy" },
  { id: "moves", icon: "movement", value: "24", label: "Movements today" },
];

// In a 100 x 100 box stretched over the panel (lines only).
const LINKS = [
  "M 71 31 C 71 38, 74 41, 82 42 S 96 44, 101 46",
  "M -1 70 C 10 62, 20 61, 30 64 S 52 66, 64 70 S 76 75, 84 79",
];

export default function SydINLoginVisual() {
  return (
    <aside className="login-visual lv" aria-hidden="true">
      <span className="lv-live">
        <i />
        Live
      </span>

      <div className="lv-copy">
        <h2 className="lv-title">
          Everything
          <br />
          in <span>sync.</span>
        </h2>
        <p>Inventory, movement, and operations &mdash; connected in one workspace.</p>
      </div>

      <div className="lv-stage">
        <svg className="lv-ribbon" viewBox="0 0 600 800">
          <defs>
            <linearGradient id="lv-glass" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
              <stop offset="0.5" stopColor="#e6edff" stopOpacity="0.7" />
              <stop offset="1" stopColor="#ffffff" stopOpacity="0.2" />
            </linearGradient>
            <linearGradient id="lv-blue" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#c7d7ff" stopOpacity="0" />
              <stop offset="0.45" stopColor="#3b73ff" stopOpacity="0.7" />
              <stop offset="1" stopColor="#1d4ed8" stopOpacity="0.1" />
            </linearGradient>
            <linearGradient id="lv-edge" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
              <stop offset="0.5" stopColor="#ffffff" stopOpacity="1" />
              <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
            <filter id="lv-soft" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="5" />
            </filter>
            <filter id="lv-softer" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="26" />
            </filter>
          </defs>

          <g className="lv-ribbon-sway">
            <path
              d="M 640 110 C 470 240, 390 420, 340 560 S 190 770, -20 840"
              stroke="#3b6cff"
              strokeOpacity="0.18"
              strokeWidth="170"
              fill="none"
              filter="url(#lv-softer)"
            />
            {/* glass body */}
            <path
              d="M 660 90 C 480 220, 395 400, 345 540 S 205 760, -20 850 L 70 880 C 280 790, 400 620, 452 480 S 560 250, 690 170 Z"
              fill="url(#lv-glass)"
              filter="url(#lv-soft)"
            />
            {/* the blue core, seen through the glass */}
            <path
              className="lv-band"
              d="M 660 200 C 520 300, 458 440, 410 560 S 290 745, 110 860"
              stroke="url(#lv-blue)"
              strokeWidth="34"
              strokeLinecap="round"
              fill="none"
            />
            {/* a second, thinner fold */}
            <path
              className="lv-band lv-band-2"
              d="M 650 140 C 505 255, 425 420, 378 548 S 250 752, 40 846"
              stroke="url(#lv-glass)"
              strokeWidth="22"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d="M 670 250 C 540 340, 490 460, 446 574 S 340 760, 200 870"
              stroke="url(#lv-glass)"
              strokeOpacity="0.7"
              strokeWidth="14"
              strokeLinecap="round"
              fill="none"
            />
            {/* light running along the edge */}
            <path
              className="lv-shine"
              d="M 650 140 C 505 255, 425 420, 378 548 S 250 752, 40 846"
              stroke="url(#lv-edge)"
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
              pathLength={1}
            />
          </g>
        </svg>
      </div>

      <svg className="lv-links" viewBox="0 0 100 100" preserveAspectRatio="none">
        {LINKS.map((d, index) => (
          <g key={d} className="lv-link">
            <path
              d={d}
              stroke="#2f6bff"
              strokeOpacity="0.35"
              strokeWidth="1.2"
              vectorEffect="non-scaling-stroke"
              fill="none"
            />
            <circle r="0.7" fill="#2f6bff">
              <animateMotion dur={`${7 + index * 2}s`} repeatCount="indefinite" path={d} />
            </circle>
          </g>
        ))}
      </svg>

      {chips.map((chip) => (
        <div key={chip.id} className={`lv-chip lv-chip-${chip.id}`}>
          <span className="lv-chip-icon">
            <UiIcon name={chip.icon} className="h-4 w-4" />
          </span>
          <span>
            <strong>{chip.value}</strong>
            <small>{chip.label}</small>
          </span>
        </div>
      ))}
    </aside>
  );
}
