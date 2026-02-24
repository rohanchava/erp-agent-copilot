from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

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

    def supplier_delay_summary(self, limit: int = 5) -> list[dict[str, Any]]:
        df = self.purchase_orders.copy()
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

    def orders_for_supplier(self, supplier_id: str, limit: int = 10) -> list[dict[str, Any]]:
        rows = self.purchase_orders[self.purchase_orders["supplier_id"] == supplier_id].head(limit)
        return rows[["po_id", "supplier_id", "expected_days", "actual_days", "status"]].to_dict("records")

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
