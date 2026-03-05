"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  fetchSkus,
  fetchStockTrend,
  simulateStockScenario,
  type ScenarioResponse,
  type SkuRecord,
  type StockTrendResponse,
} from "@/lib/api";

/* ── Chart data ──────────────────────────────────────────────────── */

type ChartPoint = {
  date: string;
  onHand: number | null;
  baselineForecast: number | null;
  scenarioForecast: number | null;
  demand: number | null;
  predictedDemand: number | null;
};

function fmtDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function fmtTick(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

function buildChartData(
  trend: StockTrendResponse,
  scenario: ScenarioResponse | null
): ChartPoint[] {
  const pts: ChartPoint[] = trend.history.map((h) => ({
    date: h.date,
    onHand: h.on_hand,
    baselineForecast: null,
    scenarioForecast: null,
    demand: h.demand_qty ?? null,
    predictedDemand: null,
  }));

  // Bridge the last history point into forecast series so lines connect
  if (pts.length > 0 && trend.forecast.length > 0) {
    const last = pts[pts.length - 1];
    last.baselineForecast = last.onHand;
    if (scenario) last.scenarioForecast = last.onHand;
  }

  trend.forecast.forEach((f, i) => {
    pts.push({
      date: f.date,
      onHand: null,
      baselineForecast: f.on_hand,
      scenarioForecast: scenario?.scenario.forecast[i]?.on_hand ?? null,
      demand: null,
      predictedDemand: f.predicted_demand ?? null,
    });
  });

  return pts;
}

/* ── Custom tooltip ──────────────────────────────────────────────── */

const SERIES_LABEL: Record<string, string> = {
  onHand: "On Hand",
  baselineForecast: "Forecast",
  scenarioForecast: "Scenario",
  demand: "Demand",
  predictedDemand: "Predicted",
};

function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number | null; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const visible = payload.filter((p) => p.value != null);
  if (!visible.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-xl text-xs min-w-[150px]">
      <p className="font-semibold text-slate-600 mb-2">{label}</p>
      {visible.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2 mb-1 last:mb-0">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span className="text-slate-500 flex-1">{SERIES_LABEL[p.dataKey] ?? p.dataKey}</span>
          <span className="font-semibold text-slate-800 tabular-nums">
            {Math.round(p.value!).toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ── Small components ────────────────────────────────────────────── */

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
        active ? "bg-cyan-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
      }`}
    >
      {children}
    </button>
  );
}

type Accent = "green" | "amber" | "red" | "default";

function KpiCard({
  label,
  value,
  sub,
  accent = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: Accent;
}) {
  const valueColor =
    accent === "red" ? "text-red-600"
    : accent === "amber" ? "text-amber-600"
    : accent === "green" ? "text-emerald-600"
    : "text-slate-800";

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-xl font-bold tabular-nums ${valueColor}`}>{value}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function ScenarioSlider({
  label,
  description,
  value,
  onChange,
  min = 0.5,
  max = 2.0,
}: {
  label: string;
  description: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  const pct = Math.round((value - 1) * 100);
  const color = pct > 0 ? "text-amber-600" : pct < 0 ? "text-emerald-600" : "text-slate-400";
  return (
    <div>
      <div className="flex justify-between items-start mb-2">
        <div>
          <p className="text-xs font-semibold text-slate-700">{label}</p>
          <p className="text-[11px] text-slate-400">{description}</p>
        </div>
        <span className={`text-sm font-bold tabular-nums ml-3 ${color}`}>
          {pct > 0 ? `+${pct}%` : pct < 0 ? `${pct}%` : "—"}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={0.05}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 accent-cyan-500 cursor-pointer"
      />
      <div className="flex justify-between text-[10px] text-slate-400 mt-1">
        <span>−{Math.round((1 - min) * 100)}%</span>
        <span>Baseline</span>
        <span>+{Math.round((max - 1) * 100)}%</span>
      </div>
    </div>
  );
}

function LegendLine({ color, dashed, label }: { color: string; dashed?: boolean; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-slate-500">
      <svg width="20" height="10" className="flex-shrink-0">
        <line
          x1="0" y1="5" x2="20" y2="5"
          stroke={color} strokeWidth="2"
          strokeDasharray={dashed ? "5 3" : undefined}
        />
      </svg>
      {label}
    </span>
  );
}

/* ── Main component ──────────────────────────────────────────────── */

export function TrendPanel() {
  const [skus, setSkus] = useState<SkuRecord[]>([]);
  const [selectedSku, setSelectedSku] = useState("SKU-1000");
  const [historyDays, setHistoryDays] = useState(60);
  const [forecastDays, setForecastDays] = useState(14);
  const [trend, setTrend] = useState<StockTrendResponse | null>(null);
  const [scenario, setScenario] = useState<ScenarioResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [simLoading, setSimLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demandMult, setDemandMult] = useState(1.0);
  const [leadTimeMult, setLeadTimeMult] = useState(1.0);
  const [replenMult, setReplenMult] = useState(1.0);

  useEffect(() => {
    fetchSkus(100).then(setSkus).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedSku) return;
    setLoading(true);
    setError(null);
    setScenario(null);
    fetchStockTrend(selectedSku, historyDays, forecastDays)
      .then(setTrend)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load trend"))
      .finally(() => setLoading(false));
  }, [selectedSku, historyDays, forecastDays]);

  const chartData = useMemo(
    () => (trend ? buildChartData(trend, scenario) : []),
    [trend, scenario]
  );

  const tickInterval = useMemo(
    () => Math.max(1, Math.ceil(chartData.length / 9) - 1),
    [chartData.length]
  );

  const boundaryDate = trend?.history.at(-1)?.date ?? null;
  const runoutDate = trend?.summary.projected_runout_date ?? null;
  const safetyStock = trend?.summary.safety_stock_estimate ?? null;
  const skuName = skus.find((s) => s.sku_id === selectedSku)?.sku_name ?? "";
  const { summary } = trend ?? {};

  const runoutAccent: Accent = runoutDate
    ? new Date(runoutDate) < new Date(Date.now() + 7 * 86400000) ? "red" : "amber"
    : "green";

  async function runSimulation() {
    if (!trend) return;
    setSimLoading(true);
    try {
      const result = await simulateStockScenario({
        skuId: selectedSku,
        historyDays,
        forecastDays,
        demandMultiplier: demandMult,
        leadTimeMultiplier: leadTimeMult,
        replenishmentMultiplier: replenMult,
      });
      setScenario(result);
    } catch {
      // silent — scenario just won't render
    } finally {
      setSimLoading(false);
    }
  }

  function resetScenario() {
    setDemandMult(1);
    setLeadTimeMult(1);
    setReplenMult(1);
    setScenario(null);
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-heading font-bold text-slate-800">Inventory Trends</h1>
          {skuName && <p className="text-sm text-slate-500 mt-0.5">{skuName}</p>}
        </div>
        <select
          value={selectedSku}
          onChange={(e) => setSelectedSku(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
        >
          {skus.map((s) => (
            <option key={s.sku_id} value={s.sku_id}>
              {s.sku_id} — {s.sku_name}
            </option>
          ))}
        </select>
      </div>

      {/* KPI cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <KpiCard label="Current On Hand" value={summary.latest_on_hand.toLocaleString()} sub="units in stock" />
          <KpiCard
            label={`End of Forecast (+${forecastDays}d)`}
            value={summary.forecast_end_on_hand.toLocaleString()}
            sub="projected units"
            accent={summary.forecast_end_on_hand < summary.safety_stock_estimate ? "red" : "green"}
          />
          <KpiCard
            label="Min Forecast On Hand"
            value={summary.min_forecast_on_hand.toLocaleString()}
            sub="lowest projected"
            accent={summary.min_forecast_on_hand < summary.safety_stock_estimate ? "amber" : "default"}
          />
          <KpiCard
            label="Safety Stock"
            value={Math.round(summary.safety_stock_estimate).toLocaleString()}
            sub="95% service level"
          />
          <KpiCard
            label="Projected Runout"
            value={runoutDate ? fmtDate(runoutDate) : "None"}
            sub={runoutDate ? "stock hits zero" : "sufficient inventory"}
            accent={runoutDate ? runoutAccent : "green"}
          />
        </div>
      )}

      {/* Window controls */}
      <div className="flex items-center gap-6 flex-wrap">
        <div>
          <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1.5">History</p>
          <div className="flex gap-1.5">
            {([30, 60, 90, 120] as const).map((d) => (
              <Pill key={d} active={historyDays === d} onClick={() => setHistoryDays(d)}>{d}D</Pill>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1.5">Forecast</p>
          <div className="flex gap-1.5">
            {([14, 21, 30] as const).map((d) => (
              <Pill key={d} active={forecastDays === d} onClick={() => setForecastDays(d)}>{d}D</Pill>
            ))}
          </div>
        </div>
      </div>

      {/* Charts */}
      {loading ? (
        <div className="space-y-4">
          <div className="h-72 bg-slate-100 rounded-xl animate-pulse" />
          <div className="h-48 bg-slate-100 rounded-xl animate-pulse" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div>
      ) : chartData.length > 0 ? (
        <div className="space-y-4">

          {/* Stock on hand */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-700">Stock On Hand</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {historyDays}d history · {forecastDays}d forecast
                  {scenario ? " · what-if overlay active" : ""}
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs flex-wrap">
                <LegendLine color="#06b6d4" label="History" />
                <LegendLine color="#0891b2" dashed label="Forecast" />
                {scenario && <LegendLine color="#f97316" label="Scenario" />}
                {safetyStock != null && <LegendLine color="#f59e0b" dashed label="Safety Stock" />}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={chartData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="onHandGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={fmtDate}
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  tickLine={false}
                  axisLine={false}
                  interval={tickInterval}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={fmtTick}
                  width={42}
                />
                <Tooltip content={<ChartTooltip />} />
                {boundaryDate && (
                  <ReferenceLine
                    x={boundaryDate}
                    stroke="#cbd5e1"
                    strokeDasharray="5 4"
                    label={{ value: "Forecast →", position: "insideTopRight", fontSize: 10, fill: "#94a3b8", dy: -4 }}
                  />
                )}
                {safetyStock != null && (
                  <ReferenceLine
                    y={safetyStock}
                    stroke="#f59e0b"
                    strokeDasharray="4 3"
                    label={{ value: "Safety Stock", position: "insideTopLeft", fontSize: 10, fill: "#d97706", dy: -4 }}
                  />
                )}
                {runoutDate && (
                  <ReferenceLine
                    x={runoutDate}
                    stroke="#ef4444"
                    strokeDasharray="4 3"
                    label={{ value: "Runout", position: "insideTopRight", fontSize: 10, fill: "#ef4444", dy: -4 }}
                  />
                )}
                <Area
                  type="monotone"
                  dataKey="onHand"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  fill="url(#onHandGrad)"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey="baselineForecast"
                  stroke="#0891b2"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                  connectNulls={false}
                />
                {scenario && (
                  <Line
                    type="monotone"
                    dataKey="scenarioForecast"
                    stroke="#f97316"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                    connectNulls={false}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Demand trajectory */}
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-700">Demand Trajectory</h3>
                <p className="text-xs text-slate-400 mt-0.5">Actual daily demand vs. model prediction</p>
              </div>
              <div className="flex items-center gap-4 text-xs flex-wrap">
                <LegendLine color="#3b82f6" label="Actual" />
                <LegendLine color="#8b5cf6" dashed label="Predicted" />
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <ComposedChart data={chartData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="demandGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={fmtDate}
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  tickLine={false}
                  axisLine={false}
                  interval={tickInterval}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={fmtTick}
                  width={42}
                />
                <Tooltip content={<ChartTooltip />} />
                {boundaryDate && (
                  <ReferenceLine x={boundaryDate} stroke="#cbd5e1" strokeDasharray="5 4" />
                )}
                <Area
                  type="monotone"
                  dataKey="demand"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#demandGrad)"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey="predictedDemand"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  strokeDasharray="5 3"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                  connectNulls={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : null}

      {/* What-If Scenario panel */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="text-sm font-semibold text-slate-700">What-If Scenario</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Adjust parameters to simulate supply chain shocks and see the impact on stock levels
            </p>
          </div>
          <div className="flex gap-2 ml-4 flex-shrink-0">
            <button
              onClick={resetScenario}
              className="px-3 py-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Reset
            </button>
            <button
              onClick={runSimulation}
              disabled={simLoading || loading}
              className="px-4 py-1.5 text-xs font-semibold bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 disabled:opacity-50 transition-colors"
            >
              {simLoading ? "Running…" : "Run What-If"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <ScenarioSlider
            label="Demand Shock"
            description="e.g. seasonal surge or promotion"
            value={demandMult}
            onChange={setDemandMult}
          />
          <ScenarioSlider
            label="Lead Time Change"
            description="e.g. supplier delays or expedites"
            value={leadTimeMult}
            onChange={setLeadTimeMult}
          />
          <ScenarioSlider
            label="Replenishment Volume"
            description="e.g. order qty adjustment"
            value={replenMult}
            onChange={setReplenMult}
          />
        </div>

        {scenario && (
          <div className="mt-6 pt-5 border-t border-slate-100">
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-3">
              Scenario Results
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <KpiCard
                label="End On Hand"
                value={scenario.scenario.summary.forecast_end_on_hand.toLocaleString()}
                sub="scenario projection"
                accent={scenario.delta_vs_baseline_end_on_hand < 0 ? "red" : "green"}
              />
              <KpiCard
                label="vs. Baseline"
                value={`${scenario.delta_vs_baseline_end_on_hand >= 0 ? "+" : ""}${scenario.delta_vs_baseline_end_on_hand.toLocaleString()}`}
                sub="delta units"
                accent={scenario.delta_vs_baseline_end_on_hand < 0 ? "red" : "green"}
              />
              <KpiCard
                label="Min On Hand"
                value={scenario.scenario_min_on_hand.toLocaleString()}
                sub="lowest during scenario"
                accent={scenario.scenario_min_on_hand < (summary?.safety_stock_estimate ?? 0) ? "amber" : "default"}
              />
              <KpiCard
                label="Scenario Runout"
                value={scenario.scenario_runout_date ? fmtDate(scenario.scenario_runout_date) : "None"}
                sub={scenario.scenario_runout_date ? "stock hits zero" : "no runout projected"}
                accent={scenario.scenario_runout_date ? "red" : "green"}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
