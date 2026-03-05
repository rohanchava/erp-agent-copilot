"use client";

import { useState } from "react";
import Link from "next/link";
import { ReorderRecommendation } from "@/lib/api";

type Props = {
  recommendations: ReorderRecommendation[];
};

type TabValue = "ALL" | "REORDER_NOW" | "REORDER_SOON" | "OK";

const STATUS_TABS: { label: string; value: TabValue }[] = [
  { label: "All", value: "ALL" },
  { label: "Reorder Now", value: "REORDER_NOW" },
  { label: "Reorder Soon", value: "REORDER_SOON" },
  { label: "OK", value: "OK" },
];

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
  HIGH: "text-emerald-700",
  MEDIUM: "text-amber-600",
  LOW: "text-rose-600",
};

type SortKey = "urgency_score" | "on_hand" | "rop" | "reorder_qty" | "days_to_reorder";

export function ReorderPanel({ recommendations }: Props) {
  const [activeTab, setActiveTab] = useState<TabValue>("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("urgency_score");
  const [sortAsc, setSortAsc] = useState(false);

  const reorderNowCount = recommendations.filter((r) => r.status === "REORDER_NOW").length;
  const reorderSoonCount = recommendations.filter((r) => r.status === "REORDER_SOON").length;
  const okCount = recommendations.filter((r) => r.status === "OK").length;
  const totalUnits = recommendations
    .filter((r) => r.status !== "OK")
    .reduce((sum, r) => sum + r.reorder_qty, 0);

  const filtered = recommendations.filter(
    (r) => activeTab === "ALL" || r.status === activeTab
  );

  const sorted = [...filtered].sort((a, b) => {
    const diff = a[sortKey] - b[sortKey];
    return sortAsc ? diff : -diff;
  });

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortAsc((v) => !v);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  const maxUrgency = recommendations.length > 0 ? Math.max(...recommendations.map((r) => Math.abs(r.urgency_score)), 1) : 1;

  return (
    <section className="space-y-5">
      <div className="rounded-3xl border border-white/70 bg-white/85 p-5 shadow-md backdrop-blur">
        <h2 className="font-heading text-lg">Reorder Recommendations</h2>
        <p className="text-sm text-slate-600">ROP-based reorder signals from last 30 days of demand history.</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <button
            onClick={() => setActiveTab(activeTab === "REORDER_NOW" ? "ALL" : "REORDER_NOW")}
            className={`rounded-2xl border p-4 text-left transition hover:ring-2 hover:ring-rose-300 ${activeTab === "REORDER_NOW" ? "ring-2 ring-rose-400" : ""} border-rose-200 bg-rose-50`}
          >
            <p className="text-xs uppercase tracking-wide text-rose-500">Reorder Now</p>
            <p className="mt-1 text-3xl font-bold text-rose-700">{reorderNowCount}</p>
            <p className="mt-1 text-xs text-rose-500">SKUs past ROP</p>
          </button>
          <button
            onClick={() => setActiveTab(activeTab === "REORDER_SOON" ? "ALL" : "REORDER_SOON")}
            className={`rounded-2xl border p-4 text-left transition hover:ring-2 hover:ring-amber-300 ${activeTab === "REORDER_SOON" ? "ring-2 ring-amber-400" : ""} border-amber-200 bg-amber-50`}
          >
            <p className="text-xs uppercase tracking-wide text-amber-500">Reorder Soon</p>
            <p className="mt-1 text-3xl font-bold text-amber-700">{reorderSoonCount}</p>
            <p className="mt-1 text-xs text-amber-500">SKUs within 7-day buffer</p>
          </button>
          <button
            onClick={() => setActiveTab(activeTab === "OK" ? "ALL" : "OK")}
            className={`rounded-2xl border p-4 text-left transition hover:ring-2 hover:ring-emerald-300 ${activeTab === "OK" ? "ring-2 ring-emerald-400" : ""} border-emerald-200 bg-emerald-50`}
          >
            <p className="text-xs uppercase tracking-wide text-emerald-500">Healthy</p>
            <p className="mt-1 text-3xl font-bold text-emerald-700">{okCount}</p>
            <p className="mt-1 text-xs text-emerald-500">SKUs with adequate stock</p>
          </button>
          <article className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
            <p className="text-xs uppercase tracking-wide text-cyan-500">Total Units to Order</p>
            <p className="mt-1 text-3xl font-bold text-cyan-700">{totalUnits.toLocaleString()}</p>
            <p className="mt-1 text-xs text-cyan-500">Across urgent SKUs</p>
          </article>
        </div>
      </div>

      <div className="rounded-3xl border border-white/70 bg-white/85 p-5 shadow-md backdrop-blur">
        <div className="flex flex-wrap gap-2">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`rounded-xl px-4 py-1.5 text-sm font-medium transition ${
                activeTab === tab.value
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="pb-2 pr-3">SKU</th>
                <th className="pb-2 pr-3">Name</th>
                <th
                  className="cursor-pointer pb-2 pr-3 hover:text-slate-800"
                  onClick={() => handleSort("on_hand")}
                >
                  On Hand {sortKey === "on_hand" ? (sortAsc ? "↑" : "↓") : ""}
                </th>
                <th
                  className="cursor-pointer pb-2 pr-3 hover:text-slate-800"
                  onClick={() => handleSort("rop")}
                >
                  ROP {sortKey === "rop" ? (sortAsc ? "↑" : "↓") : ""}
                </th>
                <th
                  className="cursor-pointer pb-2 pr-3 hover:text-slate-800"
                  onClick={() => handleSort("reorder_qty")}
                >
                  Reorder Qty {sortKey === "reorder_qty" ? (sortAsc ? "↑" : "↓") : ""}
                </th>
                <th className="pb-2 pr-3">Order By</th>
                <th
                  className="cursor-pointer pb-2 pr-3 hover:text-slate-800"
                  onClick={() => handleSort("urgency_score")}
                >
                  Urgency {sortKey === "urgency_score" ? (sortAsc ? "↑" : "↓") : ""}
                </th>
                <th className="pb-2 pr-3">Confidence</th>
                <th className="pb-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sorted.map((r) => {
                const barPct = Math.min(
                  100,
                  (Math.abs(r.urgency_score) / maxUrgency) * 100
                );
                const barColor =
                  r.status === "REORDER_NOW"
                    ? "#f43f5e"
                    : r.status === "REORDER_SOON"
                    ? "#f59e0b"
                    : "#10b981";

                return (
                  <tr key={r.sku_id} className="hover:bg-slate-50">
                    <td className="py-2 pr-3 font-mono text-xs text-slate-700">
                      <Link href={`/skus/${r.sku_id}`} className="text-cyan-700 hover:underline">{r.sku_id}</Link>
                    </td>
                    <td className="py-2 pr-3 text-slate-800">{r.sku_name}</td>
                    <td className="py-2 pr-3 text-slate-700">{r.on_hand.toLocaleString()}</td>
                    <td className="py-2 pr-3 text-slate-700">{r.rop.toLocaleString()}</td>
                    <td className="py-2 pr-3 text-slate-700">{r.reorder_qty.toLocaleString()}</td>
                    <td className="py-2 pr-3 text-slate-700">{r.suggested_order_date}</td>
                    <td className="py-2 pr-3">
                      <svg width="80" height="12" aria-label={`Urgency ${r.urgency_score}`}>
                        <rect x="0" y="2" width="80" height="8" rx="4" fill="#e2e8f0" />
                        <rect
                          x="0"
                          y="2"
                          width={barPct * 0.8}
                          height="8"
                          rx="4"
                          fill={barColor}
                        />
                      </svg>
                    </td>
                    <td className={`py-2 pr-3 text-xs font-semibold ${CONFIDENCE_BADGE[r.confidence]}`}>
                      {r.confidence}
                    </td>
                    <td className="py-2">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE[r.status]}`}
                      >
                        {STATUS_LABEL[r.status]}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {sorted.length === 0 && (
            <p className="mt-6 text-center text-sm text-slate-500">No items match the selected filter.</p>
          )}
        </div>
      </div>
    </section>
  );
}
