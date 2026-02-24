"use client";

import { useEffect, useMemo, useState } from "react";

import { fetchSkus, fetchStockTrend, SkuRecord, StockTrendResponse, TrendPoint } from "@/lib/api";

function buildPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return "";
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
}

function scaleSeries(series: TrendPoint[], width: number, height: number, yMin: number, yMax: number) {
  const safeRange = Math.max(yMax - yMin, 1);
  return series.map((p, idx) => {
    const x = (idx / Math.max(series.length - 1, 1)) * width;
    const y = height - ((p.on_hand - yMin) / safeRange) * height;
    return { x, y };
  });
}

export function TrendPanel() {
  const [skus, setSkus] = useState<SkuRecord[]>([]);
  const [selectedSku, setSelectedSku] = useState<string>("SKU-1000");
  const [trend, setTrend] = useState<StockTrendResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadSkus() {
      try {
        const data = await fetchSkus(100);
        setSkus(data);
        if (data.length > 0) {
          setSelectedSku(data[0].sku_id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load SKUs");
      }
    }
    loadSkus();
  }, []);

  useEffect(() => {
    if (!selectedSku) return;
    async function loadTrend() {
      setLoading(true);
      setError("");
      try {
        const data = await fetchStockTrend(selectedSku, 60, 14);
        setTrend(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load trend");
      } finally {
        setLoading(false);
      }
    }
    loadTrend();
  }, [selectedSku]);

  const chart = useMemo(() => {
    if (!trend) return null;

    const width = 720;
    const height = 240;
    const merged = [...trend.history, ...trend.forecast];
    const values = merged.map((x) => x.on_hand);
    const yMin = Math.min(...values) * 0.9;
    const yMax = Math.max(...values) * 1.1;

    const historyPoints = scaleSeries(trend.history, width, height, yMin, yMax);
    const forecastOffset = historyPoints[historyPoints.length - 1]?.x ?? 0;
    const forecastPoints = scaleSeries(trend.forecast, width * 0.22, height, yMin, yMax).map((p) => ({
      x: p.x + forecastOffset,
      y: p.y,
    }));

    return {
      width,
      height,
      historyPath: buildPath(historyPoints),
      forecastPath: buildPath(forecastPoints),
      boundaryX: forecastOffset,
      yMin,
      yMax,
    };
  }, [trend]);

  return (
    <section className="mt-6 rounded-3xl border border-white/70 bg-white/85 p-5 shadow-md backdrop-blur">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-heading text-lg">Inventory Trend + Forecast</h2>
          <p className="text-sm text-slate-600">Historical stock curve with 14-day ML projection.</p>
        </div>

        <label className="text-sm text-slate-700">
          SKU
          <select
            className="ml-2 rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm"
            value={selectedSku}
            onChange={(e) => setSelectedSku(e.target.value)}
          >
            {skus.map((sku) => (
              <option key={sku.sku_id} value={sku.sku_id}>
                {sku.sku_id}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loading && <p className="mt-3 text-sm text-slate-600">Loading trend...</p>}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {trend && chart && (
        <div className="mt-4">
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-950/95 p-3">
            <svg viewBox={`0 0 ${chart.width} ${chart.height}`} className="h-64 w-full min-w-[680px]">
              <line x1={0} y1={chart.height} x2={chart.width} y2={chart.height} stroke="#1f2937" strokeWidth={1} />
              <line x1={0} y1={0} x2={0} y2={chart.height} stroke="#1f2937" strokeWidth={1} />

              <line
                x1={chart.boundaryX}
                y1={0}
                x2={chart.boundaryX}
                y2={chart.height}
                stroke="#475569"
                strokeDasharray="6,6"
                strokeWidth={1}
              />

              <path d={chart.historyPath} fill="none" stroke="#22d3ee" strokeWidth={2.8} />
              <path d={chart.forecastPath} fill="none" stroke="#fb923c" strokeWidth={2.8} strokeDasharray="7,5" />
            </svg>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-mist p-3 text-sm">
              <p className="text-slate-500">Latest On Hand</p>
              <p className="font-semibold text-ink">{trend.summary.latest_on_hand}</p>
            </div>
            <div className="rounded-xl bg-mist p-3 text-sm">
              <p className="text-slate-500">Forecast End On Hand</p>
              <p className="font-semibold text-ink">{trend.summary.forecast_end_on_hand}</p>
            </div>
            <div className="rounded-xl bg-mist p-3 text-sm">
              <p className="text-slate-500">Avg Predicted Demand</p>
              <p className="font-semibold text-ink">{trend.summary.avg_predicted_demand}</p>
            </div>
          </div>

          <div className="mt-2 flex gap-4 text-xs text-slate-600">
            <span className="font-semibold text-cyan-700">Solid cyan: history</span>
            <span className="font-semibold text-orange-700">Dashed orange: forecast</span>
          </div>
        </div>
      )}
    </section>
  );
}
