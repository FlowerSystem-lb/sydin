"use client";

import { useId, useMemo, useState } from "react";
import { getPurchaseOrderTotalInBase, type PurchaseOrder } from "@/app/lib/purchaseOrders";
import {
  getSalesOrderPaidInBase,
  getSalesOrderTotalInBase,
  type SalesOrder,
} from "@/app/lib/salesOrders";
import { useMediaQuery } from "@/app/lib/useMediaQuery";

/**
 * The Overview's graphs, built to the anatomy of Sayed's reference dashboard
 * (20 Sep): a wide "trend" panel whose bars are made of small squares on a
 * faint dotted grid, stacked two-tone, with the period's total as a lead
 * figure, a legend beside it and a Weekly / Monthly / Yearly switch; and a
 * narrower panel at its right with thin vertical bars over a date range.
 *
 * On real data, with SydIN's meanings:
 *
 *   Sales trend   -- each bar is a day (or a month on Yearly). The dark
 *                    squares are the part of that day's invoices that has
 *                    been PAID, the light squares what is STILL OWED. A true
 *                    part-of-whole, which is what a stacked bar is for; the
 *                    owner's question is "did I get the money?".
 *   Purchases     -- money out, one thin bar per day, last 30 days.
 *
 * Nothing estimated: a day's sales is the sum of invoices issued that day
 * (drafts and cancelled excluded), paid is their recorded payments, both in
 * the base currency the page's figures already use. Identity never rests on
 * colour alone: legend, tone and the readout all carry it.
 */

const PERIODS = [
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "yearly", label: "Yearly" },
] as const;
type PeriodKey = (typeof PERIODS)[number]["key"];

interface Bucket {
  key: string;
  label: string; // axis label
  full: string; // readout label
  paid: number;
  owed: number;
  purchases: number;
}

const dayShort = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" });
const dayLong = new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric" });
const monthShort = new Intl.DateTimeFormat("en", { month: "short" });
const monthLong = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" });

function isoDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

/** Days (weekly/monthly) or months (yearly), oldest first, every slot present. */
function buildBuckets(period: PeriodKey): Bucket[] {
  const now = new Date();
  const buckets: Bucket[] = [];
  if (period === "yearly") {
    for (let offset = 11; offset >= 0; offset -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - offset, 1, 12);
      buckets.push({
        key: isoDay(date).slice(0, 7),
        label: monthShort.format(date),
        full: monthLong.format(date),
        paid: 0,
        owed: 0,
        purchases: 0,
      });
    }
    return buckets;
  }
  const days = period === "weekly" ? 7 : 30;
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(now);
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - offset);
    buckets.push({
      key: isoDay(date),
      label: dayShort.format(date),
      full: dayLong.format(date),
      paid: 0,
      owed: 0,
      purchases: 0,
    });
  }
  return buckets;
}

function fill(buckets: Bucket[], period: PeriodKey, sales: SalesOrder[], purchases: PurchaseOrder[]) {
  const byKey = new Map(buckets.map((b) => [b.key, b]));
  const keyFor = (iso: string) => (period === "yearly" ? iso.slice(0, 7) : iso.slice(0, 10));
  for (const order of sales) {
    if (order.status === "draft" || order.status === "cancelled") continue;
    const bucket = byKey.get(keyFor(order.issue_date || order.created_at));
    if (!bucket) continue;
    const total = getSalesOrderTotalInBase(order);
    const paid = Math.min(total, getSalesOrderPaidInBase(order));
    bucket.paid += paid;
    bucket.owed += Math.max(0, total - paid);
  }
  for (const order of purchases) {
    if (order.status === "draft" || order.status === "cancelled") continue;
    const bucket = byKey.get(keyFor(order.purchase_date || order.created_at));
    if (bucket) bucket.purchases += getPurchaseOrderTotalInBase(order);
  }
  return buckets;
}

function niceCeiling(value: number) {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const n = value / magnitude;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * magnitude;
}

