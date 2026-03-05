"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  fetchSkuProfile,
  fetchStockTrend,
  stockoutPredict,
  simulateStockScenario,
  SkuProfile,
  StockTrendResponse,
  ScenarioResponse,
} from "@/lib/api";
import { buildPath, chartSeries, splitChart } from "@/lib/chartHelpers";

const HISTORY_WINDOWS = [30, 60, 90, 120];
const FORECAST_WINDOWS = [14, 21, 30];

const STATUS_BADGE: Record<string, string> = {
  REORDER_NOW: "bg-rose-100 text-rose-700",
  REORDER_SOON: "bg-amber-100 text-amber-700",
  OK: "bg-emerald-100 text-emerald-700",
};

const STATUS_LABEL: Record<string, string> = {
  REORDER_NOW: "Reorder Now",
  REORDER_SOON: "Reorder Soon",
  OK: "OK",
};

const CONFIDENCE_BADGE: Record<string, string> = {
  HIGH: "bg-emerald-100 text-emerald-700",
  MEDIUM: "bg-amber-100 text-amber-700",
  LOW: "bg-rose-100 text-rose-700",
};

// --- Loading skeleton ---
function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl bg-slate-100 p-4">
      <div className="h-3 w-24 rounded bg-slate-200" />
      <div className="mt-2 h-6 w-16 rounded bg-slate-200" />
    </div>
  );
}

type Props = { skuId: string };

