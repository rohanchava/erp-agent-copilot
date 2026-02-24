"use client";

import { useEffect, useMemo, useState } from "react";

import { fetchSkus, fetchStockTrend, ScenarioResponse, SkuRecord, StockTrendResponse, simulateStockScenario } from "@/lib/api";

const HISTORY_WINDOWS = [30, 60, 90, 120];
const FORECAST_WINDOWS = [14, 21, 30];

function buildPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return "";
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
}

function chartSeries(values: number[], width: number, height: number, yMin: number, yMax: number) {
  const safeRange = Math.max(yMax - yMin, 1);
  return values.map((v, idx) => {
    const x = (idx / Math.max(values.length - 1, 1)) * width;
    const y = height - ((v - yMin) / safeRange) * height;
    return { x, y };
  });
}

function splitChart(
  trend: StockTrendResponse,
  metric: "on_hand" | "demand",
  scenarioForecast?: number[]
): {
  width: number;
  height: number;
  historyPath: string;
  forecastPath: string;
  scenarioPath: string;
  boundaryX: number;
} {
  const width = 740;
  const height = 220;

  const histValues =
    metric === "on_hand" ? trend.history.map((p) => p.on_hand) : trend.history.map((p) => Number(p.demand_qty ?? 0));
  const fcstValues =
    metric === "on_hand"
      ? trend.forecast.map((p) => p.on_hand)
      : trend.forecast.map((p) => Number(p.predicted_demand ?? 0));

  const merged = scenarioForecast ? [...histValues, ...fcstValues, ...scenarioForecast] : [...histValues, ...fcstValues];
  const yMin = Math.min(...merged) * 0.9;
  const yMax = Math.max(...merged) * 1.1;

  const historyPts = chartSeries(histValues, width, height, yMin, yMax);
  const historyPath = buildPath(historyPts);
  const boundaryX = historyPts[historyPts.length - 1]?.x ?? 0;

  const fcstPts = chartSeries(fcstValues, width * 0.24, height, yMin, yMax).map((p) => ({ x: p.x + boundaryX, y: p.y }));
  const forecastPath = buildPath(fcstPts);

  const scenarioPath = scenarioForecast
    ? buildPath(
        chartSeries(scenarioForecast, width * 0.24, height, yMin, yMax).map((p) => ({ x: p.x + boundaryX, y: p.y }))
      )
    : "";

  return { width, height, historyPath, forecastPath, scenarioPath, boundaryX };
}

