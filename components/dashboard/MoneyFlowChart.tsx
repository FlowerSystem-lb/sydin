"use client";

import { useId, useMemo, useState } from "react";
import { getPurchaseOrderTotalInBase, type PurchaseOrder } from "@/app/lib/purchaseOrders";
import { getSalesOrderTotalInBase, type SalesOrder } from "@/app/lib/salesOrders";
import { useMediaQuery } from "@/app/lib/useMediaQuery";

/**
 * Money in and money out, day by day, on the Overview.
 *
 * Why it exists: Sayed's reference dashboard has a real graph with its own
 * details -- period switch, two series, a readout on hover -- and the
 * Overview had only a 14-day sparkline beside one figure. This is that
 * graph, built from the sales orders and purchase orders the page already
 * loads. Nothing is estimated: a day's "Sales" is the sum of the invoices
 * issued that day (drafts and cancelled excluded), "Purchases" the sum of
 * the orders placed that day, both converted to the base currency the
 * page's other figures already use.
 *
 * Two series, one axis. Sales in the brand blue; purchases in ink with a
 * dashed line, so identity never rests on colour alone (legend, line
 * style and end labels all carry it). Hover snaps a hairline to the
 * nearest day and reads out both values -- the pointer aims at a date,
 * never at a line. Below the plot the same numbers are in a table for
 * screen readers and for anyone who wants the figures rather than the
 * shape.
 */

const PERIODS = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
] as const;

type PeriodDays = (typeof PERIODS)[number]["days"];

interface DayPoint {
  key: string; // YYYY-MM-DD
  date: Date;
  sales: number;
  purchases: number;
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function buildSeries(
  salesOrders: SalesOrder[],
  purchaseOrders: PurchaseOrder[],
  days: PeriodDays
): DayPoint[] {
  const now = new Date();
  const points: DayPoint[] = [];
  const byKey = new Map<string, DayPoint>();
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(now);
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - offset);
    const point = { key: dayKey(date), date, sales: 0, purchases: 0 };
    points.push(point);
    byKey.set(point.key, point);
  }
  for (const order of salesOrders) {
    if (order.status === "draft" || order.status === "cancelled") continue;
    const point = byKey.get((order.issue_date || order.created_at).slice(0, 10));
    if (point) point.sales += getSalesOrderTotalInBase(order);
  }
  for (const order of purchaseOrders) {
    if (order.status === "draft" || order.status === "cancelled") continue;
    const point = byKey.get((order.purchase_date || order.created_at).slice(0, 10));
    if (point) point.purchases += getPurchaseOrderTotalInBase(order);
  }
  return points;
}

const shortDate = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" });
const longDate = new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric" });

/** Round the top of the axis to a "nice" number so gridlines land on values a person would say. */
function niceCeiling(value: number) {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalised = value / magnitude;
  const step = normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10;
  return step * magnitude;
}

