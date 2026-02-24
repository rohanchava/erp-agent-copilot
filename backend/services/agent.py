from __future__ import annotations

import re
from typing import Any

from services.ml import MLPredictor
from services.store import ERPStore


def _extract_sku(question: str) -> str | None:
    m = re.search(r"sku[-\s]?(\d{4})", question.lower())
    if not m:
        return None
    return f"SKU-{m.group(1)}"


def answer_with_agent(question: str, store: ERPStore, ml: MLPredictor) -> dict[str, Any]:
    q = question.lower()
    traces: list[dict[str, Any]] = []
    sku_id = _extract_sku(q)

    if "kpi" in q or "dashboard" in q or "summary" in q:
        data = store.kpis()
        traces.append({"tool": "kpis", "input": {}, "output": data})
        return {
            "intent": "kpi_summary",
            "answer": (
                f"Open orders: {data['open_orders']}, delayed shipments: {data['delayed_shipments']}, "
                f"avg fill rate: {data['avg_fill_rate']}, low-stock SKUs: {data['low_stock_skus']}, warehouses: {data['warehouses']}."
            ),
            "traces": traces,
        }

    if "supplier" in q and ("delay" in q or "late" in q or "slow" in q):
        ranked = store.supplier_delay_summary(limit=5)
        traces.append({"tool": "supplier_delay_summary", "input": {"limit": 5}, "output": ranked})
        top = ranked[0]
        return {
            "intent": "supplier_delay_analysis",
            "answer": (
                f"Most delayed supplier is {top['supplier_id']} with average lateness of {top['avg_late_days']} days "
                f"and late rate {round(float(top['late_rate']) * 100, 1)}%."
            ),
            "traces": traces,
        }

    if "warehouse" in q and ("risk" in q or "low" in q or "cover" in q):
        ranked = store.warehouse_low_cover(limit=4)
        traces.append({"tool": "warehouse_low_cover", "input": {"limit": 4}, "output": ranked})
        worst = ranked[0]
        return {
            "intent": "warehouse_risk",
            "answer": (
                f"Lowest inventory cover is at {worst['warehouse_id']} (avg cover {worst['avg_days_of_cover']} days). "
                f"Total on hand there: {worst['total_on_hand']} units."
            ),
            "traces": traces,
        }

    if ("trend" in q or "forecast" in q or "projection" in q) and sku_id:
        trend = ml.stock_trend_with_forecast(sku_id, history_days=60, forecast_days=14)
        if "error" in trend:
            return {"intent": "trend_forecast", "answer": trend["error"], "traces": traces}

        summary = trend["summary"]
        traces.append(
            {
                "tool": "stock_trend_with_forecast",
                "input": {"sku_id": sku_id, "history_days": 60, "forecast_days": 14},
                "output": {
                    "latest_on_hand": summary["latest_on_hand"],
                    "forecast_end_on_hand": summary["forecast_end_on_hand"],
                    "avg_predicted_demand": summary["avg_predicted_demand"],
                },
            }
        )
        return {
            "intent": "trend_forecast",
            "answer": (
                f"For {sku_id}, projected on-hand moves from {summary['latest_on_hand']} to "
                f"{summary['forecast_end_on_hand']} over the next 14 days. "
                f"Avg predicted daily demand is {summary['avg_predicted_demand']}."
            ),
            "traces": traces,
        }

    if "stockout" in q or "low stock" in q or ("risk" in q and "delay" not in q):
        candidates = store.top_stockout_candidates(limit=3)
        traces.append({"tool": "top_stockout_candidates", "input": {"limit": 3}, "output": candidates})

        target_sku = sku_id if sku_id is not None else candidates[0]["sku_id"]
        pred = ml.stockout_risk(target_sku, horizon_days=14)
        traces.append({"tool": "stockout_risk", "input": {"sku_id": target_sku, "horizon_days": 14}, "output": pred})

        if "error" in pred:
            return {"intent": "stockout_risk", "answer": pred["error"], "traces": traces}

        return {
            "intent": "stockout_risk",
            "answer": (
                f"{target_sku} has {pred['risk_band']} stockout risk ({pred['stockout_risk']}) in 14 days. "
                f"Projected on-hand: {pred['projected_on_hand']}, projected cover: {pred['projected_days_of_cover']} days."
            ),
            "traces": traces,
        }

    if "delay" in q:
        order_id = "ORD-1008"
        pred = ml.delay_risk(order_id)
        traces.append({"tool": "delay_risk", "input": {"order_id": order_id}, "output": pred})
        return {
            "intent": "delay_risk",
            "answer": (
                f"Order {order_id} has {pred['risk_band']} delay risk ({pred['delay_risk']}). "
                f"Primary drivers: {', '.join(pred['drivers'])}."
            ),
            "traces": traces,
        }

    inventory_words = ("most stocked", "most inventory", "top stocked", "in stock", "on hand", "stock level")
    if any(word in q for word in inventory_words):
        items = store.top_stocked_items(limit=3)
        traces.append({"tool": "top_stocked_items", "input": {"limit": 3}, "output": items})
        top = items[0]
        return {
            "intent": "inventory_lookup",
            "answer": (
                f"The most stocked item is {top['sku_id']} ({top['sku_name']}) with {top['on_hand']} units on hand. "
                f"Next are {items[1]['sku_id']} and {items[2]['sku_id']}."
            ),
            "traces": traces,
        }

    data = store.kpis()
    traces.append({"tool": "fallback_kpis", "input": {}, "output": data})
    return {
        "intent": "fallback",
        "answer": (
            "I can answer KPI, stockout, supplier delay, warehouse risk, inventory trend, and forecast questions. "
            f"Current snapshot: open orders {data['open_orders']}, delayed shipments {data['delayed_shipments']}."
        ),
        "traces": traces,
    }
