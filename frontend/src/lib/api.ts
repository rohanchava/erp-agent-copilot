const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

export type KPIResponse = {
  open_orders: number;
  delayed_shipments: number;
  avg_fill_rate: number;
  low_stock_skus: number;
  total_skus: number;
  warehouses: number;
};

export type SkuRecord = {
  sku_id: string;
  sku_name: string;
  on_hand: number;
  days_of_cover: number;
};

export type TrendPoint = {
  date: string;
  on_hand: number;
  demand_qty?: number;
  predicted_demand?: number;
};

export type StockTrendResponse = {
  sku_id: string;
  history_days: number;
  forecast_days: number;
  history: TrendPoint[];
  forecast: TrendPoint[];
  summary: {
    latest_on_hand: number;
    forecast_end_on_hand: number;
    avg_predicted_demand: number;
  };
};

export async function fetchKpis(): Promise<KPIResponse> {
  const r = await fetch(`${API_BASE}/kpis`, { cache: "no-store" });
  if (!r.ok) throw new Error("Failed to fetch KPIs");
  return r.json();
}

export async function fetchSkus(limit = 80): Promise<SkuRecord[]> {
  const r = await fetch(`${API_BASE}/skus?limit=${limit}`, { cache: "no-store" });
  if (!r.ok) throw new Error("Failed to fetch SKU list");
  return r.json();
}

export async function fetchStockTrend(skuId: string, historyDays = 60, forecastDays = 14): Promise<StockTrendResponse> {
  const r = await fetch(
    `${API_BASE}/trends/stock/${encodeURIComponent(skuId)}?history_days=${historyDays}&forecast_days=${forecastDays}`,
    { cache: "no-store" }
  );
  if (!r.ok) throw new Error("Failed to fetch stock trend");
  return r.json();
}

export async function agentChat(
  question: string
): Promise<{ intent: string; answer: string; traces: Array<Record<string, unknown>> }> {
  const r = await fetch(`${API_BASE}/agent/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question })
  });
  if (!r.ok) throw new Error("Failed to chat with agent");
  return r.json();
}

export async function stockoutPredict(skuId: string, horizonDays: number) {
  const r = await fetch(`${API_BASE}/predict/stockout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sku_id: skuId, horizon_days: horizonDays })
  });
  if (!r.ok) throw new Error("Failed stockout prediction");
  return r.json();
}
