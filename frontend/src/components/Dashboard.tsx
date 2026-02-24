"use client";

import { motion } from "framer-motion";

type Props = {
  kpis: {
    open_orders: number;
    delayed_shipments: number;
    avg_fill_rate: number;
    low_stock_skus: number;
    total_skus: number;
    warehouses: number;
  };
};

const cards: Array<{ key: keyof Props["kpis"]; label: string }> = [
  { key: "open_orders", label: "Open Orders" },
  { key: "delayed_shipments", label: "Delayed Shipments" },
  { key: "avg_fill_rate", label: "Avg Fill Rate" },
  { key: "low_stock_skus", label: "Low Stock SKUs" },
  { key: "total_skus", label: "Tracked SKUs" },
  { key: "warehouses", label: "Warehouses" }
];

export function Dashboard({ kpis }: Props) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
      {cards.map((card, idx) => (
        <motion.article
          key={card.key}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.06 }}
          className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur"
        >
          <p className="text-xs uppercase tracking-wide text-slate-500">{card.label}</p>
          <p className="mt-1 text-2xl font-semibold text-ink">
            {card.key === "avg_fill_rate" ? `${(kpis[card.key] * 100).toFixed(1)}%` : kpis[card.key]}
          </p>
        </motion.article>
      ))}
    </section>
  );
}