export default function MoneyFlowChart({
  salesOrders,
  purchaseOrders,
  formatMoney,
  loading,
}: {
  salesOrders: SalesOrder[];
  purchaseOrders: PurchaseOrder[];
  formatMoney: (value: number) => string;
  loading: boolean;
}) {
  const [days, setDays] = useState<PeriodDays>(30);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const id = useId();

  const points = useMemo(
    () => buildSeries(salesOrders, purchaseOrders, days),
    [salesOrders, purchaseOrders, days]
  );
  const totals = useMemo(
    () =>
      points.reduce(
        (sum, point) => ({
          sales: sum.sales + point.sales,
          purchases: sum.purchases + point.purchases,
        }),
        { sales: 0, purchases: 0 }
      ),
    [points]
  );
  const hasData = totals.sales > 0 || totals.purchases > 0;

  // ---- geometry: a fixed drawing space, scaled by the viewBox ------------
  // On a phone the same 720-unit drawing would shrink to half size and take
  // the 10px axis text down to 5px with it; a narrower drawing keeps the
  // text at its intended size.
  const compact = useMediaQuery("(max-width: 640px)");
  const width = compact ? 360 : 720;
  const height = compact ? 170 : 220;
  const pad = { top: 14, right: 16, bottom: 28, left: 8 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const max = niceCeiling(Math.max(...points.map((p) => Math.max(p.sales, p.purchases)), 0));
  const x = (index: number) =>
    pad.left + (points.length === 1 ? plotW / 2 : (index / (points.length - 1)) * plotW);
  const y = (value: number) => pad.top + plotH - (value / max) * plotH;
  const path = (pick: (p: DayPoint) => number) =>
    points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(pick(p)).toFixed(1)}`).join(" ");
  const area = `${path((p) => p.sales)} L${x(points.length - 1).toFixed(1)} ${(pad.top + plotH).toFixed(1)} L${x(0).toFixed(1)} ${(pad.top + plotH).toFixed(1)} Z`;

  // Four or five date labels along the bottom, never one per day.
  const tickEvery = days === 7 ? (compact ? 2 : 1) : days === 30 ? (compact ? 14 : 7) : (compact ? 30 : 15);
  const ticks = points
    .map((p, i) => ({ p, i }))
    .filter(({ i }) => (points.length - 1 - i) % tickEvery === 0);
  const gridValues = [max, max / 2];

  const hovered = hoverIndex === null ? null : points[hoverIndex];

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width) * width;
    const ratio = Math.min(1, Math.max(0, (px - pad.left) / plotW));
    setHoverIndex(Math.round(ratio * (points.length - 1)));
  };

  return (
    <section className="ov-section ov-chart" aria-labelledby={`${id}-title`}>
      <div className="ov-section-head">
        <div>
          <h2 id={`${id}-title`} className="ov-section-title">
            Sales and purchases
          </h2>
          <p className="ov-chart-sub">Money in and money out, by day</p>
        </div>
        <div className="ov-chart-periods" role="group" aria-label="Period">
          {PERIODS.map((period) => (
            <button
              key={period.days}
              type="button"
              className="ov-chart-period"
              aria-pressed={period.days === days}
              onClick={() => {
                setDays(period.days);
                setHoverIndex(null);
              }}
            >
              {period.label}
            </button>
          ))}
        </div>
      </div>

      <div className="ov-chart-totals" aria-live="polite">
        <span>
          <i className="ov-chart-key ov-chart-key-sales" aria-hidden="true" />
          <small>Sales</small>
          <strong>{formatMoney(totals.sales)}</strong>
        </span>
        <span>
          <i className="ov-chart-key ov-chart-key-purchases" aria-hidden="true" />
          <small>Purchases</small>
          <strong>{formatMoney(totals.purchases)}</strong>
        </span>
        <span>
          <small>Net</small>
          <strong className={totals.sales - totals.purchases < 0 ? "ov-chart-net-neg" : undefined}>
            {formatMoney(totals.sales - totals.purchases)}
          </strong>
        </span>
      </div>

      {loading ? (
        <div className="ov-chart-empty" aria-hidden="true" />
      ) : !hasData ? (
        <p className="ov-chart-empty">
          Nothing sold or bought in the last {days} days.
        </p>
      ) : (
        <div className="ov-chart-plot">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="ov-chart-svg"
            role="img"
            aria-label={`Sales and purchases per day, last ${days} days`}
            onPointerMove={onPointerMove}
            onPointerLeave={() => setHoverIndex(null)}
          >
            {gridValues.map((value) => (
              <g key={value}>
                <line
                  x1={pad.left}
                  x2={width - pad.right}
                  y1={y(value)}
                  y2={y(value)}
                  className="ov-chart-grid"
                />
                <text x={width - pad.right} y={y(value) - 4} textAnchor="end" className="ov-chart-axis">
                  {formatMoney(value)}
                </text>
              </g>
            ))}
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={pad.top + plotH}
              y2={pad.top + plotH}
              className="ov-chart-baseline"
            />
            <path d={area} className="ov-chart-area" />
            <path d={path((p) => p.purchases)} className="ov-chart-line ov-chart-line-purchases" />
            <path d={path((p) => p.sales)} className="ov-chart-line ov-chart-line-sales" />
            {ticks.map(({ p, i }) => (
              <text
                key={p.key}
                x={x(i)}
                y={height - 8}
                textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}
                className="ov-chart-axis"
              >
                {shortDate.format(p.date)}
              </text>
            ))}
            {hovered && hoverIndex !== null && (
              <g>
                <line
                  x1={x(hoverIndex)}
                  x2={x(hoverIndex)}
                  y1={pad.top}
                  y2={pad.top + plotH}
                  className="ov-chart-crosshair"
                />
                <circle cx={x(hoverIndex)} cy={y(hovered.sales)} r={4.5} className="ov-chart-dot ov-chart-dot-sales" />
                <circle cx={x(hoverIndex)} cy={y(hovered.purchases)} r={4.5} className="ov-chart-dot ov-chart-dot-purchases" />
              </g>
            )}
          </svg>
          {hovered && hoverIndex !== null && (
            <div
              className="ov-chart-tip"
              style={{
                left: `${(x(hoverIndex) / width) * 100}%`,
                transform: hoverIndex > points.length / 2 ? "translateX(-100%)" : undefined,
              }}
              role="status"
            >
              <div className="ov-chart-tip-date">{longDate.format(hovered.date)}</div>
              <div>
                <i className="ov-chart-key ov-chart-key-sales" aria-hidden="true" />
                <strong>{formatMoney(hovered.sales)}</strong>
                <span>Sales</span>
              </div>
              <div>
                <i className="ov-chart-key ov-chart-key-purchases" aria-hidden="true" />
                <strong>{formatMoney(hovered.purchases)}</strong>
                <span>Purchases</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* The same numbers as a table: reachable without a pointer, and
          readable when the shape is not the point. */}
      {hasData && !loading && (
        <details className="ov-chart-table">
          <summary>Show as a table</summary>
          <table>
            <thead>
              <tr>
                <th scope="col">Day</th>
                <th scope="col">Sales</th>
                <th scope="col">Purchases</th>
              </tr>
            </thead>
            <tbody>
              {points
                .filter((p) => p.sales > 0 || p.purchases > 0)
                .map((p) => (
                  <tr key={p.key}>
                    <td>{longDate.format(p.date)}</td>
                    <td>{formatMoney(p.sales)}</td>
                    <td>{formatMoney(p.purchases)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </details>
      )}
    </section>
  );
}
