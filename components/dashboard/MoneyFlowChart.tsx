"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { getPurchaseOrderTotalInBase, type PurchaseOrder } from "@/app/lib/purchaseOrders";
import {
  getSalesOrderPaidInBase,
  getSalesOrderTotalInBase,
  type SalesOrder,
} from "@/app/lib/salesOrders";
import type { StockMovement } from "@/app/lib/stockMovements";
import { useMediaQuery } from "@/app/lib/useMediaQuery";

/**
 * The Overview's graphs. First built to the anatomy of Sayed's reference
 * dashboard (20 Sep); reworked on 24 Sep after his note that it should read
 * more professionally, show more than one graph, switch between them in the
 * same place, and put a dotted vertical AND horizontal line with a dot under
 * the mouse.
 *
 * The wide panel is one plot with three views:
 *
 *   Sales               -- each bar is a day (a month on Yearly). The solid
 *                          part is what has been PAID, the light part what is
 *                          STILL OWED. A true part-of-whole, so it stacks.
 *   Sales vs purchases  -- money in against money out, side by side.
 *   Stock flow          -- units received against units that left, from the
 *                          stock movements the page already loads.
 *
 * ...each drawable as bars or as lines. The narrow panel beside it stays the
 * last 30 days of purchases, whatever the switch says.
 *
 * The plot is drawn at its real pixel width (measured), not a fixed viewBox
 * stretched to fit: that stretching is what made the old axis text grow and
 * shrink with the card. Text here is the size the stylesheet says.
 *
 * Nothing estimated: a day's sales is the invoices issued that day (drafts
 * and cancelled excluded), paid is their recorded payments, both in the base
 * currency the page's figures already use. Identity never rests on colour
 * alone: the legend names every series and the readout repeats the names.
 */

const PERIODS = [
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "yearly", label: "Yearly" },
] as const;
type PeriodKey = (typeof PERIODS)[number]["key"];

const METRICS = [
  { key: "sales", label: "Sales" },
  { key: "compare", label: "Sales vs purchases" },
  { key: "stock", label: "Stock flow" },
] as const;
type MetricKey = (typeof METRICS)[number]["key"];

type ChartKind = "bars" | "line";

/** The movements the Overview loads are capped here by getRecentStockMovements. */
const MOVEMENT_CAP = 250;

interface Bucket {
  key: string;
  label: string; // axis label
  full: string; // readout label
  paid: number;
  owed: number;
  purchases: number;
  unitsIn: number;
  unitsOut: number;
}

type Tone = "blue" | "blue-soft" | "orange";

interface Series {
  key: string;
  label: string;
  tone: Tone;
  values: number[];
  total: number;
}

const dayShort = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" });
const dayLong = new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric" });
const monthShort = new Intl.DateTimeFormat("en", { month: "short" });
const monthLong = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" });
const units = new Intl.NumberFormat("en", { maximumFractionDigits: 2 });

function isoDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

function emptyBucket(key: string, label: string, full: string): Bucket {
  return { key, label, full, paid: 0, owed: 0, purchases: 0, unitsIn: 0, unitsOut: 0 };
}

/** Days (weekly/monthly) or months (yearly), oldest first, every slot present. */
function buildBuckets(period: PeriodKey): Bucket[] {
  const now = new Date();
  const buckets: Bucket[] = [];
  if (period === "yearly") {
    for (let offset = 11; offset >= 0; offset -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - offset, 1, 12);
      buckets.push(emptyBucket(isoDay(date).slice(0, 7), monthShort.format(date), monthLong.format(date)));
    }
    return buckets;
  }
  const days = period === "weekly" ? 7 : 30;
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(now);
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - offset);
    buckets.push(emptyBucket(isoDay(date), dayShort.format(date), dayLong.format(date)));
  }
  return buckets;
}