export function TrendPanel() {
  const [skus, setSkus] = useState<SkuRecord[]>([]);
  const [selectedSku, setSelectedSku] = useState<string>("SKU-1000");
  const [historyDays, setHistoryDays] = useState(60);
  const [forecastDays, setForecastDays] = useState(14);
  const [trend, setTrend] = useState<StockTrendResponse | null>(null);
  const [scenario, setScenario] = useState<ScenarioResponse | null>(null);
  const [demandMultiplier, setDemandMultiplier] = useState(1.0);
  const [leadTimeMultiplier, setLeadTimeMultiplier] = useState(1.0);
  const [replenishmentMultiplier, setReplenishmentMultiplier] = useState(1.0);
  const [loading, setLoading] = useState(false);
  const [simLoading, setSimLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadSkus() {
      try {
        const data = await fetchSkus(100);
        setSkus(data);
        if (data.length > 0) setSelectedSku(data[0].sku_id);
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
      setScenario(null);
      try {
        const data = await fetchStockTrend(selectedSku, historyDays, forecastDays);
        setTrend(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load trend");
      } finally {
        setLoading(false);
      }
    }
    loadTrend();
  }, [selectedSku, historyDays, forecastDays]);

  async function runSimulation() {
    if (!selectedSku) return;
    setSimLoading(true);
    setError("");
    try {
      const sim = await simulateStockScenario({
        skuId: selectedSku,
        historyDays,
        forecastDays,
        demandMultiplier,
        leadTimeMultiplier,
        replenishmentMultiplier
      });
      setScenario(sim);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run simulation");
    } finally {
      setSimLoading(false);
    }
  }

  const scenarioOnHand = useMemo(() => scenario?.scenario.forecast.map((p) => p.on_hand), [scenario]);

  const stockChart = useMemo(() => {
    if (!trend) return null;
    return splitChart(trend, "on_hand", scenarioOnHand);
  }, [trend, scenarioOnHand]);

  const demandChart = useMemo(() => {
    if (!trend) return null;
    return splitChart(trend, "demand");
  }, [trend]);

  return (
    <section className="rounded-3xl border border-white/70 bg-white/85 p-5 shadow-md backdrop-blur">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="font-heading text-lg">Inventory Trends + What-If Simulator</h2>
          <p className="text-sm text-slate-600">Compare baseline forecast against simulated shocks in demand, lead time, and replenishment.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <label className="text-xs text-slate-600">
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

          <div className="rounded-xl bg-slate-100 p-1">
            {HISTORY_WINDOWS.map((w) => (
              <button
                key={w}
                onClick={() => setHistoryDays(w)}
                className={`rounded-lg px-2 py-1 text-xs ${historyDays === w ? "bg-slate-900 text-white" : "text-slate-600"}`}
              >
                H{w}
              </button>
            ))}
          </div>

          <div className="rounded-xl bg-slate-100 p-1">
            {FORECAST_WINDOWS.map((w) => (
              <button
                key={w}
                onClick={() => setForecastDays(w)}
                className={`rounded-lg px-2 py-1 text-xs ${forecastDays === w ? "bg-cyan-700 text-white" : "text-slate-600"}`}
              >
                F{w}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-xs uppercase tracking-wide text-slate-500">Scenario Controls</p>
        <div className="mt-3 grid gap-3 lg:grid-cols-4">
          <label className="text-xs text-slate-600">
            Demand Multiplier: <span className="font-semibold">{demandMultiplier.toFixed(2)}x</span>
            <input
              type="range"
              min={0.6}
              max={1.6}
              step={0.05}
              value={demandMultiplier}
              onChange={(e) => setDemandMultiplier(Number(e.target.value))}
              className="mt-1 w-full"
            />
          </label>
          <label className="text-xs text-slate-600">
            Lead Time Multiplier: <span className="font-semibold">{leadTimeMultiplier.toFixed(2)}x</span>
            <input
              type="range"
              min={0.6}
              max={1.8}
              step={0.05}
              value={leadTimeMultiplier}
              onChange={(e) => setLeadTimeMultiplier(Number(e.target.value))}
              className="mt-1 w-full"
            />
          </label>
          <label className="text-xs text-slate-600">
            Replenishment Multiplier: <span className="font-semibold">{replenishmentMultiplier.toFixed(2)}x</span>
            <input
              type="range"
              min={0.6}
              max={1.6}
              step={0.05}
              value={replenishmentMultiplier}
              onChange={(e) => setReplenishmentMultiplier(Number(e.target.value))}
              className="mt-1 w-full"
            />
          </label>
          <div className="flex items-end">
            <button
              onClick={runSimulation}
              disabled={simLoading || loading}
              className="w-full rounded-xl bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
            >
              {simLoading ? "Simulating..." : "Run What-If"}
            </button>
          </div>
        </div>
      </div>

      {loading && <p className="mt-3 text-sm text-slate-600">Loading trend...</p>}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {trend && stockChart && demandChart && (
        <div className="mt-4 space-y-4">
          <article className="rounded-2xl border border-slate-200 bg-slate-950 p-3">
            <p className="text-xs uppercase tracking-wide text-slate-300">On-hand projection</p>
            <svg viewBox={`0 0 ${stockChart.width} ${stockChart.height}`} className="mt-2 h-56 w-full min-w-[680px] overflow-x-auto">
              <line x1={stockChart.boundaryX} y1={0} x2={stockChart.boundaryX} y2={stockChart.height} stroke="#64748b" strokeDasharray="6,6" />
              <path d={stockChart.historyPath} fill="none" stroke="#22d3ee" strokeWidth={2.8} />
              <path d={stockChart.forecastPath} fill="none" stroke="#fb923c" strokeWidth={2.8} strokeDasharray="7,5" />
              {stockChart.scenarioPath && <path d={stockChart.scenarioPath} fill="none" stroke="#a78bfa" strokeWidth={3} />}
            </svg>
            <div className="mt-2 flex flex-wrap gap-3 text-xs">
              <span className="font-semibold text-cyan-300">History on-hand</span>
              <span className="font-semibold text-orange-300">Baseline forecast</span>
              <span className="font-semibold text-violet-300">Scenario forecast</span>
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-3">
            <p className="text-xs uppercase tracking-wide text-slate-500">Demand trajectory</p>
            <svg viewBox={`0 0 ${demandChart.width} ${demandChart.height}`} className="mt-2 h-40 w-full min-w-[680px] overflow-x-auto">
              <line x1={demandChart.boundaryX} y1={0} x2={demandChart.boundaryX} y2={demandChart.height} stroke="#94a3b8" strokeDasharray="6,6" />
              <path d={demandChart.historyPath} fill="none" stroke="#2563eb" strokeWidth={2.6} />
              <path d={demandChart.forecastPath} fill="none" stroke="#7c3aed" strokeWidth={2.6} strokeDasharray="7,5" />
            </svg>
            <div className="mt-2 flex flex-wrap gap-3 text-xs">
              <span className="font-semibold text-blue-700">History demand</span>
              <span className="font-semibold text-violet-700">Baseline demand forecast</span>
            </div>
          </article>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-xl bg-mist p-3 text-sm">
              <p className="text-slate-500">Latest On Hand</p>
              <p className="font-semibold text-ink">{trend.summary.latest_on_hand}</p>
            </div>
            <div className="rounded-xl bg-mist p-3 text-sm">
              <p className="text-slate-500">Baseline End On Hand</p>
              <p className="font-semibold text-ink">{trend.summary.forecast_end_on_hand}</p>
            </div>
            <div className="rounded-xl bg-mist p-3 text-sm">
              <p className="text-slate-500">Safety Stock Est.</p>
              <p className="font-semibold text-ink">{trend.summary.safety_stock_estimate}</p>
            </div>
            <div className="rounded-xl bg-mist p-3 text-sm">
              <p className="text-slate-500">Projected Runout</p>
              <p className="font-semibold text-ink">{trend.summary.projected_runout_date ?? "No runout in window"}</p>
            </div>
            <div className="rounded-xl bg-mist p-3 text-sm">
              <p className="text-slate-500">Scenario Delta</p>
              <p className={`font-semibold ${scenario && scenario.delta_vs_baseline_end_on_hand < 0 ? "text-rose-700" : "text-emerald-700"}`}>
                {scenario ? `${scenario.delta_vs_baseline_end_on_hand}` : "Run simulation"}
              </p>
            </div>
          </div>

          {scenario && (
            <div className="rounded-xl border border-violet-200 bg-violet-50 p-3 text-sm text-slate-700">
              <p className="font-semibold text-violet-800">Scenario Result</p>
              <p className="mt-1">
                End on-hand changes by <span className="font-semibold">{scenario.delta_vs_baseline_end_on_hand}</span> units vs baseline.
                Scenario min on-hand: <span className="font-semibold">{scenario.scenario_min_on_hand}</span>. Runout date: {" "}
                <span className="font-semibold">{scenario.scenario_runout_date ?? "No runout in window"}</span>.
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
