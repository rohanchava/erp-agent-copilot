from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression, LogisticRegression

from services.store import ERPStore


class MLPredictor:
    def __init__(self, store: ERPStore) -> None:
        self.store = store
        self.stockout_model = self._train_stockout_model()
        self.delay_model = self._train_delay_model()
        self.demand_models = self._train_demand_models()

    def _train_stockout_model(self) -> LogisticRegression:
        df = self.store.inventory.copy()
        y = (df["days_of_cover"] < 8).astype(int)
        X = df[["on_hand", "daily_demand", "lead_time_days", "days_of_cover"]]
        model = LogisticRegression(max_iter=500)
        model.fit(X, y)
        return model

    def _train_delay_model(self) -> LogisticRegression:
        df = self.store.orders.copy()
        y = (df["is_delayed"] == 1).astype(int)
        X = df[["order_qty", "fulfilled_qty", "supplier_risk", "distance_km"]]
        model = LogisticRegression(max_iter=500)
        model.fit(X, y)
        return model

    def _train_demand_models(self) -> dict[str, LinearRegression]:
        models: dict[str, LinearRegression] = {}
        history = self.store.inventory_history.copy().sort_values("date")
        for sku_id, group in history.groupby("sku_id"):
            g = group.reset_index(drop=True)
            x_idx = np.arange(len(g))
            X = self._time_features(x_idx)
            y = g["demand_qty"].to_numpy()
            model = LinearRegression()
            model.fit(X, y)
            models[str(sku_id)] = model
        return models

    def stockout_risk(self, sku_id: str, horizon_days: int = 14) -> dict[str, Any]:
        row = self.store.inventory_row(sku_id)
        if row is None:
            return {"error": f"Unknown sku_id: {sku_id}"}

        forecast = self.stock_trend_with_forecast(sku_id, history_days=30, forecast_days=horizon_days)
        final_on_hand = float(forecast["forecast"][-1]["on_hand"]) if forecast["forecast"] else float(row["on_hand"])
        projected_cover = final_on_hand / max(float(row["daily_demand"]), 1.0)

        x = np.array(
            [
                [
                    final_on_hand,
                    row["daily_demand"],
                    row["lead_time_days"],
                    projected_cover,
                ]
            ]
        )
        proba = float(self.stockout_model.predict_proba(x)[0][1])

        return {
            "sku_id": sku_id,
            "horizon_days": horizon_days,
            "stockout_risk": round(proba, 3),
            "risk_band": self._band(proba),
            "projected_on_hand": int(round(final_on_hand)),
            "projected_days_of_cover": round(projected_cover, 2),
            "drivers": [
                "days_of_cover",
                "daily_demand",
                "lead_time_days",
                "demand_trend",
            ],
        }

    def delay_risk(self, order_id: str) -> dict[str, Any]:
        row = self.store.order_row(order_id)
        if row is None:
            return {"error": f"Unknown order_id: {order_id}"}

        x = np.array(
            [
                [
                    row["order_qty"],
                    row["fulfilled_qty"],
                    row["supplier_risk"],
                    row["distance_km"],
                ]
            ]
        )
        proba = float(self.delay_model.predict_proba(x)[0][1])

        return {
            "order_id": order_id,
            "delay_risk": round(proba, 3),
            "risk_band": self._band(proba),
            "drivers": ["supplier_risk", "distance_km", "fill_gap"],
        }

    def stock_trend_with_forecast(self, sku_id: str, history_days: int = 60, forecast_days: int = 14) -> dict[str, Any]:
        history = self.store.sku_history(sku_id, days=history_days)
        if history.empty:
            return {"error": f"Unknown sku_id: {sku_id}"}

        inv = self.store.inventory_row(sku_id)
        if inv is None:
            return {"error": f"Unknown sku_id: {sku_id}"}

        model = self.demand_models.get(sku_id)
        if model is None:
            return {"error": f"No forecast model for {sku_id}"}

        full_hist = self.store.sku_history(sku_id, days=5000)
        start_idx = len(full_hist)
        future_idx = np.arange(start_idx, start_idx + forecast_days)

        future_features = self._time_features(future_idx)
        pred_demand = model.predict(future_features)
        pred_demand = np.maximum(pred_demand, 1.0)

        lead_time = max(int(inv["lead_time_days"]), 1)
        reorder_qty = max(float(inv["daily_demand"]) * lead_time * 2.4, 40.0)

        running_on_hand = float(history.iloc[-1]["on_hand"])
        forecast_rows: list[dict[str, Any]] = []
        last_date = pd.to_datetime(history.iloc[-1]["date"])

        for i in range(forecast_days):
            # Approximate replenishment cycle: receive stock every lead_time days.
            if i > 0 and i % lead_time == 0:
                running_on_hand += reorder_qty

            running_on_hand = max(running_on_hand - float(pred_demand[i]), 0.0)
            point_date = last_date + pd.Timedelta(days=i + 1)
            forecast_rows.append(
                {
                    "date": point_date.strftime("%Y-%m-%d"),
                    "on_hand": int(round(running_on_hand)),
                    "predicted_demand": round(float(pred_demand[i]), 2),
                }
            )

        history_rows = [
            {
                "date": pd.to_datetime(row["date"]).strftime("%Y-%m-%d"),
                "on_hand": int(row["on_hand"]),
                "demand_qty": round(float(row["demand_qty"]), 2),
            }
            for _, row in history.iterrows()
        ]

        return {
            "sku_id": sku_id,
            "history_days": history_days,
            "forecast_days": forecast_days,
            "history": history_rows,
            "forecast": forecast_rows,
            "summary": {
                "latest_on_hand": int(history_rows[-1]["on_hand"]),
                "forecast_end_on_hand": int(forecast_rows[-1]["on_hand"]) if forecast_rows else int(history_rows[-1]["on_hand"]),
                "avg_predicted_demand": round(float(np.mean(pred_demand)), 2),
            },
        }

    @staticmethod
    def _time_features(x_idx: np.ndarray) -> np.ndarray:
        return np.column_stack(
            [
                x_idx,
                np.sin(2 * np.pi * x_idx / 7),
                np.cos(2 * np.pi * x_idx / 7),
                np.sin(2 * np.pi * x_idx / 30),
                np.cos(2 * np.pi * x_idx / 30),
            ]
        )

    @staticmethod
    def _band(p: float) -> str:
        if p >= 0.66:
            return "HIGH"
        if p >= 0.33:
            return "MEDIUM"
        return "LOW"
