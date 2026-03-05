import { AnomalyResponse } from "@/lib/api";

type Props = {
  anomalies: AnomalyResponse;
};

export function AnomalyPanel({ anomalies }: Props) {
  return (
    <section className="rounded-3xl border border-white/70 bg-white/85 p-5 shadow-md backdrop-blur">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="font-heading text-lg">Operational Anomalies</h2>
          <p className="text-sm text-slate-600">Top outliers detected over the last {anomalies.window_days ?? 30} days.</p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <article className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-sm font-semibold text-slate-800">Demand Spikes</p>
          <div className="mt-2 space-y-2">
            {anomalies.demand_spikes.length === 0 ? (
              <p className="text-xs text-slate-500">No demand spikes detected.</p>
            ) : anomalies.demand_spikes.slice(0, 4).map((a) => (
              <div key={`${a.sku_id}-${a.date}`} className="rounded-lg bg-rose-50 p-2 text-xs text-slate-700">
                <p><span className="font-semibold">SKU:</span> {a.sku_id}</p>
                <p><span className="font-semibold">Date:</span> {a.date}</p>
                <p><span className="font-semibold">Demand:</span> {a.demand_qty} (z={a.z_score})</p>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-sm font-semibold text-slate-800">Stock Drops</p>
          <div className="mt-2 space-y-2">
            {anomalies.stock_drops.length === 0 ? (
              <p className="text-xs text-slate-500">No stock drops detected.</p>
            ) : anomalies.stock_drops.slice(0, 4).map((a) => (
              <div key={a.sku_id} className="rounded-lg bg-amber-50 p-2 text-xs text-slate-700">
                <p><span className="font-semibold">SKU:</span> {a.sku_id}</p>
                <p><span className="font-semibold">On Hand:</span> {a.start_on_hand} {"→"} {a.end_on_hand}</p>
                <p><span className="font-semibold">Drop:</span> {a.drop_pct}%</p>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-sm font-semibold text-slate-800">Supplier Delivery Risk</p>
          <div className="mt-2 space-y-2">
            {anomalies.supplier_delivery_risk.length === 0 ? (
              <p className="text-xs text-slate-500">No supplier delivery risk detected.</p>
            ) : anomalies.supplier_delivery_risk.slice(0, 4).map((a) => (
              <div key={a.supplier_id} className="rounded-lg bg-violet-50 p-2 text-xs text-slate-700">
                <p><span className="font-semibold">Supplier:</span> {a.supplier_id}</p>
                <p><span className="font-semibold">Late Rate:</span> {(a.late_rate * 100).toFixed(1)}%</p>
                <p><span className="font-semibold">Avg Late Days:</span> {a.avg_late_days}</p>
                <p><span className="font-semibold">Risk Score:</span> {a.risk_score}</p>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}