function fill(
  buckets: Bucket[],
  period: PeriodKey,
  sales: SalesOrder[],
  purchases: PurchaseOrder[],
  movements: StockMovement[]
) {
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
  for (const movement of movements) {
    const bucket = byKey.get(keyFor(movement.created_at));
    if (!bucket) continue;
    const delta = Number(movement.quantity_delta) || 0;
    if (delta > 0) bucket.unitsIn += delta;
    else bucket.unitsOut += -delta;
  }
  return buckets;
}

function niceCeiling(value: number) {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const n = value / magnitude;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * magnitude;
}

/** "$20k" style: short, because the axis is a ruler, not a report. */
function compactWith(value: number, format: (v: number) => string) {
  if (value === 0) return "0";
  const trim = (s: string) => s.replace(/(\.\d*?)0+\b/, "$1").replace(/\.$/, "");
  if (Math.abs(value) >= 1_000_000) return trim(format(value / 1_000_000)) + "M";
  if (Math.abs(value) >= 1_000) return trim(format(value / 1_000)) + "k";
  return format(value);
}

/** A bar with only its data end rounded, anchored flat on the baseline. */
function barPath(x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.max(0, Math.min(r, w / 2, h));
  if (radius === 0) return `M${x},${y}h${w}v${h}h${-w}Z`;
  return (
    `M${x},${y + h}` +
    `V${y + radius}` +
    `Q${x},${y} ${x + radius},${y}` +
    `H${x + w - radius}` +
    `Q${x + w},${y} ${x + w},${y + radius}` +
    `V${y + h}Z`
  );
}

/** Real rendered width of an element, so the SVG never has to be stretched. */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    setWidth(Math.round(element.getBoundingClientRect().width));
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.round(entry.contentRect.width));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

function BarsIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path d="M3 13V8M8 13V3M13 13V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function LineIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path
        d="M2 12l4-5 3 3 5-6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export default function MoneyFlowChart({
  salesOrders,
  purchaseOrders,
  movements = [],
  formatMoney,
  loading,
}: {
  salesOrders: SalesOrder[];
  purchaseOrders: PurchaseOrder[];
  movements?: StockMovement[];
  formatMoney: (value: number) => string;
  loading: boolean;
}) {
  const [period, setPeriod] = useState<PeriodKey>("monthly");
  const [metric, setMetric] = useState<MetricKey>("sales");
  const [kind, setKind] = useState<ChartKind>("bars");
  const [hover, setHover] = useState<{ col: number; target: number } | null>(null);
  const [hoverOut, setHoverOut] = useState<number | null>(null);
  const id = useId();
  const narrow = useMediaQuery("(max-width: 640px)");
  const [plotRef, plotWidth] = useWidth<HTMLDivElement>();
  const [outRef, outWidth] = useWidth<HTMLDivElement>();

  const buckets = useMemo(
    () => fill(buildBuckets(period), period, salesOrders, purchaseOrders, movements),
    [period, salesOrders, purchaseOrders, movements]
  );
  // The right-hand panel is always the last 30 days, whatever the switch says:
  // it is a companion, not a second view of the same control.
  const outBuckets = useMemo(
    () => fill(buildBuckets("monthly"), "monthly", [], purchaseOrders, []),
    [purchaseOrders]
  );

  // ---- the view the switch asks for ---------------------------------------
  const view = useMemo(() => {
    const series = (key: string, label: string, tone: Tone, pick: (b: Bucket) => number): Series => {
      const values = buckets.map(pick);
      return { key, label, tone, values, total: values.reduce((s, v) => s + v, 0) };
    };
    const money = (v: number) => formatMoney(v);
    const count = (v: number) => units.format(v);

    if (metric === "compare") {
      const s = series("sales", "Sales", "blue", (b) => b.paid + b.owed);
      const p = series("purchases", "Purchases", "orange", (b) => b.purchases);
      return {
        series: [s, p],
        stacked: false,
        format: money,
        axis: (v: number) => compactWith(v, money),
        leadLabel: "Sales minus purchases",
        lead: money(s.total - p.total),
        empty: "No sales or purchases in this period.",
        unit: "money",
      };
    }
    if (metric === "stock") {
      const i = series("in", "Units in", "blue", (b) => b.unitsIn);
      const o = series("out", "Units out", "orange", (b) => b.unitsOut);
      return {
        series: [i, o],
        stacked: false,
        format: count,
        axis: (v: number) => compactWith(v, count),
        leadLabel: "Net change",
        lead: `${i.total - o.total > 0 ? "+" : ""}${count(i.total - o.total)} units`,
        empty: "No stock moved in this period.",
        unit: "units",
      };
    }
    const paid = series("paid", "Paid", "blue", (b) => b.paid);
    const owed = series("owed", "Still owed", "blue-soft", (b) => b.owed);
    return {
      series: [paid, owed],
      stacked: true,
      format: money,
      axis: (v: number) => compactWith(v, money),
      leadLabel: "Total sales",
      lead: money(paid.total + owed.total),
      empty: "No invoices in this period.",
      unit: "money",
    };
  }, [buckets, metric, formatMoney]);

  const hasData = view.series.some((s) => s.total > 0);
  const stackBars = view.stacked && kind === "bars";

  // The page loads the latest 250 movements. When that cap is hit and the
  // oldest of them is newer than the period's first day, older days in the
  // period are missing -- say so instead of drawing them as zero.
  const movementsTruncated =
    metric === "stock" &&
    movements.length >= MOVEMENT_CAP &&
    movements.reduce((min, m) => (m.created_at < min ? m.created_at : min), movements[0]?.created_at ?? "") >
      buckets[0].key;

  // ---- geometry at real pixels --------------------------------------------
  const width = Math.max(260, plotWidth || 640);
  const height = narrow ? 220 : 260;
  const cols = buckets.length;
  const peak = Math.max(
    0,
    ...buckets.map((_, c) =>
      stackBars
        ? view.series.reduce((s, series) => s + series.values[c], 0)
        : Math.max(...view.series.map((series) => series.values[c]))
    )
  );
  // Round steps (0, 2M, 4M, 6M), not quarters of a round top (1.25M, 3.75M).
  const step = niceCeiling(peak / 4);
  const ceiling = Math.max(step, Math.ceil(peak / step) * step);
  const yTicks = Array.from({ length: Math.round(ceiling / step) + 1 }, (_, i) => i * step);
  const longestTick = Math.max(...yTicks.map((v) => view.axis(v).length));
  const pad = { top: 12, right: 12, bottom: 28, left: Math.max(36, Math.round(longestTick * 7.2) + 14) };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const slot = plotW / cols;
  const xCenter = (c: number) => pad.left + c * slot + slot / 2;
  const yAt = (v: number) => pad.top + plotH - (v / ceiling) * plotH;
  const baseline = pad.top + plotH;
  // Label spacing from the space a label needs, not a fixed stride.
  const labelEvery = Math.max(1, Math.ceil(56 / slot));

  const toneClass = (tone: Tone) => `ov-tone-${tone}`;

  /**
   * Where the crosshair can land in a column: each series' value, or for a
   * stack each segment's top. The one nearest the pointer wins, so the
   * horizontal line sits on the thing the mouse is actually pointing at.
   */
  const targetsAt = (c: number) => {
    let running = 0;
    return view.series.map((series, index) => {
      const value = series.values[c];
      running += value;
      return { index, value, at: stackBars ? running : value };
    });
  };

  const onPlotMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;
    const col = Math.min(cols - 1, Math.max(0, Math.floor((px - pad.left) / slot)));
    const targets = targetsAt(col);
    let best = targets[0];
    for (const t of targets) {
      if (Math.abs(yAt(t.at) - py) < Math.abs(yAt(best.at) - py)) best = t;
    }
    setHover({ col, target: best.index });
  };

  const onPlotKey = (event: React.KeyboardEvent<SVGSVGElement>) => {
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const step = event.key === "ArrowRight" ? 1 : -1;
      const col = hover === null ? (step > 0 ? 0 : cols - 1) : Math.min(cols - 1, Math.max(0, hover.col + step));
      setHover({ col, target: hover?.target ?? 0 });
    } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      if (hover === null) return;
      event.preventDefault();
      const n = view.series.length;
      setHover({ col: hover.col, target: (hover.target + (event.key === "ArrowUp" ? 1 : n - 1)) % n });
    } else if (event.key === "Escape") {
      setHover(null);
    }
  };

  const hoveredTarget = hover === null ? null : targetsAt(hover.col)[hover.target];
  const hoverX = hover === null ? 0 : xCenter(hover.col);
  const hoverY = hoveredTarget ? yAt(hoveredTarget.at) : 0;

  // ---- bars -----------------------------------------------------------------
  const barMarks = () => {
    const k = view.series.length;
    if (stackBars) {
      const w = Math.max(3, Math.min(slot * 0.62, 34));
      return buckets.map((b, c) => {
        let running = 0;
        const x = xCenter(c) - w / 2;
        const segments = view.series.map((series, i) => {
          const value = series.values[c];
          if (value <= 0) return null;
          const y0 = yAt(running);
          running += value;
          const y1 = yAt(running);
          // 2px surface gap between segments; the top one keeps the rounding.
          const isTop = view.series.slice(i + 1).every((s) => s.values[c] <= 0);
          const bottom = running - value > 0 ? y0 - 2 : y0;
          const h = Math.max(1, bottom - y1);
          return (
            <path
              key={series.key}
              d={barPath(x, y1, w, h, isTop ? 4 : 0)}
              className={toneClass(series.tone)}
            />
          );
        });
        return (
          <g key={b.key} className={hover && hover.col !== c ? "ov-dim" : undefined}>
            {segments}
          </g>
        );
      });
    }
    const groupW = Math.max(4, Math.min(slot * 0.72, 18 * k + 2 * (k - 1)));
    const w = (groupW - 2 * (k - 1)) / k;
    return buckets.map((b, c) => (
      <g key={b.key} className={hover && hover.col !== c ? "ov-dim" : undefined}>
        {view.series.map((series, i) => {
          const value = series.values[c];
          if (value <= 0) return null;
          const x = xCenter(c) - groupW / 2 + i * (w + 2);
          const y = yAt(value);
          return (
            <path
              key={series.key}
              d={barPath(x, y, w, Math.max(1, baseline - y), 4)}
              className={toneClass(series.tone)}
            />
          );
        })}
      </g>
    ));
  };

  // ---- lines ----------------------------------------------------------------
  const lineMarks = () =>
    view.series.map((series, i) => {
      const points = series.values.map((v, c) => `${xCenter(c).toFixed(1)},${yAt(v).toFixed(1)}`);
      const line = `M${points.join("L")}`;
      const area = `${line}L${xCenter(cols - 1).toFixed(1)},${baseline}L${xCenter(0).toFixed(1)},${baseline}Z`;
      return (
        <g key={series.key}>
          {/* A faint fill under the first series only: two fills would muddy. */}
          {i === 0 && <path d={area} className={`ov-area ${toneClass(series.tone)}`} />}
          <path d={line} className={`ov-line ${toneClass(series.tone)}`} />
        </g>
      );
    });

  // ---- the narrow purchases panel --------------------------------------------
  const totalOut = outBuckets.reduce((s, b) => s + b.purchases, 0);
  const hasOut = totalOut > 0;
  const outW = Math.max(220, outWidth || 300);
  const outH = narrow ? 170 : 260;
  const outPad = { top: 12, right: 4, bottom: 28, left: 4 };
  const outPlotW = outW - outPad.left - outPad.right;
  const outPlotH = outH - outPad.top - outPad.bottom;
  const outCeiling = niceCeiling(Math.max(0, ...outBuckets.map((b) => b.purchases)));
  const outStep = outPlotW / outBuckets.length;
  const outHovered = hoverOut === null ? null : outBuckets[hoverOut];
  const outBarW = Math.max(2, Math.min(6, outStep * 0.45));

  const tipSide = (x: number, total: number) => (x > total / 2 ? "translateX(-100%)" : undefined);

  return (
    <div className="ov-graphs">
      {/* --------------------------------------------------- the analysis ---- */}
      <section className="ov-section ov-chart" aria-labelledby={`${id}-main`}>
        <h2 id={`${id}-main`} className="sr-only">
          {METRICS.find((m) => m.key === metric)?.label} chart
        </h2>
        <div className="ov-chart-head ov-chart-head-wrap">
          <div className="ov-chart-metrics" role="group" aria-label="Chart">
            {METRICS.map((m) => (
              <button
                key={m.key}
                type="button"
                className="ov-chart-metric"
                aria-pressed={m.key === metric}
                onClick={() => {
                  setMetric(m.key);
                  setHover(null);
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div className="ov-chart-controls">
            <div className="ov-chart-periods" role="group" aria-label="Chart type">
              <button
                type="button"
                className="ov-chart-period ov-chart-kind"
                aria-pressed={kind === "bars"}
                aria-label="Bars"
                title="Bars"
                onClick={() => setKind("bars")}
              >
                <BarsIcon />
              </button>
              <button
                type="button"
                className="ov-chart-period ov-chart-kind"
                aria-pressed={kind === "line"}
                aria-label="Line"
                title="Line"
                onClick={() => setKind("line")}
              >
                <LineIcon />
              </button>
            </div>
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
        </div>

        <div className="ov-chart-lead">
          <span className="ov-chart-lead-figure ov-chart-lead-stack">
            <small>{view.leadLabel}</small>
            <strong>{view.lead}</strong>
          </span>
          <span className="ov-chart-legend" aria-label="Legend">
            {view.series.map((series) => (
              <span key={series.key}>
                <i className={`ov-key ${toneClass(series.tone)}`} aria-hidden="true" />
                {series.label} <b>{view.format(series.total)}</b>
              </span>
            ))}
          </span>
        </div>

        <div className="ov-chart-plot" ref={plotRef}>
          {loading ? (
            <div className="ov-chart-empty" aria-hidden="true" />
          ) : !hasData ? (
            <p className="ov-chart-empty">{view.empty}</p>
          ) : plotWidth === 0 ? (
            <div style={{ height }} aria-hidden="true" />
          ) : (
            <>
              <svg
                width={width}
                height={height}
                viewBox={`0 0 ${width} ${height}`}
                className="ov-chart-svg"
                role="img"
                tabIndex={0}
                aria-label={`${METRICS.find((m) => m.key === metric)?.label} per ${
                  period === "yearly" ? "month" : "day"
                }. Use the arrow keys to read each ${period === "yearly" ? "month" : "day"}.`}
                onPointerMove={onPlotMove}
                onPointerLeave={() => setHover(null)}
                onKeyDown={onPlotKey}
                onBlur={() => setHover(null)}
              >
                {/* recessive gridlines and the y scale */}
                {yTicks.map((v) => (
                  <g key={v}>
                    <line
                      x1={pad.left}
                      x2={width - pad.right}
                      y1={yAt(v)}
                      y2={yAt(v)}
                      className={v === 0 ? "ov-chart-baseline" : "ov-chart-grid"}
                    />
                    <text x={pad.left - 8} y={yAt(v) + 4} textAnchor="end" className="ov-chart-axis">
                      {view.axis(v)}
                    </text>
                  </g>
                ))}

                {/* the hovered column, faintly */}
                {hover !== null && (
                  <rect
                    x={pad.left + hover.col * slot}
                    y={pad.top}
                    width={slot}
                    height={plotH}
                    className="ov-chart-band"
                  />
                )}

                {kind === "bars" ? barMarks() : lineMarks()}

                {/* x axis */}
                {buckets.map((b, c) =>
                  (cols - 1 - c) % labelEvery === 0 ? (
                    <text
                      key={b.key}
                      x={xCenter(c)}
                      y={height - 9}
                      textAnchor={c === cols - 1 ? "end" : c === 0 ? "start" : "middle"}
                      className={`ov-chart-axis${c === cols - 1 ? " ov-chart-axis-now" : ""}`}
                    >
                      {b.label}
                    </text>
                  ) : null
                )}

                {/* the crosshair: dotted vertical + horizontal, a dot where they meet */}
                {hover !== null && hoveredTarget && (
                  <g className="ov-crosshair" aria-hidden="true">
                    <line x1={hoverX} x2={hoverX} y1={pad.top} y2={baseline} className="ov-chart-crosshair" />
                    <line x1={pad.left} x2={width - pad.right} y1={hoverY} y2={hoverY} className="ov-chart-crosshair" />
                    {kind === "line" &&
                      view.series.map((series, i) =>
                        i === hover.target ? null : (
                          <circle
                            key={series.key}
                            cx={hoverX}
                            cy={yAt(series.values[hover.col])}
                            r={3.5}
                            className={`ov-dot ${toneClass(series.tone)}`}
                          />
                        )
                      )}
                    <circle
                      cx={hoverX}
                      cy={hoverY}
                      r={5}
                      className={`ov-dot ov-dot-main ${toneClass(view.series[hover.target].tone)}`}
                    />
                    {/* value on the y axis, date on the x axis */}
                    {(() => {
                      const text = view.axis(hoveredTarget.at);
                      const w = Math.max(28, text.length * 7.2 + 12);
                      const y = Math.min(Math.max(hoverY - 10, 0), height - 20);
                      return (
                        <g>
                          <rect x={pad.left - w - 3} y={y} width={w} height={20} rx={5} className="ov-axis-pill" />
                          <text x={pad.left - 3 - w / 2} y={y + 14} textAnchor="middle" className="ov-axis-pill-text">
                            {text}
                          </text>
                        </g>
                      );
                    })()}
                    {(() => {
                      const text = buckets[hover.col].label;
                      const w = text.length * 7 + 14;
                      const x = Math.min(Math.max(hoverX - w / 2, 0), width - w);
                      return (
                        <g>
                          <rect x={x} y={height - 23} width={w} height={20} rx={5} className="ov-axis-pill" />
                          <text x={x + w / 2} y={height - 9} textAnchor="middle" className="ov-axis-pill-text">
                            {text}
                          </text>
                        </g>
                      );
                    })()}
                  </g>
                )}
              </svg>

              {hover !== null && (
                <div
                  className="ov-chart-tip"
                  style={{
                    left: `${hoverX}px`,
                    top: `${Math.max(0, Math.min(hoverY - 24, height - 120))}px`,
                    transform: tipSide(hoverX, width),
                  }}
                  role="status"
                >
                  <div className="ov-chart-tip-date">{buckets[hover.col].full}</div>
                  {view.series.map((series, i) => (
                    <div key={series.key} className={i === hover.target ? "is-target" : undefined}>
                      <i className={`ov-key ${toneClass(series.tone)}`} aria-hidden="true" />
                      <strong>{view.format(series.values[hover.col])}</strong>
                      <span>{series.label}</span>
                    </div>
                  ))}
                  {view.stacked && (
                    <div className="ov-chart-tip-total">
                      <strong>{view.format(view.series.reduce((s, x) => s + x.values[hover.col], 0))}</strong>
                      <span>Total</span>
                    </div>
                  )}
                </div>
              )}

              {/* The same numbers as a table, for screen readers. */}
              <table className="sr-only">
                <caption>{METRICS.find((m) => m.key === metric)?.label}</caption>
                <thead>
                  <tr>
                    <th scope="col">{period === "yearly" ? "Month" : "Day"}</th>
                    {view.series.map((s) => (
                      <th key={s.key} scope="col">
                        {s.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {buckets.map((b, c) => (
                    <tr key={b.key}>
                      <th scope="row">{b.full}</th>
                      {view.series.map((s) => (
                        <td key={s.key}>{view.format(s.values[c])}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
        {movementsTruncated && !loading && (
          <p className="ov-chart-note">Based on your latest {MOVEMENT_CAP} stock movements.</p>
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
          <span className="ov-chart-lead-figure ov-chart-lead-stack">
            <small>Money out, 30 days</small>
            <strong>{formatMoney(totalOut)}</strong>
          </span>
        </div>
        <div className="ov-chart-plot" ref={outRef}>
          {loading ? (
            <div className="ov-chart-empty" aria-hidden="true" />
          ) : !hasOut ? (
            <p className="ov-chart-empty">No purchases in the last 30 days.</p>
          ) : outWidth === 0 ? (
            <div style={{ height: outH }} aria-hidden="true" />
          ) : (
            <>
              <svg
                width={outW}
                height={outH}
                viewBox={`0 0 ${outW} ${outH}`}
                className="ov-chart-svg"
                role="img"
                aria-label="Purchases per day, last 30 days"
                onPointerMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const px = e.clientX - rect.left - outPad.left;
                  setHoverOut(Math.min(outBuckets.length - 1, Math.max(0, Math.floor(px / outStep))));
                }}
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
                      <path
                        d={barPath(cx - outBarW / 2, outPad.top, outBarW, outPlotH, outBarW / 2)}
                        className="ov-bar-track-fill"
                      />
                      {b.purchases > 0 && (
                        <path
                          d={barPath(cx - outBarW / 2, outPad.top + outPlotH - h, outBarW, Math.max(1, h), outBarW / 2)}
                          className={hoverOut === c ? "ov-tone-orange is-hover" : "ov-tone-orange"}
                        />
                      )}
                    </g>
                  );
                })}
                {hoverOut !== null && outHovered && (
                  <g aria-hidden="true">
                    <line
                      x1={outPad.left + hoverOut * outStep + outStep / 2}
                      x2={outPad.left + hoverOut * outStep + outStep / 2}
                      y1={outPad.top}
                      y2={outPad.top + outPlotH}
                      className="ov-chart-crosshair"
                    />
                    <line
                      x1={outPad.left}
                      x2={outW - outPad.right}
                      y1={outPad.top + outPlotH - (outHovered.purchases / outCeiling) * outPlotH}
                      y2={outPad.top + outPlotH - (outHovered.purchases / outCeiling) * outPlotH}
                      className="ov-chart-crosshair"
                    />
                    <circle
                      cx={outPad.left + hoverOut * outStep + outStep / 2}
                      cy={outPad.top + outPlotH - (outHovered.purchases / outCeiling) * outPlotH}
                      r={4.5}
                      className="ov-dot ov-dot-main ov-tone-orange"
                    />
                  </g>
                )}
                <text x={outPad.left} y={outH - 9} className="ov-chart-axis">
                  {outBuckets[0].label}
                </text>
                <text x={outW - outPad.right} y={outH - 9} textAnchor="end" className="ov-chart-axis ov-chart-axis-now">
                  {outBuckets[outBuckets.length - 1].label}
                </text>
              </svg>
              {outHovered && hoverOut !== null && (
                <div
                  className="ov-chart-tip"
                  style={{
                    left: `${outPad.left + hoverOut * outStep + outStep / 2}px`,
                    top: "0.25rem",
                    transform: tipSide(outPad.left + hoverOut * outStep, outW),
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
            </>
          )}
        </div>
      </section>
    </div>
  );
}
