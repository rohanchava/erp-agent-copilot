import Link from "next/link";

import { Dashboard } from "@/components/Dashboard";
import { OverviewInsights } from "@/components/OverviewInsights";
import { fetchKpis } from "@/lib/api";

export default async function OverviewPage() {
  const kpis = await fetchKpis();

  return (
    <div className="space-y-5">
      <Dashboard kpis={kpis} />
      <OverviewInsights />

      <section className="grid gap-4 md:grid-cols-3">
        <Link
          href="/trends"
          className="group rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
        >
          <p className="text-xs uppercase tracking-wide text-slate-500">Forecasting</p>
          <h3 className="mt-1 font-heading text-lg text-slate-900">Inventory Trends</h3>
          <p className="mt-2 text-sm text-slate-600">View history + projected on-hand curves by SKU.</p>
          <p className="mt-4 text-sm font-semibold text-cyan-700 group-hover:text-cyan-600">Open Trends</p>
        </Link>

        <Link
          href="/anomalies"
          className="group rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
        >
          <p className="text-xs uppercase tracking-wide text-slate-500">Detection</p>
          <h3 className="mt-1 font-heading text-lg text-slate-900">Operational Anomalies</h3>
          <p className="mt-2 text-sm text-slate-600">Spot demand spikes, stock drops, and supplier risk.</p>
          <p className="mt-4 text-sm font-semibold text-rose-700 group-hover:text-rose-600">Open Anomalies</p>
        </Link>

        <Link
          href="/copilot"
          className="group rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
        >
          <p className="text-xs uppercase tracking-wide text-slate-500">Agent</p>
          <h3 className="mt-1 font-heading text-lg text-slate-900">AI Copilot Chat</h3>
          <p className="mt-2 text-sm text-slate-600">Ask natural-language ERP questions with traces.</p>
          <p className="mt-4 text-sm font-semibold text-violet-700 group-hover:text-violet-600">Open Copilot</p>
        </Link>
      </section>
    </div>
  );
}
