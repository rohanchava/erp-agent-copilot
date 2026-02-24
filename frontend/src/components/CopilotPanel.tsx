"use client";

import { FormEvent, useState } from "react";

import { agentChat, stockoutPredict } from "@/lib/api";

type Primitive = string | number | boolean | null;
type Trace = {
  tool?: string;
  input?: Record<string, unknown>;
  output?: unknown;
};

function titleCase(text: string): string {
  return text
    .replaceAll("_", " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function renderPrimitive(value: Primitive): string {
  if (value === null) return "-";
  if (typeof value === "number") return Number.isInteger(value) ? `${value}` : value.toFixed(3);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return value;
}

function TraceCard({ trace, index }: { trace: Trace; index: number }) {
  const toolName = trace.tool ? titleCase(trace.tool) : `Step ${index + 1}`;
  const output = trace.output;

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-800">{toolName}</p>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">Tool</span>
      </div>

      {Array.isArray(output) && output.length > 0 && typeof output[0] === "object" ? (
        <div className="mt-2 space-y-2">
          {output.slice(0, 3).map((row, i) => {
            const rowObj = row as Record<string, Primitive>;
            return (
              <div key={i} className="rounded-lg bg-mist p-2 text-xs">
                {Object.entries(rowObj).map(([key, value]) => (
                  <p key={key} className="text-slate-700">
                    <span className="font-semibold">{titleCase(key)}:</span> {renderPrimitive(value)}
                  </p>
                ))}
              </div>
            );
          })}
        </div>
      ) : output && typeof output === "object" ? (
        <div className="mt-2 grid gap-1 rounded-lg bg-mist p-2 text-xs">
          {Object.entries(output as Record<string, Primitive | Primitive[]>).map(([key, value]) => (
            <p key={key} className="text-slate-700">
              <span className="font-semibold">{titleCase(key)}:</span>{" "}
              {Array.isArray(value) ? value.map((v) => renderPrimitive(v)).join(", ") : renderPrimitive(value)}
            </p>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-xs text-slate-600">No structured output.</p>
      )}
    </article>
  );
}

export function CopilotPanel() {
  const [question, setQuestion] = useState("Which suppliers are most delayed?");
  const [intent, setIntent] = useState<string>("");
  const [answer, setAnswer] = useState<string>("");
  const [traces, setTraces] = useState<Trace[]>([]);
  const [prediction, setPrediction] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  async function onAsk(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await agentChat(question);
      setIntent(res.intent);
      setAnswer(res.answer);
      setTraces((res.traces ?? []) as Trace[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function runPrediction() {
    setLoading(true);
    setError("");
    try {
      const pred = await stockoutPredict("SKU-1000", 14);
      setPrediction(pred);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="grid gap-4 lg:grid-cols-5">
      <div className="lg:col-span-3 rounded-3xl border border-white/70 bg-white/85 p-5 shadow-md backdrop-blur">
        <h2 className="font-heading text-lg">ERP Agent</h2>
        <p className="mt-1 text-sm text-slate-600">
          Ask KPI, anomalies, supplier delivery, stock performance by timeframe, stockout risk, and forecast questions.
        </p>

        <form className="mt-4 flex gap-2" onSubmit={onAsk}>
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="flex-1 rounded-xl border border-sky/30 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky/40"
            placeholder="Ask something operational..."
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-sky px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            Ask
          </button>
        </form>

        {answer && (
          <div className="mt-4 rounded-xl border border-sky/20 bg-gradient-to-r from-blue-50 to-cyan-50 p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Answer</p>
              {intent && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                    intent === "inventory_lookup"
                      ? "bg-emerald-100 text-emerald-700"
                      : intent === "kpi_summary"
                        ? "bg-blue-100 text-blue-700"
                        : intent === "stockout_risk"
                          ? "bg-amber-100 text-amber-800"
                          : intent === "delay_risk"
                            ? "bg-rose-100 text-rose-700"
                            : intent === "supplier_delivery_analysis"
                              ? "bg-violet-100 text-violet-700"
                              : intent === "warehouse_risk"
                                ? "bg-fuchsia-100 text-fuchsia-700"
                                : intent === "trend_forecast"
                                  ? "bg-orange-100 text-orange-700"
                                  : intent === "stock_performance"
                                    ? "bg-cyan-100 text-cyan-700"
                                    : intent === "anomaly_detection"
                                      ? "bg-red-100 text-red-700"
                            : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {titleCase(intent)}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-slate-800">{answer}</p>
          </div>
        )}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        {traces.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">How the agent got this</p>
            {traces.map((trace, idx) => (
              <TraceCard key={idx} trace={trace} index={idx} />
            ))}
          </div>
        )}
      </div>

      <aside className="lg:col-span-2 rounded-3xl border border-white/70 bg-white/85 p-5 shadow-md backdrop-blur">
        <h3 className="font-heading text-base">Quick Prediction</h3>
        <p className="mt-1 text-sm text-slate-600">Run baseline stockout model for sample SKU.</p>
        <button
          onClick={runPrediction}
          disabled={loading}
          className="mt-4 w-full rounded-xl bg-pulse px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
        >
          Predict Stockout (SKU-1000)
        </button>

        {prediction && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-mist p-3 text-sm text-slate-700">
            <p><span className="font-semibold">SKU:</span> {String(prediction.sku_id)}</p>
            <p><span className="font-semibold">Horizon:</span> {String(prediction.horizon_days)} days</p>
            <p><span className="font-semibold">Risk Score:</span> {String(prediction.stockout_risk)}</p>
            <p><span className="font-semibold">Risk Band:</span> {String(prediction.risk_band)}</p>
            <p><span className="font-semibold">Drivers:</span> {Array.isArray(prediction.drivers) ? prediction.drivers.join(", ") : "-"}</p>
          </div>
        )}
      </aside>
    </section>
  );
}
