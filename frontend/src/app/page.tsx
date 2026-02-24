import { CopilotPanel } from "@/components/CopilotPanel";
import { Dashboard } from "@/components/Dashboard";
import { TrendPanel } from "@/components/TrendPanel";
import { fetchKpis } from "@/lib/api";

export default async function Home() {
  const kpis = await fetchKpis();

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-[0.25em] text-slate-600">Synthetic ERP Intelligence</p>
        <h1 className="mt-2 font-heading text-3xl text-ink sm:text-4xl">
          Warehouse Ops Copilot
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 sm:text-base">
          Consolidated mock ERP/WMS data with an agentic interface for KPIs, risk predictions, and transparent tool traces.
        </p>
      </header>

      <Dashboard kpis={kpis} />
      <TrendPanel />
      <div className="mt-6">
        <CopilotPanel />
      </div>
    </main>
  );
}
