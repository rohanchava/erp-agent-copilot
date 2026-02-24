from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd


@dataclass
class ERPStore:
    data_dir: Path

    def __post_init__(self) -> None:
        self.inventory = pd.read_csv(self.data_dir / "inventory.csv")
        self.orders = pd.read_csv(self.data_dir / "orders.csv")
        self.shipments = pd.read_csv(self.data_dir / "shipments.csv")
        self.purchase_orders = pd.read_csv(self.data_dir / "purchase_orders.csv")

        inv_hist_path = self.data_dir / "inventory_history.csv"
        wh_inv_path = self.data_dir / "warehouse_inventory.csv"

        if inv_hist_path.exists():
            self.inventory_history = pd.read_csv(inv_hist_path, parse_dates=["date"])
        else:
            self.inventory_history = self._fallback_inventory_history()

        if wh_inv_path.exists():
            self.warehouse_inventory = pd.read_csv(wh_inv_path)
        else:
            self.warehouse_inventory = self._fallback_warehouse_inventory()

        self._normalize_date_columns()

    def _normalize_date_columns(self) -> None:
        today = pd.Timestamp.today().normalize()

        if "order_date" in self.orders.columns:
            self.orders["order_date"] = pd.to_datetime(self.orders["order_date"], errors="coerce")
        else:
            self.orders["order_date"] = today

        if "shipment_date" in self.shipments.columns:
            self.shipments["shipment_date"] = pd.to_datetime(self.shipments["shipment_date"], errors="coerce")
        else:
            self.shipments["shipment_date"] = today

        if "po_date" in self.purchase_orders.columns:
            self.purchase_orders["po_date"] = pd.to_datetime(self.purchase_orders["po_date"], errors="coerce")
        else:
            self.purchase_orders["po_date"] = today

        if "expected_delivery_date" in self.purchase_orders.columns:
            self.purchase_orders["expected_delivery_date"] = pd.to_datetime(
                self.purchase_orders["expected_delivery_date"], errors="coerce"
            )
        else:
            self.purchase_orders["expected_delivery_date"] = self.purchase_orders["po_date"] + pd.to_timedelta(
                self.purchase_orders["expected_days"], unit="D"
            )

        if "actual_delivery_date" in self.purchase_orders.columns:
            self.purchase_orders["actual_delivery_date"] = pd.to_datetime(
                self.purchase_orders["actual_delivery_date"], errors="coerce"
            )
        else:
            self.purchase_orders["actual_delivery_date"] = self.purchase_orders["po_date"] + pd.to_timedelta(
                self.purchase_orders["actual_days"], unit="D"
            )

    def _fallback_inventory_history(self) -> pd.DataFrame:
        dates = pd.date_range(end=pd.Timestamp.today().normalize(), periods=30, freq="D")
        rows: list[dict[str, Any]] = []
        for _, row in self.inventory.iterrows():
            for d in dates:
                rows.append(
                    {
                        "date": d,
                        "sku_id": row["sku_id"],
                        "demand_qty": float(row["daily_demand"]),
                        "on_hand": int(row["on_hand"]),
                    }
                )
        return pd.DataFrame(rows)

    def _fallback_warehouse_inventory(self) -> pd.DataFrame:
        rows = []
        for _, row in self.inventory.iterrows():
            rows.append(
                {
                    "warehouse_id": "WH-DEFAULT",
                    "sku_id": row["sku_id"],
                    "on_hand": int(row["on_hand"]),
                    "days_of_cover": round(float(row["days_of_cover"]), 1),
                }
            )
        return pd.DataFrame(rows)

    def _window_start(self, days: int) -> pd.Timestamp:
        return pd.Timestamp.today().normalize() - pd.Timedelta(days=max(days, 1))

    def kpis(self) -> dict[str, Any]:
        open_orders = int((self.orders["status"] == "OPEN").sum())
        delayed_shipments = int((self.shipments["actual_delivery_days"] > self.shipments["planned_delivery_days"]).sum())
        avg_fill_rate = float((self.orders["fulfilled_qty"] / self.orders["order_qty"]).mean())
        low_stock = int((self.inventory["days_of_cover"] < 10).sum())

        return {
            "open_orders": open_orders,
            "delayed_shipments": delayed_shipments,
            "avg_fill_rate": round(avg_fill_rate, 3),
            "low_stock_skus": low_stock,
            "total_skus": int(self.inventory["sku_id"].nunique()),
            "warehouses": int(self.warehouse_inventory["warehouse_id"].nunique()),
        }

    def list_skus(self, limit: int = 50) -> list[dict[str, Any]]:
        rows = self.inventory.sort_values("on_hand", ascending=False).head(limit)
        return rows[["sku_id", "sku_name", "on_hand", "days_of_cover"]].to_dict("records")

    def top_stockout_candidates(self, limit: int = 5) -> list[dict[str, Any]]:
        ranked = self.inventory.sort_values("days_of_cover").head(limit)
        return ranked[["sku_id", "sku_name", "on_hand", "days_of_cover"]].to_dict("records")

    def top_stocked_items(self, limit: int = 5) -> list[dict[str, Any]]:
        ranked = self.inventory.sort_values("on_hand", ascending=False).head(limit)
        return ranked[["sku_id", "sku_name", "on_hand", "days_of_cover"]].to_dict("records")

    def stock_performance(self, sku_id: str, days: int = 30) -> dict[str, Any] | None:
        history = self.sku_history(sku_id, days=days)
        if history.empty:
            return None

        first = history.iloc[0]
        last = history.iloc[-1]
        start_on_hand = float(first["on_hand"])
        end_on_hand = float(last["on_hand"])
        pct_change = ((end_on_hand - start_on_hand) / max(start_on_hand, 1.0)) * 100

        return {
            "sku_id": sku_id,
            "window_days": days,
            "start_on_hand": int(start_on_hand),
            "end_on_hand": int(end_on_hand),
            "change_units": int(end_on_hand - start_on_hand),
            "change_pct": round(pct_change, 2),
            "avg_on_hand": round(float(history["on_hand"].mean()), 1),
            "avg_demand": round(float(history["demand_qty"].mean()), 2),
            "min_on_hand": int(history["on_hand"].min()),
            "max_on_hand": int(history["on_hand"].max()),
        }

    def supplier_delay_summary(self, limit: int = 5, days: int | None = None) -> list[dict[str, Any]]:
        df = self.purchase_orders.copy()
        if days is not None:
            df = df[df["po_date"] >= self._window_start(days)]
        if df.empty:
            return []

        df["late_days"] = (df["actual_days"] - df["expected_days"]).clip(lower=0)
        grouped = (
            df.groupby("supplier_id")
            .agg(
                avg_late_days=("late_days", "mean"),
                late_rate=("status", lambda s: (s == "LATE").mean()),
                po_count=("po_id", "count"),
            )
            .reset_index()
            .sort_values(["avg_late_days", "late_rate"], ascending=False)
            .head(limit)
        )
        grouped["avg_late_days"] = grouped["avg_late_days"].round(2)
        grouped["late_rate"] = grouped["late_rate"].round(3)
        return grouped.to_dict("records")

    def supplier_performance(self, supplier_id: str, days: int = 30) -> dict[str, Any] | None:
        df = self.purchase_orders.copy()
        df = df[(df["supplier_id"] == supplier_id) & (df["po_date"] >= self._window_start(days))]
        if df.empty:
            return None

        late_days = (df["actual_days"] - df["expected_days"]).clip(lower=0)
        return {
            "supplier_id": supplier_id,
            "window_days": days,
            "po_count": int(df.shape[0]),
            "late_rate": round(float((df["status"] == "LATE").mean()), 3),
            "avg_late_days": round(float(late_days.mean()), 2),
            "on_time_rate": round(float((df["status"] == "ON_TIME").mean()), 3),
        }

    def warehouse_low_cover(self, limit: int = 5) -> list[dict[str, Any]]:
        grouped = (
            self.warehouse_inventory.groupby("warehouse_id")
            .agg(avg_days_of_cover=("days_of_cover", "mean"), total_on_hand=("on_hand", "sum"))
            .reset_index()
            .sort_values("avg_days_of_cover")
            .head(limit)
        )
        grouped["avg_days_of_cover"] = grouped["avg_days_of_cover"].round(2)
        return grouped.to_dict("records")

    def overview_timeline(self, days: int = 30) -> list[dict[str, Any]]:
        cutoff = self._window_start(days)
        end = pd.Timestamp.today().normalize()
        timeline = pd.DataFrame({"date": pd.date_range(start=cutoff, end=end, freq="D")})

        recent_orders = self.orders[self.orders["order_date"] >= cutoff].copy()
        if not recent_orders.empty:
            recent_orders["fill_rate"] = recent_orders["fulfilled_qty"] / recent_orders["order_qty"]
            recent_orders["date"] = recent_orders["order_date"].dt.normalize()
            order_daily = (
                recent_orders.groupby("date")
                .agg(
                    order_count=("order_id", "count"),
                    open_orders=("status", lambda s: int((s == "OPEN").sum())),
                    avg_fill_rate=("fill_rate", "mean"),
                )
                .reset_index()
            )
            timeline = timeline.merge(order_daily, on="date", how="left")

        recent_shipments = self.shipments[self.shipments["shipment_date"] >= cutoff].copy()
        if not recent_shipments.empty:
            recent_shipments["is_delayed"] = (
                recent_shipments["actual_delivery_days"] > recent_shipments["planned_delivery_days"]
            ).astype(int)
            recent_shipments["date"] = recent_shipments["shipment_date"].dt.normalize()
            shipment_daily = (
                recent_shipments.groupby("date")
                .agg(
                    shipment_count=("shipment_id", "count"),
                    delayed_shipments=("is_delayed", "sum"),
                    delayed_rate=("is_delayed", "mean"),
                )
                .reset_index()
            )
            timeline = timeline.merge(shipment_daily, on="date", how="left")

        timeline = timeline.fillna(0)
        timeline["avg_fill_rate"] = timeline["avg_fill_rate"].round(3)
        timeline["delayed_rate"] = timeline["delayed_rate"].round(3)

        return [
            {
                "date": row["date"].strftime("%Y-%m-%d"),
                "order_count": int(row["order_count"]),
                "open_orders": int(row["open_orders"]),
                "avg_fill_rate": float(row["avg_fill_rate"]),
                "shipment_count": int(row["shipment_count"]),
                "delayed_shipments": int(row["delayed_shipments"]),
                "delayed_rate": float(row["delayed_rate"]),
            }
            for _, row in timeline.iterrows()
        ]

    def top_movers(self, days: int = 30, limit: int = 5) -> dict[str, list[dict[str, Any]]]:
        rows: list[dict[str, Any]] = []
        sku_name_map = dict(zip(self.inventory["sku_id"], self.inventory["sku_name"]))

        for sku_id in self.inventory["sku_id"].tolist():
            perf = self.stock_performance(sku_id, days=days)
            if perf is None:
                continue
            perf["sku_name"] = sku_name_map.get(sku_id, sku_id)
            rows.append(perf)

        if not rows:
            return {"gainers": [], "decliners": []}

        df = pd.DataFrame(rows)
        gainers = df.sort_values("change_pct", ascending=False).head(limit)
        decliners = df.sort_values("change_pct", ascending=True).head(limit)
        return {
            "gainers": gainers[
                ["sku_id", "sku_name", "change_pct", "change_units", "start_on_hand", "end_on_hand", "window_days"]
            ].to_dict("records"),
            "decliners": decliners[
                ["sku_id", "sku_name", "change_pct", "change_units", "start_on_hand", "end_on_hand", "window_days"]
            ].to_dict("records"),
        }

    def anomaly_summary(self, days: int = 30, limit: int = 5) -> dict[str, Any]:
        demand = self._demand_anomalies(days=days, limit=limit)
        stock = self._stock_drop_anomalies(days=days, limit=limit)
        suppliers = self._supplier_delay_anomalies(days=days, limit=limit)
        return {
            "window_days": days,
            "demand_spikes": demand,
            "stock_drops": stock,
            "supplier_delivery_risk": suppliers,
        }

    def _demand_anomalies(self, days: int = 30, limit: int = 5) -> list[dict[str, Any]]:
        cutoff = self._window_start(days)
        recent = self.inventory_history[self.inventory_history["date"] >= cutoff].copy()
        if recent.empty:
            return []

        baseline = self.inventory_history.groupby("sku_id").agg(mean_demand=("demand_qty", "mean"), std_demand=("demand_qty", "std"))
        scored = recent.join(baseline, on="sku_id")
        scored["std_demand"] = scored["std_demand"].fillna(0.0)
        scored = scored[scored["std_demand"] > 0]
        if scored.empty:
            return []

        scored["z_score"] = ((scored["demand_qty"] - scored["mean_demand"]) / scored["std_demand"]).abs()
        top = scored.sort_values("z_score", ascending=False).head(limit)
        return [
            {
                "date": row["date"].strftime("%Y-%m-%d"),
                "sku_id": row["sku_id"],
                "demand_qty": round(float(row["demand_qty"]), 2),
                "z_score": round(float(row["z_score"]), 2),
            }
            for _, row in top.iterrows()
        ]

    def _stock_drop_anomalies(self, days: int = 30, limit: int = 5) -> list[dict[str, Any]]:
        cutoff = self._window_start(days)
        recent = self.inventory_history[self.inventory_history["date"] >= cutoff].copy()
        if recent.empty:
            return []

        rows: list[dict[str, Any]] = []
        for sku_id, group in recent.groupby("sku_id"):
            ordered = group.sort_values("date")
            start_on_hand = float(ordered.iloc[0]["on_hand"])
            end_on_hand = float(ordered.iloc[-1]["on_hand"])
            drop_pct = ((start_on_hand - end_on_hand) / max(start_on_hand, 1.0)) * 100
            rows.append(
                {
                    "sku_id": sku_id,
                    "start_on_hand": int(start_on_hand),
                    "end_on_hand": int(end_on_hand),
                    "drop_pct": round(drop_pct, 2),
                }
            )

        ranked = pd.DataFrame(rows).sort_values("drop_pct", ascending=False).head(limit)
        return ranked.to_dict("records")

    def _supplier_delay_anomalies(self, days: int = 30, limit: int = 5) -> list[dict[str, Any]]:
        df = self.purchase_orders[self.purchase_orders["po_date"] >= self._window_start(days)].copy()
        if df.empty:
            return []

        df["late_days"] = (df["actual_days"] - df["expected_days"]).clip(lower=0)
        grouped = (
            df.groupby("supplier_id")
            .agg(
                late_rate=("status", lambda s: (s == "LATE").mean()),
                avg_late_days=("late_days", "mean"),
                po_count=("po_id", "count"),
            )
            .reset_index()
        )
        grouped["risk_score"] = grouped["late_rate"] * grouped["avg_late_days"] * np.log1p(grouped["po_count"])
        top = grouped.sort_values("risk_score", ascending=False).head(limit)
        top["late_rate"] = top["late_rate"].round(3)
        top["avg_late_days"] = top["avg_late_days"].round(2)
        top["risk_score"] = top["risk_score"].round(3)
        return top.to_dict("records")

    def orders_for_supplier(self, supplier_id: str, limit: int = 10) -> list[dict[str, Any]]:
        rows = self.purchase_orders[self.purchase_orders["supplier_id"] == supplier_id].head(limit)
        return rows[
            [
                "po_id",
                "supplier_id",
                "po_date",
                "expected_delivery_date",
                "actual_delivery_date",
                "expected_days",
                "actual_days",
                "status",
            ]
        ].to_dict("records")

    def sku_history(self, sku_id: str, days: int = 60) -> pd.DataFrame:
        rows = self.inventory_history[self.inventory_history["sku_id"] == sku_id].copy()
        if rows.empty:
            return rows
        rows = rows.sort_values("date").tail(days)
        return rows[["date", "sku_id", "demand_qty", "on_hand"]]

    def order_row(self, order_id: str) -> pd.Series | None:
        rows = self.orders[self.orders["order_id"] == order_id]
        if rows.empty:
            return None
        return rows.iloc[0]

    def inventory_row(self, sku_id: str) -> pd.Series | None:
        rows = self.inventory[self.inventory["sku_id"] == sku_id]
        if rows.empty:
            return None
        return rows.iloc[0]