export function SkuDetailPanel({ skuId }: Props) {
  const router = useRouter();

  const [profile, setProfile] = useState<SkuProfile | null>(null);
  const [trend, setTrend] = useState<StockTrendResponse | null>(null);
  const [stockout, setStockout] = useState<Record<string, unknown> | null>(null);

  const [historyDays, setHistoryDays] = useState(60);
  const [forecastDays, setForecastDays] = useState(14);

  const [demandMultiplier, setDemandMultiplier] = useState(1.0);
  const [leadTimeMultiplier, setLeadTimeMultiplier] = useState(1.0);
  const [replenishmentMultiplier, setReplenishmentMultiplier] = useState(1.0);
  const [scenario, setScenario] = useState<ScenarioResponse | null>(null);
  const [simLoading, setSimLoading] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Fetch profile + stockout on mount
  useEffect(() => {
    setLoading(true);
    setError("");
    Promise.all([
      fetchSkuProfile(skuId),
      stockoutPredict(skuId, 14),
    ])
      .then(([prof, so]) => {
        setProfile(prof);
        setStockout(so);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load SKU data"))
      .finally(() => setLoading(false));
  }, [skuId]);

  // Fetch trend on window change
  useEffect(() => {
    setScenario(null);
    fetchStockTrend(skuId, historyDays, forecastDays)
      .then(setTrend)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load trend"));
  }, [skuId, historyDays, forecastDays]);

  async function runSimulation() {
    setSimLoading(true);
    setError("");
    try {
      const sim = await simulateStockScenario({
        skuId,
        historyDays,
        forecastDays,
        demandMultiplier,
        leadTimeMultiplier,
        replenishmentMultiplier,
      });
      setScenario(sim);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Simulation failed");
    } finally {
      setSimLoading(false);
    }
  }

  const scenarioOnHand = useMemo(() => scenario?.scenario.forecast.map((p) => p.on_hand), [scenario]);
  const stockChart = useMemo(() => (trend ? splitChart(trend, "on_hand", scenarioOnHand) : null), [trend, scenarioOnHand]);
  const demandChart = useMemo(() => (trend ? splitChart(trend, "demand") : null), [trend]);

  const reorder = profile?.reorder;
  const so = stockout as Record<string, unknown> | null;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 lg:p-8">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-4">
        <button
          onClick={() => router.back()}
          className="rounded-xl bg-slate-100 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-200"
        >
          ← Back
        </button>
        {loading ? (
          <div className="animate-pulse h-8 w-48 rounded bg-slate-200" />
        ) : (
          <>
            <span className="font-mono text-2xl font-bold text-slate-900">{skuId}</span>
            {profile && <span className="text-lg text-slate-600">{profile.sku_name}</span>}
            {reorder && (
              <span className={`rounded-full px-3 py-0.5 text-sm font-semibold ${STATUS_BADGE[reorder.status]}`}>
                {STATUS_LABEL[reorder.status]}
              </span>
            )}
          </>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* 6 KPI cards */}
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
        ) : profile ? (
          <>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">On Hand</p>
              <p className="mt-1 text-xl font-bold text-slate-900">{profile.on_hand.toLocaleString()}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">Daily Demand</p>
              <p className="mt-1 text-xl font-bold text-slate-900">{profile.daily_demand.toFixed(1)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">Lead Time</p>
              <p className="mt-1 text-xl font-bold text-slate-900">{profile.lead_time_days}d</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">Days of Cover</p>
              <p className="mt-1 text-xl font-bold text-slate-900">{profile.days_of_cover.toFixed(1)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">Safety Stock</p>
              <p className="mt-1 text-xl font-bold text-slate-900">
                {reorder ? Math.round(reorder.safety_stock).toLocaleString() : "—"}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">ROP</p>
              <p className="mt-1 text-xl font-bold text-slate-900">
                {reorder ? Math.round(reorder.rop).toLocaleString() : "—"}
              </p>
            </div>
          </>
        ) : null}
      </div>

      {/* Trend chart section */}
      <div className="rounded-3xl border border-white/70 bg-white/85 p-5 shadow-md backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-lg">Stock Trend</h2>
          <div className="flex flex-wrap gap-2">
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

        {trend && stockChart && demandChart ? (
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
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="animate-pulse h-56 rounded-2xl bg-slate-200" />
            <div className="animate-pulse h-40 rounded-2xl bg-slate-100" />
          </div>
        )}
      </div>

      {/* Scenario simulation */}
      <div className="rounded-3xl border border-white/70 bg-white/85 p-5 shadow-md backdrop-blur">
        <h2 className="font-heading text-lg">Scenario Simulation</h2>
        <div className="mt-3 grid gap-3 lg:grid-cols-4">
          <label className="text-xs text-slate-600">
            Demand Multiplier: <span className="font-semibold">{demandMultiplier.toFixed(2)}x</span>
            <input type="range" min={0.6} max={1.6} step={0.05} value={demandMultiplier}
              onChange={(e) => setDemandMultiplier(Number(e.target.value))} className="mt-1 w-full" />
          </label>
          <label className="text-xs text-slate-600">
            Lead Time Multiplier: <span className="font-semibold">{leadTimeMultiplier.toFixed(2)}x</span>
            <input type="range" min={0.6} max={1.8} step={0.05} value={leadTimeMultiplier}
              onChange={(e) => setLeadTimeMultiplier(Number(e.target.value))} className="mt-1 w-full" />
          </label>
          <label className="text-xs text-slate-600">
            Replenishment Multiplier: <span className="font-semibold">{replenishmentMultiplier.toFixed(2)}x</span>
            <input type="range" min={0.6} max={1.6} step={0.05} value={replenishmentMultiplier}
              onChange={(e) => setReplenishmentMultiplier(Number(e.target.value))} className="mt-1 w-full" />
          </label>
          <div className="flex items-end">
            <button
              onClick={runSimulation}
              disabled={simLoading || !trend}
              className="w-full rounded-xl bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
            >
              {simLoading ? "Simulating..." : "Run What-If"}
            </button>
          </div>
        </div>

        {scenario && (
          <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm text-slate-700">
            <p className="font-semibold text-violet-800">Scenario Result</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-slate-500">Delta vs Baseline</p>
                <p className={`font-bold ${scenario.delta_vs_baseline_end_on_hand < 0 ? "text-rose-700" : "text-emerald-700"}`}>
                  {scenario.delta_vs_baseline_end_on_hand > 0 ? "+" : ""}{scenario.delta_vs_baseline_end_on_hand} units
                </p>
              </div>
              <div>
                <p className="text-slate-500">Scenario Min On Hand</p>
                <p className="font-bold text-slate-900">{scenario.scenario_min_on_hand.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-slate-500">Scenario Runout</p>
                <p className="font-bold text-slate-900">{scenario.scenario_runout_date ?? "No runout in window"}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom row: Stockout Risk + Reorder Signal */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Stockout Risk */}
        <div className="rounded-3xl border border-white/70 bg-white/85 p-5 shadow-md backdrop-blur">
          <h2 className="font-heading text-lg">Stockout Risk</h2>
          {loading ? (
            <div className="mt-4 space-y-2">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : so ? (
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap gap-2">
                {so.risk_band != null && (
                  <span className={`rounded-full px-3 py-0.5 text-sm font-semibold ${
                    so.risk_band === "HIGH" ? "bg-rose-100 text-rose-700"
                    : so.risk_band === "MEDIUM" ? "bg-amber-100 text-amber-700"
                    : "bg-emerald-100 text-emerald-700"
                  }`}>
                    {String(so.risk_band)} Risk
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {so.stockout_probability != null && (
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">Probability</p>
                    <p className="font-bold text-slate-900">{(Number(so.stockout_probability) * 100).toFixed(1)}%</p>
                  </div>
                )}
                {so.projected_on_hand != null && (
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">Projected On Hand</p>
                    <p className="font-bold text-slate-900">{Number(so.projected_on_hand).toLocaleString()}</p>
                  </div>
                )}
                {so.projected_days_of_cover != null && (
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">Projected Days of Cover</p>
                    <p className="font-bold text-slate-900">{Number(so.projected_days_of_cover).toFixed(1)}d</p>
                  </div>
                )}
              </div>
              {Array.isArray(so.drivers) && so.drivers.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {(so.drivers as string[]).map((d) => (
                    <span key={d} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{d}</span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">No stockout data available.</p>
          )}
        </div>

        {/* Reorder Signal */}
        <div className="rounded-3xl border border-white/70 bg-white/85 p-5 shadow-md backdrop-blur">
          <h2 className="font-heading text-lg">Reorder Signal</h2>
          {loading ? (
            <div className="mt-4 space-y-2">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : reorder ? (
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap gap-2">
                <span className={`rounded-full px-3 py-0.5 text-sm font-semibold ${STATUS_BADGE[reorder.status]}`}>
                  {STATUS_LABEL[reorder.status]}
                </span>
                <span className={`rounded-full px-3 py-0.5 text-sm font-semibold ${CONFIDENCE_BADGE[reorder.confidence]}`}>
                  {reorder.confidence} Confidence
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Reorder Qty</p>
                  <p className="font-bold text-slate-900">{reorder.reorder_qty.toLocaleString()}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Suggested Order Date</p>
                  <p className="font-bold text-slate-900">{reorder.suggested_order_date}</p>
                </div>
              </div>
              <div>
                <p className="mb-1 text-xs text-slate-500">Urgency</p>
                <svg width="100%" height="12" aria-label={`Urgency ${reorder.urgency_score}`}>
                  <rect x="0" y="2" width="100%" height="8" rx="4" fill="#e2e8f0" />
                  <rect
                    x="0" y="2"
                    width={`${Math.min(100, Math.abs(reorder.urgency_score) * 10)}%`}
                    height="8" rx="4"
                    fill={reorder.status === "REORDER_NOW" ? "#f43f5e" : reorder.status === "REORDER_SOON" ? "#f59e0b" : "#10b981"}
                  />
                </svg>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">No reorder signal data available.</p>
          )}
        </div>
      </div>
    </div>
  );
}
