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
    min_forecast_on_hand: number;
    avg_predicted_demand: number;
    safety_stock_estimate: number;
    projected_runout_date: string | null;
  };
};

export type ScenarioResponse = {
  sku_id: string;
  history_days: number;
  forecast_days: number;
  baseline: StockTrendResponse;
  scenario: StockTrendResponse;
  delta_vs_baseline_end_on_hand: number;
  scenario_min_on_hand: number;
  scenario_runout_date: string | null;
};

export type AnomalyResponse = {
  window_days: number;
  demand_spikes: Array<{ date: string; sku_id: string; demand_qty: number; z_score: number }>;
  stock_drops: Array<{ sku_id: string; start_on_hand: number; end_on_hand: number; drop_pct: number }>;
  supplier_delivery_risk: Array<{ supplier_id: string; late_rate: number; avg_late_days: number; po_count: number; risk_score: number }>;
};

export type OverviewTimelinePoint = {
  date: string;
  order_count: number;
  open_orders: number;
  avg_fill_rate: number;
  shipment_count: number;
  delayed_shipments: number;
  delayed_rate: number;
};

export type MoverRow = {
  sku_id: string;
  sku_name: string;
  change_pct: number;
  change_units: number;
  start_on_hand: number;
  end_on_hand: number;
  window_days: number;
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

export async function simulateStockScenario(params: {
  skuId: string;
  historyDays: number;
  forecastDays: number;
  demandMultiplier: number;
  leadTimeMultiplier: number;
  replenishmentMultiplier: number;
}): Promise<ScenarioResponse> {
  const r = await fetch(`${API_BASE}/simulate/stock`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sku_id: params.skuId,
      history_days: params.historyDays,
      forecast_days: params.forecastDays,
      demand_multiplier: params.demandMultiplier,
      lead_time_multiplier: params.leadTimeMultiplier,
      replenishment_multiplier: params.replenishmentMultiplier
    })
  });
  if (!r.ok) throw new Error("Failed to simulate stock scenario");
  return r.json();
}

export async function fetchAnomalies(days = 30, limit = 5): Promise<AnomalyResponse> {
  const r = await fetch(`${API_BASE}/analytics/anomalies?days=${days}&limit=${limit}`, { cache: "no-store" });
  if (!r.ok) throw new Error("Failed to fetch anomaly analytics");
  return r.json();
}

export async function fetchOverviewTimeline(days = 30): Promise<OverviewTimelinePoint[]> {
  const r = await fetch(`${API_BASE}/analytics/overview-timeline?days=${days}`, { cache: "no-store" });
  if (!r.ok) throw new Error("Failed to fetch overview timeline");
  return r.json();
}

export async function fetchTopMovers(days = 30, limit = 5): Promise<{ gainers: MoverRow[]; decliners: MoverRow[] }> {
  const r = await fetch(`${API_BASE}/analytics/top-movers?days=${days}&limit=${limit}`, { cache: "no-store" });
  if (!r.ok) throw new Error("Failed to fetch top movers");
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

export type ReorderRecommendation = {
  sku_id: string;
  sku_name: string;
  on_hand: number;
  daily_demand: number;
  lead_time_days: number;
  demand_std: number;
  safety_stock: number;
  rop: number;
  reorder_qty: number;
  days_to_reorder: number;
  suggested_order_date: string;
  status: "REORDER_NOW" | "REORDER_SOON" | "OK";
  confidence: "HIGH" | "MEDIUM" | "LOW";
  urgency_score: number;
};

export async function fetchReorderRecommendations(
  limit?: number,
  statusFilter?: string
): Promise<ReorderRecommendation[]> {
  const params = new URLSearchParams();
  if (limit != null) params.set("limit", String(limit));
  if (statusFilter) params.set("status_filter", statusFilter);
  const query = params.toString() ? `?${params.toString()}` : "";
  const r = await fetch(`${API_BASE}/recommendations/reorder${query}`, { cache: "no-store" });
  if (!r.ok) throw new Error("Failed to fetch reorder recommendations");
  return r.json();
}

export type SkuProfile = {
  sku_id: string; sku_name: string;
  on_hand: number; daily_demand: number;
  lead_time_days: number; days_of_cover: number;
  performance: Record<string, number> | null;
  reorder: ReorderRecommendation | null;
};

export async function fetchSkuProfile(skuId: string): Promise<SkuProfile> {
  const r = await fetch(`${API_BASE}/skus/${encodeURIComponent(skuId)}/profile`, { cache: "no-store" });
  if (!r.ok) throw new Error(`SKU not found: ${skuId}`);
  return r.json();
}

export type DemandAnomaly = {
  date: string;
  demand_qty: number;
  mean_demand: number;
  std_demand: number;
  z_score: number;
  severity: "HIGH" | "MEDIUM" | "LOW";
};

export type DemandAnomalyResponse = {
  sku_id: string;
  window_days: number;
  z_threshold: number;
  baseline_mean: number;
  baseline_std: number;
  anomaly_count: number;
  anomalies: DemandAnomaly[];
};

export async function fetchDemandAnomalies(
  skuId: string,
  days = 30,
  zThreshold = 2.0
): Promise<DemandAnomalyResponse> {
  const r = await fetch(
    `${API_BASE}/skus/${encodeURIComponent(skuId)}/demand-anomalies?days=${days}&z_threshold=${zThreshold}`,
    { cache: "no-store" }
  );
  if (!r.ok) throw new Error(`Failed to fetch demand anomalies for ${skuId}`);
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
