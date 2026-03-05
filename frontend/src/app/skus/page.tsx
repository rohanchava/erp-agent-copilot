"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchSkus, SkuRecord } from "@/lib/api";

export default function SkusPage() {
  const [skus, setSkus] = useState<SkuRecord[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSkus(200)
      .then(setSkus)
      .finally(() => setLoading(false));
  }, []);

  const filtered = skus.filter(
    (s) =>
      s.sku_id.toLowerCase().includes(query.toLowerCase()) ||
      s.sku_name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <section className="rounded-3xl border border-white/70 bg-white/85 p-5 shadow-md backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg">SKU Catalog</h2>
          <p className="text-sm text-slate-600">Click any SKU to view its full detail profile.</p>
        </div>
        <input
          type="search"
          placeholder="Search SKUs…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400"
        />
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="pb-2 pr-4">SKU ID</th>
              <th className="pb-2 pr-4">Name</th>
              <th className="pb-2 pr-4">On Hand</th>
              <th className="pb-2">Days of Cover</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    <td className="py-2 pr-4"><div className="animate-pulse h-4 w-20 rounded bg-slate-200" /></td>
                    <td className="py-2 pr-4"><div className="animate-pulse h-4 w-32 rounded bg-slate-200" /></td>
                    <td className="py-2 pr-4"><div className="animate-pulse h-4 w-16 rounded bg-slate-200" /></td>
                    <td className="py-2"><div className="animate-pulse h-4 w-16 rounded bg-slate-200" /></td>
                  </tr>
                ))
              : filtered.map((s) => (
                  <tr key={s.sku_id} className="hover:bg-slate-50">
                    <td className="py-2 pr-4 font-mono text-xs">
                      <Link href={`/skus/${s.sku_id}`} className="text-cyan-700 hover:underline">
                        {s.sku_id}
                      </Link>
                    </td>
                    <td className="py-2 pr-4 text-slate-800">{s.sku_name}</td>
                    <td className="py-2 pr-4 text-slate-700">{s.on_hand.toLocaleString()}</td>
                    <td className="py-2 text-slate-700">{s.days_of_cover.toFixed(1)}d</td>
                  </tr>
                ))}
          </tbody>
        </table>
        {!loading && filtered.length === 0 && (
          <p className="mt-6 text-center text-sm text-slate-500">No SKUs match "{query}".</p>
        )}
      </div>
    </section>
  );
}
