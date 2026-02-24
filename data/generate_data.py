from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

OUT_DIR = Path(__file__).resolve().parent / "generated"
RNG = np.random.default_rng(7)
WAREHOUSES = ["WH-EAST", "WH-WEST", "WH-CENTRAL", "WH-SOUTH"]
SUPPLIERS = [f"SUP-{i}" for i in range(1, 11)]


def random_dates(n: int, lookback_days: int = 180) -> pd.Series:
    end = pd.Timestamp.today().normalize()
    offsets = RNG.integers(0, lookback_days, size=n)
    return pd.Series(end - pd.to_timedelta(offsets, unit="D"))


def simulate_inventory_history(n_skus: int = 60, days: int = 120) -> tuple[pd.DataFrame, pd.DataFrame]:
    sku_ids = [f"SKU-{1000 + i}" for i in range(n_skus)]
    dates = pd.date_range(end=pd.Timestamp.today().normalize(), periods=days, freq="D")

    history_rows: list[dict[str, object]] = []
    snapshot_rows: list[dict[str, object]] = []

    for i, sku_id in enumerate(sku_ids):
        base_demand = int(RNG.integers(8, 65))
        lead_time_days = int(RNG.integers(3, 21))
        on_hand = float(RNG.integers(350, 1700))

        demand_series: list[float] = []
        on_hand_series: list[float] = []

        for d_idx, date in enumerate(dates):
            seasonality = 1.0 + 0.15 * np.sin(2 * np.pi * (d_idx % 7) / 7)
            noise = RNG.normal(0, 0.08)
            demand = max(base_demand * (seasonality + noise), 1.0)
            receipt_signal = RNG.uniform(0, 1)
            receipts = base_demand * RNG.uniform(2.2, 3.8) if receipt_signal > 0.9 else 0.0

            on_hand = max(on_hand + receipts - demand, 0.0)

            demand_series.append(demand)
            on_hand_series.append(on_hand)
            history_rows.append(
                {
                    "date": date.strftime("%Y-%m-%d"),
                    "sku_id": sku_id,
                    "demand_qty": round(demand, 2),
                    "on_hand": int(round(on_hand)),
                }
            )

        daily_demand = float(np.mean(demand_series[-14:]))
        days_of_cover = max(on_hand_series[-1] / max(daily_demand, 1.0), 1.0)
        snapshot_rows.append(
            {
                "sku_id": sku_id,
                "sku_name": f"Item {i}",
                "on_hand": int(round(on_hand_series[-1])),
                "daily_demand": round(daily_demand, 2),
                "lead_time_days": lead_time_days,
                "days_of_cover": round(days_of_cover, 1),
            }
        )

    inventory = pd.DataFrame(snapshot_rows)
    inventory_history = pd.DataFrame(history_rows)
    return inventory, inventory_history


def make_warehouse_inventory(inventory: pd.DataFrame) -> pd.DataFrame:
    rows: list[dict[str, object]] = []
    for _, row in inventory.iterrows():
        weights = RNG.dirichlet(alpha=[1.5, 1.1, 1.2, 0.9])
        splits = np.floor(weights * row["on_hand"]).astype(int)
        for wh, qty in zip(WAREHOUSES, splits):
            days_cover = qty / max(row["daily_demand"], 1)
            rows.append(
                {
                    "warehouse_id": wh,
                    "sku_id": row["sku_id"],
                    "on_hand": int(qty),
                    "days_of_cover": round(days_cover, 1),
                }
            )
    return pd.DataFrame(rows)


def make_orders(inventory: pd.DataFrame, n: int = 700) -> pd.DataFrame:
    sku_choices = inventory["sku_id"].to_numpy()
    order_qty = RNG.integers(8, 360, size=n)
    fulfilled_ratio = RNG.uniform(0.5, 1.0, size=n)
    fulfilled_qty = np.floor(order_qty * fulfilled_ratio).astype(int)
    supplier_risk = RNG.uniform(0.05, 0.95, size=n).round(3)
    distance_km = RNG.integers(80, 5000, size=n)

    delay_signal = 0.5 * supplier_risk + 0.35 * (distance_km / 5000) + 0.15 * (1 - fulfilled_ratio)
    is_delayed = (delay_signal > 0.58).astype(int)
    order_dates = random_dates(n=n, lookback_days=150)

    return pd.DataFrame(
        {
            "order_id": [f"ORD-{1000 + i}" for i in range(n)],
            "order_date": order_dates.dt.strftime("%Y-%m-%d"),
            "sku_id": RNG.choice(sku_choices, size=n),
            "warehouse_id": RNG.choice(WAREHOUSES, size=n),
            "supplier_id": RNG.choice(SUPPLIERS, size=n),
            "order_qty": order_qty,
            "fulfilled_qty": fulfilled_qty,
            "supplier_risk": supplier_risk,
            "distance_km": distance_km,
            "is_delayed": is_delayed,
            "status": np.where(fulfilled_qty >= order_qty, "CLOSED", "OPEN"),
        }
    )


def make_shipments(n: int = 350) -> pd.DataFrame:
    planned = RNG.integers(2, 20, size=n)
    slippage = RNG.integers(-1, 10, size=n)
    actual = np.maximum(planned + slippage, 1)
    shipment_dates = random_dates(n=n, lookback_days=150)
    return pd.DataFrame(
        {
            "shipment_id": [f"SHP-{9000 + i}" for i in range(n)],
            "shipment_date": shipment_dates.dt.strftime("%Y-%m-%d"),
            "planned_delivery_days": planned,
            "actual_delivery_days": actual,
            "carrier": RNG.choice(["DHL", "FedEx", "UPS", "Maersk"], size=n),
            "warehouse_id": RNG.choice(WAREHOUSES, size=n),
        }
    )


def make_purchase_orders(n: int = 260) -> pd.DataFrame:
    expected = RNG.integers(5, 35, size=n)
    actual = np.maximum(expected + RNG.integers(-2, 12, size=n), 1)
    po_dates = random_dates(n=n, lookback_days=180)
    expected_delivery = po_dates + pd.to_timedelta(expected, unit="D")
    actual_delivery = po_dates + pd.to_timedelta(actual, unit="D")

    return pd.DataFrame(
        {
            "po_id": [f"PO-{5000 + i}" for i in range(n)],
            "po_date": po_dates.dt.strftime("%Y-%m-%d"),
            "expected_delivery_date": expected_delivery.dt.strftime("%Y-%m-%d"),
            "actual_delivery_date": actual_delivery.dt.strftime("%Y-%m-%d"),
            "supplier_id": RNG.choice(SUPPLIERS, size=n),
            "expected_days": expected,
            "actual_days": actual,
            "status": np.where(actual > expected, "LATE", "ON_TIME"),
        }
    )


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    inventory, inventory_history = simulate_inventory_history()
    warehouse_inventory = make_warehouse_inventory(inventory)
    orders = make_orders(inventory)
    shipments = make_shipments()
    purchase_orders = make_purchase_orders()

    inventory.to_csv(OUT_DIR / "inventory.csv", index=False)
    inventory_history.to_csv(OUT_DIR / "inventory_history.csv", index=False)
    warehouse_inventory.to_csv(OUT_DIR / "warehouse_inventory.csv", index=False)
    orders.to_csv(OUT_DIR / "orders.csv", index=False)
    shipments.to_csv(OUT_DIR / "shipments.csv", index=False)
    purchase_orders.to_csv(OUT_DIR / "purchase_orders.csv", index=False)

    print(f"Wrote synthetic ERP dataset to {OUT_DIR}")


if __name__ == "__main__":
    main()
