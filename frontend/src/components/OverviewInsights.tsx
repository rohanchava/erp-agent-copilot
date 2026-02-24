"use client";

import { useEffect, useMemo, useState } from "react";

import { fetchOverviewTimeline, fetchTopMovers, MoverRow, OverviewTimelinePoint } from "@/lib/api";

const WINDOWS = [7, 30, 90];

function linePath(values: number[], width: number, height: number): string {
  if (values.length === 0) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);

  return values
    .map((v, i) => {
      const x = (i / Math.max(values.length - 1, 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${i === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");
}

function MoversList({ rows, color }: { rows: MoverRow[]; color: "green" | "red" }) {
  return (
    <div className="space-y-2">
      {rows.slice(0, 4).map((row) => (
        <div key={row.sku_id} className="rounded-lg border border-slate-200 bg-white p-2 text-xs">
          <p className="font-semibold text-slate-800">{row.sku_id}</p>
          <p className="text-slate-600">{row.sku_name}</p>
          <p className={color === "green" ? "text-emerald-700" : "text-rose-700"}>
            {row.change_pct.toFixed(1)}% ({row.change_units >= 0 ? "+" : ""}
            {row.change_units})
          </p>
        </div>
      ))}
    </div>
  );
}

export function OverviewInsights() {
  const [days, setDays] = useState(30);
  const [timeline, setTimeline] = useState<OverviewTimelinePoint[]>([]);
  const [movers, setMovers] = useState<{ gainers: MoverRow[]; decliners: MoverRow[] }>({ gainers: [], decliners: [] });
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setError("");
      try {
        const [t, m] = await Promise.all([fetchOverviewTimeline(days), fetchTopMovers(days, 5)]);
        setTimeline(t);
        setMovers(m);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load insights");
      }
    }
    load();
  }, [days]);

  const orderSeries = useMemo(() => timeline.map((p) => p.order_count), [timeline]);
  const delaySeries = useMemo(() => timeline.map((p) => p.delayed_shipments), [timeline]);
  const fillRateSeries = useMemo(() => timeline.map((p) => p.avg_fill_rate * 100), [timeline]);

  return (
    <section className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-md backdrop-blur">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Interactive Snapshot</p>
          <h2 className="font-heading text-lg text-slate-900">Operational Pulse</h2>
        </div>

        <div className="flex gap-2 rounded-xl bg-slate-100 p-1">
          {WINDOWS.map((w) => (
            <button
              key={w}
              onClick={() => setDays(w)}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                days === w ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-200"
              }`}
            >
              {w}D
            </button>
          ))}
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <article className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Orders Trend</p>
          <svg viewBox="0 0 300 90" className="mt-2 h-24 w-full">
            <path d={linePath(orderSeries, 300, 90)} fill="none" stroke="#0891b2" strokeWidth="3" />
          </svg>
          <p className="text-xs text-slate-600">Daily order count in last {days} days</p>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Delayed Shipments</p>
          <svg viewBox="0 0 300 90" className="mt-2 h-24 w-full">
            <path d={linePath(delaySeries, 300, 90)} fill="none" stroke="#e11d48" strokeWidth="3" />
          </svg>
          <p className="text-xs text-slate-600">Daily delayed shipments in last {days} days</p>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Fill Rate %</p>
          <svg viewBox="0 0 300 90" className="mt-2 h-24 w-full">
            <path d={linePath(fillRateSeries, 300, 90)} fill="none" stroke="#16a34a" strokeWidth="3" />
          </svg>
          <p className="text-xs text-slate-600">Daily avg fill rate in last {days} days</p>
        </article>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-sm font-semibold text-emerald-800">Top Stock Gainers ({days}D)</p>
          <div className="mt-2">
            <MoversList rows={movers.gainers} color="green" />
          </div>
        </article>

        <article className="rounded-xl border border-rose-200 bg-rose-50 p-3">
          <p className="text-sm font-semibold text-rose-800">Top Stock Decliners ({days}D)</p>
          <div className="mt-2">
            <MoversList rows={movers.decliners} color="red" />
          </div>
        </article>
      </div>
    </section>
  );
}
