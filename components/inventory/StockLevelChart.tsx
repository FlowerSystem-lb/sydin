"use client";

import { useId, useMemo, useState } from "react";

/**
 * How much of one item was on the shelf, over time.
 *
 * The item panel's Activity tab lists every movement, but a list of
 * "+12, -3, -5" does not show the shape: when stock was high, how fast it
 * ran down, how long it sat below the line before someone restocked. This
 * draws that shape from the same movements -- each movement's
 * `quantity_after` at its timestamp, as a step line (stock does not drift
 * between movements, it jumps), with the low-stock threshold as a dashed
 * rule so "below the line" is literal.
 *
 * Only movements are plotted, never estimates. It renders nothing until
 * there are two points to draw between.
 */

export interface StockLevelPoint {
  at: string; // ISO timestamp
  quantity: number;
}

const dateLabel = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" });
const dateTimeLabel = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export default function StockLevelChart({
  points,
  threshold,
  unitLabel,
}: {
  points: StockLevelPoint[];
  /** Low-stock line; omitted when the plan has no threshold. */
  threshold?: number;
  unitLabel: (quantity: number) => string;
}) {
  const id = useId();
  const [hover, setHover] = useState<number | null>(null);

  const series = useMemo(
    () =>
      [...points]
        .filter((p) => Number.isFinite(p.quantity) && !Number.isNaN(Date.parse(p.at)))
        .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
        .map((p) => ({ t: Date.parse(p.at), q: Math.max(0, p.quantity), at: p.at })),
    [points]
  );

  if (series.length < 2) return null;

  const width = 360;
  const height = 120;
  const pad = { top: 10, right: 10, bottom: 22, left: 8 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const t0 = series[0].t;
  const t1 = series[series.length - 1].t;
  const span = Math.max(1, t1 - t0);
  const max = Math.max(1, ...series.map((p) => p.q), threshold ?? 0);
  const x = (t: number) => pad.left + ((t - t0) / span) * plotW;
  const y = (q: number) => pad.top + plotH - (q / max) * plotH;

  // Step line: hold the previous level until the next movement, then jump.
  let d = `M${x(series[0].t).toFixed(1)} ${y(series[0].q).toFixed(1)}`;
  for (let i = 1; i < series.length; i += 1) {
    d += ` H${x(series[i].t).toFixed(1)} V${y(series[i].q).toFixed(1)}`;
  }
  const area = `${d} V${(pad.top + plotH).toFixed(1)} H${x(series[0].t).toFixed(1)} Z`;

  const hovered = hover === null ? null : series[hover];

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width) * width;
    const t = t0 + Math.min(1, Math.max(0, (px - pad.left) / plotW)) * span;
    // The level in force at that moment is the last movement at or before it.
    let index = 0;
    for (let i = 0; i < series.length; i += 1) if (series[i].t <= t) index = i;
    setHover(index);
  };

  return (
    <figure className="stock-chart" aria-labelledby={`${id}-title`}>
      <figcaption className="stock-chart-head">
        <span id={`${id}-title`}>Stock level over time</span>
        {threshold !== undefined && (
          <span className="stock-chart-legend">
            <i aria-hidden="true" /> Low-stock line at {unitLabel(threshold)}
          </span>
        )}
      </figcaption>
      <div className="stock-chart-plot">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="stock-chart-svg"
          role="img"
          aria-label={`Stock level from ${dateLabel.format(t0)} to ${dateLabel.format(t1)}`}
          onPointerMove={onPointerMove}
          onPointerLeave={() => setHover(null)}
        >
          <line x1={pad.left} x2={width - pad.right} y1={pad.top + plotH} y2={pad.top + plotH} className="stock-chart-baseline" />
          {threshold !== undefined && threshold > 0 && (
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={y(threshold)}
              y2={y(threshold)}
              className="stock-chart-threshold"
            />
          )}
          <path d={area} className="stock-chart-area" />
          <path d={d} className="stock-chart-line" />
          <text x={pad.left} y={height - 6} className="stock-chart-axis">
            {dateLabel.format(t0)}
          </text>
          <text x={width - pad.right} y={height - 6} textAnchor="end" className="stock-chart-axis">
            {dateLabel.format(t1)}
          </text>
          {hovered && (
            <g>
              <line x1={x(hovered.t)} x2={x(hovered.t)} y1={pad.top} y2={pad.top + plotH} className="stock-chart-crosshair" />
              <circle cx={x(hovered.t)} cy={y(hovered.q)} r={4} className="stock-chart-dot" />
            </g>
          )}
        </svg>
        {hovered && (
          <div
            className="stock-chart-tip"
            style={{
              left: `${(x(hovered.t) / width) * 100}%`,
              transform: x(hovered.t) > width / 2 ? "translateX(-100%)" : undefined,
            }}
            role="status"
          >
            <strong>{unitLabel(hovered.q)}</strong>
            <span>{dateTimeLabel.format(hovered.t)}</span>
          </div>
        )}
      </div>
    </figure>
  );
}
