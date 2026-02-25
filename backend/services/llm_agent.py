from __future__ import annotations

import json
import os
from typing import Any

from openai import OpenAI

from services.ml import MLPredictor
from services.store import ERPStore


def _tool_schemas() -> list[dict[str, Any]]:
    return [
        {
            "type": "function",
            "function": {
                "name": "get_kpis",
                "description": "Return current ERP KPI snapshot.",
                "parameters": {"type": "object", "properties": {}},
            },
        },
        {
            "type": "function",
            "function": {
                "name": "get_anomalies",
                "description": "Return demand/stock/supplier anomalies for a time window.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "days": {"type": "integer", "minimum": 7, "maximum": 180},
                        "limit": {"type": "integer", "minimum": 1, "maximum": 20},
                    },
                    "required": ["days"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "get_stockout_risk",
                "description": "Return stockout risk prediction for a SKU and horizon.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "sku_id": {"type": "string"},
                        "horizon_days": {"type": "integer", "minimum": 7, "maximum": 60},
                    },
                    "required": ["sku_id"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "get_stock_performance",
                "description": "Return stock performance metrics for a SKU over a time window.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "sku_id": {"type": "string"},
                        "days": {"type": "integer", "minimum": 7, "maximum": 180},
                    },
                    "required": ["sku_id", "days"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "get_supplier_performance",
                "description": "Return supplier delivery performance for a supplier and time window.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "supplier_id": {"type": "string"},
                        "days": {"type": "integer", "minimum": 7, "maximum": 180},
                    },
                    "required": ["supplier_id", "days"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "get_supplier_delay_summary",
                "description": "Return ranked supplier delays in a time window.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "days": {"type": "integer", "minimum": 7, "maximum": 180},
                        "limit": {"type": "integer", "minimum": 1, "maximum": 20},
                    },
                    "required": ["days"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "get_warehouse_risk",
                "description": "Return warehouses with lowest days of cover.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "limit": {"type": "integer", "minimum": 1, "maximum": 20},
                    },
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "get_stock_trend",
                "description": "Return historical and forecast stock trend for a SKU.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "sku_id": {"type": "string"},
                        "history_days": {"type": "integer", "minimum": 30, "maximum": 180},
                        "forecast_days": {"type": "integer", "minimum": 7, "maximum": 60},
                    },
                    "required": ["sku_id"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "simulate_stock_scenario",
                "description": "Run what-if simulation with demand/lead-time/replenishment multipliers.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "sku_id": {"type": "string"},
                        "history_days": {"type": "integer", "minimum": 30, "maximum": 180},
                        "forecast_days": {"type": "integer", "minimum": 7, "maximum": 60},
                        "demand_multiplier": {"type": "number", "minimum": 0.6, "maximum": 1.8},
                        "lead_time_multiplier": {"type": "number", "minimum": 0.6, "maximum": 2.0},
                        "replenishment_multiplier": {"type": "number", "minimum": 0.6, "maximum": 1.8},
                    },
                    "required": ["sku_id"],
                },
            },
        },
    ]


def _intent_from_tool(tool_name: str) -> str:
    mapping = {
        "get_kpis": "kpi_summary",
        "get_anomalies": "anomaly_detection",
        "get_stockout_risk": "stockout_risk",
        "get_stock_performance": "stock_performance",
        "get_supplier_performance": "supplier_delivery_analysis",
        "get_supplier_delay_summary": "supplier_delivery_analysis",
        "get_warehouse_risk": "warehouse_risk",
        "get_stock_trend": "trend_forecast",
        "simulate_stock_scenario": "scenario_simulation",
    }
    return mapping.get(tool_name, "llm_tooling")


def answer_with_llm_tools(question: str, store: ERPStore, ml: MLPredictor) -> dict[str, Any]:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY not set")

    model = os.getenv("LLM_AGENT_MODEL", "gpt-4o-mini")
    client = OpenAI(api_key=api_key)

    traces: list[dict[str, Any]] = []
    intent = "llm_tooling"

    def call_tool(name: str, args: dict[str, Any]) -> Any:
        if name == "get_kpis":
            return store.kpis()
        if name == "get_anomalies":
            return store.anomaly_summary(days=int(args.get("days", 30)), limit=int(args.get("limit", 5)))
        if name == "get_stockout_risk":
            return ml.stockout_risk(args.get("sku_id", "").upper(), int(args.get("horizon_days", 14)))
        if name == "get_stock_performance":
            sku_id = args.get("sku_id", "").upper()
            return store.stock_performance(sku_id, days=int(args.get("days", 30))) or {"error": f"No data for {sku_id}"}
        if name == "get_supplier_performance":
            supplier_id = args.get("supplier_id", "").upper()
            return store.supplier_performance(supplier_id, days=int(args.get("days", 30))) or {
                "error": f"No data for {supplier_id}"
            }
        if name == "get_supplier_delay_summary":
            return store.supplier_delay_summary(limit=int(args.get("limit", 5)), days=int(args.get("days", 30)))
        if name == "get_warehouse_risk":
            return store.warehouse_low_cover(limit=int(args.get("limit", 5)))
        if name == "get_stock_trend":
            return ml.stock_trend_with_forecast(
                sku_id=args.get("sku_id", "").upper(),
                history_days=int(args.get("history_days", 60)),
                forecast_days=int(args.get("forecast_days", 14)),
            )
        if name == "simulate_stock_scenario":
            return ml.simulate_stock_scenario(
                sku_id=args.get("sku_id", "").upper(),
                history_days=int(args.get("history_days", 60)),
                forecast_days=int(args.get("forecast_days", 14)),
                demand_multiplier=float(args.get("demand_multiplier", 1.0)),
                lead_time_multiplier=float(args.get("lead_time_multiplier", 1.0)),
                replenishment_multiplier=float(args.get("replenishment_multiplier", 1.0)),
            )
        return {"error": f"Unknown tool: {name}"}

    messages: list[dict[str, Any]] = [
        {
            "role": "system",
            "content": (
                "You are an ERP operations copilot. Use tools for factual answers. "
                "Prefer concise operational recommendations with numeric evidence."
            ),
        },
        {"role": "user", "content": question},
    ]

    for _ in range(5):
        completion = client.chat.completions.create(
            model=model,
            messages=messages,
            tools=_tool_schemas(),
            tool_choice="auto",
            temperature=0.1,
        )

        message = completion.choices[0].message
        tool_calls = message.tool_calls or []

        if not tool_calls:
            answer = message.content or "I could not produce an answer."
            return {"intent": intent, "answer": answer, "traces": traces}

        messages.append(
            {
                "role": "assistant",
                "content": message.content or "",
                "tool_calls": [
                    {
                        "id": tc.id,
                        "type": tc.type,
                        "function": {"name": tc.function.name, "arguments": tc.function.arguments},
                    }
                    for tc in tool_calls
                ],
            }
        )

        for tc in tool_calls:
            tool_name = tc.function.name
            try:
                args = json.loads(tc.function.arguments or "{}")
            except json.JSONDecodeError:
                args = {}

            result = call_tool(tool_name, args)
            traces.append({"tool": tool_name, "input": args, "output": result})
            if intent == "llm_tooling":
                intent = _intent_from_tool(tool_name)

            messages.append({"role": "tool", "tool_call_id": tc.id, "content": json.dumps(result)})

    return {
        "intent": intent,
        "answer": "I reached the tool-call limit. Please narrow the question.",
        "traces": traces,
    }
