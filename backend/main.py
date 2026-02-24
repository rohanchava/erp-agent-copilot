from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from services.agent import answer_with_agent
from services.ml import MLPredictor
from services.store import ERPStore

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR.parent / "data" / "generated"

app = FastAPI(title="ERP Copilot API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

store = ERPStore(DATA_DIR)
ml = MLPredictor(store)


class ChatRequest(BaseModel):
    question: str


class ChatResponse(BaseModel):
    intent: str
    answer: str
    traces: list[dict[str, Any]]


class StockoutRequest(BaseModel):
    sku_id: str
    horizon_days: int = 14


class DelayRiskRequest(BaseModel):
    order_id: str


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/kpis")
def get_kpis() -> dict[str, Any]:
    return store.kpis()


@app.get("/skus")
def get_skus(limit: int = Query(default=50, ge=1, le=200)) -> list[dict[str, Any]]:
    return store.list_skus(limit=limit)


@app.get("/trends/stock/{sku_id}")
def get_stock_trend(
    sku_id: str,
    history_days: int = Query(default=60, ge=14, le=180),
    forecast_days: int = Query(default=14, ge=7, le=60),
) -> dict[str, Any]:
    return ml.stock_trend_with_forecast(sku_id.upper(), history_days=history_days, forecast_days=forecast_days)


@app.get("/analytics/suppliers")
def supplier_analytics(limit: int = Query(default=5, ge=1, le=20)) -> list[dict[str, Any]]:
    return store.supplier_delay_summary(limit=limit)


@app.get("/analytics/warehouses")
def warehouse_analytics(limit: int = Query(default=5, ge=1, le=20)) -> list[dict[str, Any]]:
    return store.warehouse_low_cover(limit=limit)


@app.post("/predict/stockout")
def predict_stockout(payload: StockoutRequest) -> dict[str, Any]:
    return ml.stockout_risk(payload.sku_id, payload.horizon_days)


@app.post("/predict/delay")
def predict_delay(payload: DelayRiskRequest) -> dict[str, Any]:
    return ml.delay_risk(payload.order_id)


@app.post("/agent/chat", response_model=ChatResponse)
def chat(payload: ChatRequest) -> ChatResponse:
    result = answer_with_agent(payload.question, store, ml)
    return ChatResponse(**result)
