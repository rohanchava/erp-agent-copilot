from __future__ import annotations

import os
import re
from typing import Any

from services.ml import MLPredictor
from services.store import ERPStore


def _extract_sku(question: str) -> str | None:
    m = re.search(r"sku[-\s]?(\d{4})", question.lower())
    if not m:
        return None
    return f"SKU-{m.group(1)}"


def _extract_supplier(question: str) -> str | None:
    m = re.search(r"sup[-\s]?(\d{1,2})", question.lower())
    if m:
        return f"SUP-{int(m.group(1))}"

    m = re.search(r"supplier\s+(\d{1,2})", question.lower())
    if m:
        return f"SUP-{int(m.group(1))}"
    return None


def _extract_days(question: str, default: int = 30) -> int:
    q = question.lower()
    if "last week" in q:
        return 7
    if "last month" in q:
        return 30
    if "last quarter" in q:
        return 90

    m = re.search(r"last\s+(\d{1,3})\s*(day|days|d)", q)
    if m:
        return max(7, min(180, int(m.group(1))))

    m = re.search(r"(\d{1,3})\s*(day|days|d)\s*(window|period|time frame|timeframe)?", q)
    if m:
        return max(7, min(180, int(m.group(1))))

    return default


def _rule_based_answer(question: str, store: ERPStore, ml: MLPredictor) -> dict[str, Any]:
    q = question.lower()
    traces: list[dict[str, Any]] = []
    sku_id = _extract_sku(q)
    supplier_id = _extract_supplier(q)
    days = _extract_days(q, default=30)

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

    if "anomal" in q or "outlier" in q or "spike" in q or "abnormal" in q:
        anomalies = store.anomaly_summary(days=days, limit=5)
        traces.append({"tool": "anomaly_summary", "input": {"days": days, "limit": 5}, "output": anomalies})

        top_demand = anomalies["demand_spikes"][0]["sku_id"] if anomalies["demand_spikes"] else "N/A"
        top_stock_drop = anomalies["stock_drops"][0]["sku_id"] if anomalies["stock_drops"] else "N/A"
        top_supplier = anomalies["supplier_delivery_risk"][0]["supplier_id"] if anomalies["supplier_delivery_risk"] else "N/A"
        return {
            "intent": "anomaly_detection",
            "answer": (
                f"In the last {days} days, top anomalies are demand spike on {top_demand}, "
                f"largest stock drop on {top_stock_drop}, and highest supplier delay risk on {top_supplier}."
            ),
            "traces": traces,
        }

    if (
        ("perform" in q or "trend" in q or "how has" in q or "stock wise" in q)
        and ("item" in q or "sku" in q or "stock" in q)
        and sku_id
    ):
        perf = store.stock_performance(sku_id, days=days)
        if perf is None:
            return {"intent": "stock_performance", "answer": f"No performance data found for {sku_id}.", "traces": traces}

        traces.append({"tool": "stock_performance", "input": {"sku_id": sku_id, "days": days}, "output": perf})
        direction = "improved" if perf["change_units"] >= 0 else "declined"
        return {
            "intent": "stock_performance",
            "answer": (
                f"{sku_id} stock has {direction} over the last {days} days: {perf['start_on_hand']} -> {perf['end_on_hand']} "
                f"({perf['change_pct']}%). Average on-hand was {perf['avg_on_hand']}"
            ),
            "traces": traces,
        }

    if "supplier" in q and ("delivery" in q or "deliver" in q or "delay" in q or "late" in q or "perform" in q):
        if supplier_id:
            perf = store.supplier_performance(supplier_id=supplier_id, days=days)
            if perf is None:
                return {
                    "intent": "supplier_delivery_analysis",
                    "answer": f"No delivery data found for {supplier_id} in the last {days} days.",
                    "traces": traces,
                }
            traces.append({"tool": "supplier_performance", "input": {"supplier_id": supplier_id, "days": days}, "output": perf})
            return {
                "intent": "supplier_delivery_analysis",
                "answer": (
                    f"{supplier_id} delivery performance over last {days} days: late rate {round(float(perf['late_rate']) * 100, 1)}%, "
                    f"avg lateness {perf['avg_late_days']} days across {perf['po_count']} POs."
                ),
                "traces": traces,
            }

        ranked = store.supplier_delay_summary(limit=5, days=days)
        traces.append({"tool": "supplier_delay_summary", "input": {"limit": 5, "days": days}, "output": ranked})
        if not ranked:
            return {"intent": "supplier_delivery_analysis", "answer": f"No supplier delivery data in last {days} days.", "traces": traces}

        top = ranked[0]
        return {
            "intent": "supplier_delivery_analysis",
            "answer": (
                f"In the last {days} days, most delayed supplier is {top['supplier_id']} with average lateness of "
                f"{top['avg_late_days']} days and late rate {round(float(top['late_rate']) * 100, 1)}%."
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

    if "improv" in q or "focus area" in q or "what should we work on" in q:
        kpis = store.kpis()
        anomalies = store.anomaly_summary(days=30, limit=3)
        supplier = store.supplier_delay_summary(limit=1, days=30)
        warehouse = store.warehouse_low_cover(limit=1)

        traces.append({"tool": "kpis", "input": {}, "output": kpis})
        traces.append({"tool": "anomaly_summary", "input": {"days": 30, "limit": 3}, "output": anomalies})
        traces.append({"tool": "supplier_delay_summary", "input": {"days": 30, "limit": 1}, "output": supplier})
        traces.append({"tool": "warehouse_low_cover", "input": {"limit": 1}, "output": warehouse})

        supplier_note = (
            f"{supplier[0]['supplier_id']} ({round(float(supplier[0]['late_rate']) * 100, 1)}% late rate)"
            if supplier
            else "N/A"
        )
        warehouse_note = (
            f"{warehouse[0]['warehouse_id']} ({warehouse[0]['avg_days_of_cover']} days cover)"
            if warehouse
            else "N/A"
        )
        top_drop = anomalies["stock_drops"][0]["sku_id"] if anomalies["stock_drops"] else "N/A"

        return {
            "intent": "improvement_priorities",
            "answer": (
                "Top improvement areas: "
                f"1) fulfillment reliability (delayed shipments: {kpis['delayed_shipments']}), "
                f"2) inventory health (low-stock SKUs: {kpis['low_stock_skus']}, biggest recent drop: {top_drop}), "
                f"3) supplier performance (highest risk supplier: {supplier_note}), "
                f"4) warehouse coverage balance (lowest cover warehouse: {warehouse_note})."
            ),
            "traces": traces,
        }

    if ("trend" in q or "forecast" in q or "projection" in q) and sku_id:
        trend = ml.stock_trend_with_forecast(sku_id, history_days=max(days, 30), forecast_days=14)
        if "error" in trend:
            return {"intent": "trend_forecast", "answer": trend["error"], "traces": traces}

        summary = trend["summary"]
        traces.append(
            {
                "tool": "stock_trend_with_forecast",
                "input": {"sku_id": sku_id, "history_days": max(days, 30), "forecast_days": 14},
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
                f"Next are {items[1]['sku_id']} and {items[2]['sku_id']}"
            ),
            "traces": traces,
        }

    data = store.kpis()
    traces.append({"tool": "fallback_kpis", "input": {}, "output": data})
    return {
        "intent": "fallback",
        "answer": (
            "I can answer KPI, stockout, anomalies, supplier delivery, warehouse risk, inventory performance, trend, and forecast questions. "
            f"Current snapshot: open orders {data['open_orders']}, delayed shipments {data['delayed_shipments']}."
        ),
        "traces": traces,
    }


def answer_with_agent(question: str, store: ERPStore, ml: MLPredictor) -> dict[str, Any]:
    if os.getenv("OPENAI_API_KEY") and os.getenv("DISABLE_LLM_AGENT", "0") != "1":
        try:
            from services.llm_agent import answer_with_llm_tools

            return answer_with_llm_tools(question=question, store=store, ml=ml)
        except Exception as exc:
            result = _rule_based_answer(question=question, store=store, ml=ml)
            result["traces"] = [{"tool": "llm_fallback", "input": {}, "output": str(exc)}, *result.get("traces", [])]
            return result

    return _rule_based_answer(question=question, store=store, ml=ml)