/** "$20k" style axis labels: short, because the axis is a ruler, not a report. */
function compact(value: number, formatMoney: (v: number) => string) {
  if (value === 0) return "0";
  if (value >= 1_000_000) return formatMoney(value / 1_000_000).replace(/(\.\d*?)0+\b/, "$1").replace(/\.$/, "") + "M";
  if (value >= 1_000) return formatMoney(value / 1_000).replace(/(\.\d*?)0+\b/, "$1").replace(/\.$/, "") + "k";
  return formatMoney(value);
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
  const [period, setPeriod] = useState<PeriodKey>("monthly");
  const [hover, setHover] = useState<number | null>(null);
  const [hoverOut, setHoverOut] = useState<number | null>(null);
  const id = useId();
  const narrow = useMediaQuery("(max-width: 640px)");

  const buckets = useMemo(
    () => fill(buildBuckets(period), period, salesOrders, purchaseOrders),
    [period, salesOrders, purchaseOrders]
  );
  // The right-hand panel is always the last 30 days, whatever the switch says:
  // it is a companion, not a second view of the same control.
  const outBuckets = useMemo(
    () => fill(buildBuckets("monthly"), "monthly", [], purchaseOrders),
    [purchaseOrders]
  );

  const totalSales = buckets.reduce((s, b) => s + b.paid + b.owed, 0);
  const totalPaid = buckets.reduce((s, b) => s + b.paid, 0);
  const totalOut = outBuckets.reduce((s, b) => s + b.purchases, 0);
  const hasSales = totalSales > 0;
  const hasOut = totalOut > 0;

  // ---- the pixel bars ----------------------------------------------------
  // A grid of cells; each column is a bucket, each filled cell a slice of
  // the axis ceiling. The faint background grid is the reference's, and it
  // does a job: it shows the scale even where a bar is empty.
  const rows = 18;
  const width = narrow ? 360 : 640;
  const height = narrow ? 190 : 230;
  const pad = { top: 8, right: 8, bottom: 24, left: narrow ? 34 : 40 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const cols = buckets.length;
  const cellW = plotW / cols;
  const cellH = plotH / rows;
  const gap = Math.min(2, cellW * 0.22);
  const ceiling = niceCeiling(Math.max(0, ...buckets.map((b) => b.paid + b.owed)));
  const cellsFor = (value: number) => (value <= 0 ? 0 : Math.max(1, Math.round((value / ceiling) * rows)));
  const tickEvery = period === "weekly" ? 1 : period === "monthly" ? (narrow ? 7 : 5) : narrow ? 2 : 1;
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * ceiling);

  const hovered = hover === null ? null : buckets[hover];

  // ---- the thin bars ------------------------------------------------------
  const outW = narrow ? 360 : 300;
  const outH = narrow ? 150 : 230;
  const outPad = { top: 8, right: 4, bottom: 24, left: 4 };
  const outPlotW = outW - outPad.left - outPad.right;
  const outPlotH = outH - outPad.top - outPad.bottom;
  const outCeiling = niceCeiling(Math.max(0, ...outBuckets.map((b) => b.purchases)));
  const outStep = outPlotW / outBuckets.length;
  const outHovered = hoverOut === null ? null : outBuckets[hoverOut];

  const columnAt = (event: React.PointerEvent<SVGSVGElement>, left: number, w: number, n: number, total: number) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width) * total;
    return Math.min(n - 1, Math.max(0, Math.floor((px - left) / (w / n))));
  };

  return (
    <div className="ov-graphs">
      {/* ------------------------------------------------ sales trend ---- */}
      <section className="ov-section ov-chart" aria-labelledby={`${id}-sales`}>
        <div className="ov-chart-head">
          <h2 id={`${id}-sales`} className="ov-chart-title">
            Sales trend
          </h2>
          <div className="ov-chart-periods" role="group" aria-label="Period">
            {PERIODS.map((p) => (
              <button
                key={p.key}
                type="button"
                className="ov-chart-period"
                aria-pressed={p.key === period}
                onClick={() => {
                  setPeriod(p.key);
                  setHover(null);
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="ov-chart-lead">
          <span className="ov-chart-lead-figure">
            <small>Total sales</small>
            <strong>{formatMoney(totalSales)}</strong>
          </span>
          <span className="ov-chart-legend" aria-label="Legend">
            <span>
              <i className="ov-cell ov-cell-paid" aria-hidden="true" /> Paid{" "}
              <b>{formatMoney(totalPaid)}</b>
            </span>
            <span>
              <i className="ov-cell ov-cell-owed" aria-hidden="true" /> Still owed{" "}
              <b>{formatMoney(totalSales - totalPaid)}</b>
            </span>
          </span>
        </div>

        {loading ? (
          <div className="ov-chart-empty" aria-hidden="true" />
        ) : !hasSales ? (
          <p className="ov-chart-empty">
            No invoices in this period.
          </p>
        ) : (
          <div className="ov-chart-plot">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="ov-chart-svg"
              role="img"
              aria-label={`Sales per ${period === "yearly" ? "month" : "day"}, paid and still owed`}
              onPointerMove={(e) => setHover(columnAt(e, pad.left, plotW, cols, width))}
              onPointerLeave={() => setHover(null)}
            >
              {/* background grid of faint cells */}
              {buckets.map((_, c) =>
                Array.from({ length: rows }, (_, r) => (
                  <rect
                    key={`${c}-${r}`}
                    x={pad.left + c * cellW + gap / 2}
                    y={pad.top + r * cellH + gap / 2}
                    width={Math.max(0.5, cellW - gap)}
                    height={Math.max(0.5, cellH - gap)}
                    rx={1}
                    className="ov-cell-bg"
                  />
                ))
              )}
              {/* y axis */}
              {yTicks.map((v) => (
                <text
                  key={v}
                  x={pad.left - 6}
                  y={pad.top + plotH - (v / ceiling) * plotH + 3}
                  textAnchor="end"
                  className="ov-chart-axis"
                >
                  {compact(v, formatMoney)}
                </text>
              ))}
              {/* the bars */}
              {buckets.map((b, c) => {
                const paidCells = cellsFor(b.paid);
                const owedCells = cellsFor(b.owed);
                const total = Math.min(rows, paidCells + owedCells);
                const cells = [];
                for (let r = 0; r < total; r += 1) {
                  const paidSlot = r < paidCells;
                  cells.push(
                    <rect
                      key={r}
                      x={pad.left + c * cellW + gap / 2}
                      y={pad.top + plotH - (r + 1) * cellH + gap / 2}
                      width={Math.max(0.5, cellW - gap)}
                      height={Math.max(0.5, cellH - gap)}
                      rx={1}
                      className={paidSlot ? "ov-cell-paid" : "ov-cell-owed"}
                    />
                  );
                }
                return <g key={b.key}>{cells}</g>;
              })}
              {/* x axis */}
              {buckets.map((b, c) =>
                (cols - 1 - c) % tickEvery === 0 ? (
                  <text
                    key={b.key}
                    x={pad.left + c * cellW + cellW / 2}
                    y={height - 7}
                    textAnchor="middle"
                    className={`ov-chart-axis${c === cols - 1 ? " ov-chart-axis-now" : ""}`}
                  >
                    {b.label}
                  </text>
                ) : null
              )}
              {hover !== null && (
                <line
                  x1={pad.left + hover * cellW + cellW / 2}
                  x2={pad.left + hover * cellW + cellW / 2}
                  y1={pad.top}
                  y2={pad.top + plotH}
                  className="ov-chart-crosshair"
                />
              )}
            </svg>
            {hovered && hover !== null && (
              <div
                className="ov-chart-tip"
                style={{
                  left: `${((pad.left + hover * cellW + cellW / 2) / width) * 100}%`,
                  transform: hover > cols / 2 ? "translateX(-100%)" : undefined,
                }}
                role="status"
              >
                <div className="ov-chart-tip-date">{hovered.full}</div>
                <div>
                  <i className="ov-cell ov-cell-paid" aria-hidden="true" />
                  <strong>{formatMoney(hovered.paid)}</strong>
                  <span>Paid</span>
                </div>
                <div>
                  <i className="ov-cell ov-cell-owed" aria-hidden="true" />
                  <strong>{formatMoney(hovered.owed)}</strong>
                  <span>Still owed</span>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ------------------------------------------------- purchases ----- */}
      <section className="ov-section ov-chart" aria-labelledby={`${id}-out`}>
        <div className="ov-chart-head">
          <h2 id={`${id}-out`} className="ov-chart-title">
            Purchases
          </h2>
          <span className="ov-chart-range">
            {outBuckets[0].label} – {outBuckets[outBuckets.length - 1].label}
          </span>
        </div>
        <div className="ov-chart-lead">
          <span className="ov-chart-lead-figure">
            <small>Money out, 30 days</small>
            <strong>{formatMoney(totalOut)}</strong>
          </span>
        </div>
        {loading ? (
          <div className="ov-chart-empty" aria-hidden="true" />
        ) : !hasOut ? (
          <p className="ov-chart-empty">No purchases in the last 30 days.</p>
        ) : (
          <div className="ov-chart-plot">
            <svg
              viewBox={`0 0 ${outW} ${outH}`}
              className="ov-chart-svg"
              role="img"
              aria-label="Purchases per day, last 30 days"
              onPointerMove={(e) => setHoverOut(columnAt(e, outPad.left, outPlotW, outBuckets.length, outW))}
              onPointerLeave={() => setHoverOut(null)}
            >
              <line
                x1={outPad.left}
                x2={outW - outPad.right}
                y1={outPad.top + outPlotH}
                y2={outPad.top + outPlotH}
                className="ov-chart-baseline"
              />
              {outBuckets.map((b, c) => {
                const cx = outPad.left + c * outStep + outStep / 2;
                const h = (b.purchases / outCeiling) * outPlotH;
                return (
                  <g key={b.key}>
                    {/* the faint full-height track behind each bar */}
                    <line x1={cx} x2={cx} y1={outPad.top} y2={outPad.top + outPlotH} className="ov-bar-track" />
                    {b.purchases > 0 && (
                      <line
                        x1={cx}
                        x2={cx}
                        y1={outPad.top + outPlotH - h}
                        y2={outPad.top + outPlotH}
                        className={`ov-bar${hoverOut === c ? " is-hover" : ""}`}
                      />
                    )}
                  </g>
                );
              })}
              <text x={outPad.left} y={outH - 7} className="ov-chart-axis">
                {outBuckets[0].label}
              </text>
              <text x={outW - outPad.right} y={outH - 7} textAnchor="end" className="ov-chart-axis ov-chart-axis-now">
                {outBuckets[outBuckets.length - 1].label}
              </text>
            </svg>
            {outHovered && hoverOut !== null && (
              <div
                className="ov-chart-tip"
                style={{
                  left: `${((outPad.left + hoverOut * outStep + outStep / 2) / outW) * 100}%`,
                  transform: hoverOut > outBuckets.length / 2 ? "translateX(-100%)" : undefined,
                }}
                role="status"
              >
                <div className="ov-chart-tip-date">{outHovered.full}</div>
                <div>
                  <strong>{formatMoney(outHovered.purchases)}</strong>
                  <span>Purchases</span>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
