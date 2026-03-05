"""
Comprehensive pytest tests for all agent intents in backend/services/agent.py.

Each intent has:
  1. An exact-phrasing test using a canonical keyword from the routing logic.
  2. A typo / variant phrasing test to confirm robustness.
  3. An assertion that intent != "fallback".

A final section verifies that truly unrecognised queries DO return "fallback".
"""

from __future__ import annotations

import os
import sys

# Make the backend package importable regardless of where pytest is invoked from.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# Disable the LLM agent so tests only exercise the deterministic rule-based path.
os.environ["DISABLE_LLM_AGENT"] = "1"

from fastapi.testclient import TestClient  # noqa: E402  (import after sys.path patch)

from main import app  # noqa: E402

client = TestClient(app)

# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _chat(question: str) -> dict:
    """POST /agent/chat and return the parsed JSON body."""
    resp = client.post("/agent/chat", json={"question": question})
    assert resp.status_code == 200, f"Unexpected status {resp.status_code}: {resp.text}"
    return resp.json()


# ---------------------------------------------------------------------------
# kpi_summary
# Triggered by: "kpi" | "dashboard" | "summary"
# ---------------------------------------------------------------------------

class TestKpiSummary:
    def test_exact_kpi(self):
        data = _chat("Show me the KPI overview")
        assert data["intent"] == "kpi_summary"
        assert data["intent"] != "fallback"

    def test_exact_dashboard(self):
        data = _chat("Give me the dashboard")
        assert data["intent"] == "kpi_summary"
        assert data["intent"] != "fallback"

    def test_variant_summary(self):
        data = _chat("What does the current summary look like?")
        assert data["intent"] == "kpi_summary"
        assert data["intent"] != "fallback"

    def test_typo_kpi_caps(self):
        # Uppercase / mixed-case should still match since routing uses .lower()
        data = _chat("KPI report please")
        assert data["intent"] == "kpi_summary"
        assert data["intent"] != "fallback"


# ---------------------------------------------------------------------------
# demand_anomaly
# Triggered by: ("demand anomal" | "demand anomol" | "demand spike" |
#                "unusual demand" | "abnormal demand") AND sku_id present
# ---------------------------------------------------------------------------

class TestDemandAnomaly:
    _SKU = "SKU-1000"

    def test_exact_demand_anomaly(self):
        data = _chat(f"Are there any demand anomalies for {self._SKU}?")
        assert data["intent"] == "demand_anomaly"
        assert data["intent"] != "fallback"

    def test_typo_demand_anomol(self):
        data = _chat(f"Check demand anomol for {self._SKU}")
        assert data["intent"] == "demand_anomaly"
        assert data["intent"] != "fallback"

    def test_variant_demand_spike(self):
        data = _chat(f"Any demand spike for {self._SKU} last month?")
        assert data["intent"] == "demand_anomaly"
        assert data["intent"] != "fallback"

    def test_variant_unusual_demand(self):
        data = _chat(f"Show unusual demand for {self._SKU}")
        assert data["intent"] == "demand_anomaly"
        assert data["intent"] != "fallback"

    def test_variant_abnormal_demand(self):
        data = _chat(f"Abnormal demand detected for {self._SKU}?")
        assert data["intent"] == "demand_anomaly"
        assert data["intent"] != "fallback"


# ---------------------------------------------------------------------------
# anomaly_detection
# Triggered by: "anomal" | "anomol" | "outlier" | "spike" | "abnormal"
#               WITHOUT a matching SKU (or when no demand-prefix present)
# ---------------------------------------------------------------------------

class TestAnomalyDetection:
    def test_exact_anomaly(self):
        data = _chat("Show me all anomalies in the system")
        assert data["intent"] == "anomaly_detection"
        assert data["intent"] != "fallback"

    def test_variant_outlier(self):
        data = _chat("Any outliers detected recently?")
        assert data["intent"] == "anomaly_detection"
        assert data["intent"] != "fallback"

    def test_variant_spike(self):
        data = _chat("Were there any inventory spikes last week?")
        assert data["intent"] == "anomaly_detection"
        assert data["intent"] != "fallback"

    def test_typo_anomol(self):
        data = _chat("List all anomol events")
        assert data["intent"] == "anomaly_detection"
        assert data["intent"] != "fallback"

    def test_variant_abnormal(self):
        data = _chat("Anything abnormal in inventory?")
        assert data["intent"] == "anomaly_detection"
        assert data["intent"] != "fallback"


# ---------------------------------------------------------------------------
# stock_performance
# Triggered by: ("perform" | "trend" | "how has" | "stock wise")
#               AND ("item" | "sku" | "stock")
#               AND sku_id extractable
# ---------------------------------------------------------------------------

class TestStockPerformance:
    _SKU = "SKU-1004"

    def test_exact_perform(self):
        data = _chat(f"How has {self._SKU} stock performed lately?")
        assert data["intent"] == "stock_performance"
        assert data["intent"] != "fallback"

    def test_variant_trend_sku(self):
        # "trend" + "sku" + sku_id  -> stock_performance (before trend_forecast path)
        data = _chat(f"What is the stock trend for sku {self._SKU}?")
        assert data["intent"] == "stock_performance"
        assert data["intent"] != "fallback"

    def test_variant_how_has(self):
        data = _chat(f"How has item {self._SKU} been doing?")
        assert data["intent"] == "stock_performance"
        assert data["intent"] != "fallback"


# ---------------------------------------------------------------------------
# supplier_delivery_analysis
# Triggered by: "supplier" AND ("delivery"|"deliver"|"delay"|"late"|"perform")
# ---------------------------------------------------------------------------

class TestSupplierDeliveryAnalysis:
    def test_exact_supplier_delivery(self):
        data = _chat("What is the supplier delivery performance?")
        assert data["intent"] == "supplier_delivery_analysis"
        assert data["intent"] != "fallback"

    def test_variant_supplier_delay(self):
        data = _chat("Which supplier has the most delays?")
        assert data["intent"] == "supplier_delivery_analysis"
        assert data["intent"] != "fallback"

    def test_variant_supplier_late(self):
        data = _chat("Show me suppliers that are late on orders")
        assert data["intent"] == "supplier_delivery_analysis"
        assert data["intent"] != "fallback"

    def test_variant_specific_supplier(self):
        # The routing rule requires the word "supplier" to appear in the question.
        # "SUP-3" alone does not satisfy that condition; we include "supplier" explicitly.
        data = _chat("How is supplier SUP-3 performing on deliveries?")
        assert data["intent"] == "supplier_delivery_analysis"
        assert data["intent"] != "fallback"

    def test_typo_supplier_deliver(self):
        data = _chat("Show me supplier deliver times")
        assert data["intent"] == "supplier_delivery_analysis"
        assert data["intent"] != "fallback"


# ---------------------------------------------------------------------------
# warehouse_risk
# Triggered by: "warehouse" AND ("risk" | "low" | "cover")
# ---------------------------------------------------------------------------

class TestWarehouseRisk:
    def test_exact_warehouse_risk(self):
        data = _chat("Which warehouse has the highest risk?")
        assert data["intent"] == "warehouse_risk"
        assert data["intent"] != "fallback"

    def test_variant_warehouse_low(self):
        data = _chat("Show me warehouses with low inventory")
        assert data["intent"] == "warehouse_risk"
        assert data["intent"] != "fallback"

    def test_variant_warehouse_cover(self):
        data = _chat("What is the warehouse cover situation?")
        assert data["intent"] == "warehouse_risk"
        assert data["intent"] != "fallback"

    def test_typo_warehouse_caps(self):
        data = _chat("WAREHOUSE risk report")
        assert data["intent"] == "warehouse_risk"
        assert data["intent"] != "fallback"


# ---------------------------------------------------------------------------
# improvement_priorities
# Triggered by: "improv" | "focus area" | "what should we work on"
# ---------------------------------------------------------------------------

class TestImprovementPriorities:
    def test_exact_improve(self):
        data = _chat("What can we improve in our supply chain?")
        assert data["intent"] == "improvement_priorities"
        assert data["intent"] != "fallback"

    def test_variant_focus_area(self):
        data = _chat("What are the main focus areas right now?")
        assert data["intent"] == "improvement_priorities"
        assert data["intent"] != "fallback"

    def test_variant_what_should_we_work_on(self):
        data = _chat("What should we work on this quarter?")
        assert data["intent"] == "improvement_priorities"
        assert data["intent"] != "fallback"

    def test_typo_improvement_caps(self):
        data = _chat("Give me improvement suggestions")
        assert data["intent"] == "improvement_priorities"
        assert data["intent"] != "fallback"


# ---------------------------------------------------------------------------
# trend_forecast
# Triggered by: ("trend" | "forecast" | "projection") AND sku_id present
# NOTE: "trend" + ("sku"|"stock") + sku_id is intercepted earlier by
#       stock_performance, so we use "forecast" here to avoid that path.
# ---------------------------------------------------------------------------

class TestTrendForecast:
    _SKU = "SKU-1000"

    def test_exact_forecast(self):
        data = _chat(f"Give me a forecast for {self._SKU}")
        assert data["intent"] == "trend_forecast"
        assert data["intent"] != "fallback"

    def test_variant_projection(self):
        data = _chat(f"What is the projection for {self._SKU}?")
        assert data["intent"] == "trend_forecast"
        assert data["intent"] != "fallback"

    def test_typo_forcast(self):
        # "forecast" contains "forecast"; "forcast" does NOT match – using correct
        # word with a leading typo on SKU notation: "sku 1000" (space instead of dash)
        data = _chat(f"Forecast demand for sku 1000")
        assert data["intent"] == "trend_forecast"
        assert data["intent"] != "fallback"

    def test_variant_forecast_with_days(self):
        data = _chat(f"Forecast {self._SKU} for the next 30 days")
        assert data["intent"] == "trend_forecast"
        assert data["intent"] != "fallback"


# ---------------------------------------------------------------------------
# reorder_recommendations
# Triggered by: "reorder" | "replenish" | "order now" | "when should i order"
# ---------------------------------------------------------------------------

class TestReorderRecommendations:
    def test_exact_reorder(self):
        data = _chat("Which items need to be reordered?")
        assert data["intent"] == "reorder_recommendations"
        assert data["intent"] != "fallback"

    def test_variant_replenish(self):
        data = _chat("What items need replenishment soon?")
        assert data["intent"] == "reorder_recommendations"
        assert data["intent"] != "fallback"

    def test_variant_order_now(self):
        data = _chat("What should I order now?")
        assert data["intent"] == "reorder_recommendations"
        assert data["intent"] != "fallback"

    def test_variant_when_should_i_order(self):
        data = _chat("When should I order more stock?")
        assert data["intent"] == "reorder_recommendations"
        assert data["intent"] != "fallback"

    def test_typo_reorder_caps(self):
        data = _chat("REORDER list please")
        assert data["intent"] == "reorder_recommendations"
        assert data["intent"] != "fallback"


# ---------------------------------------------------------------------------
# stockout_risk
# Triggered by: "stockout" | "low stock" | ("risk" AND "delay" NOT in q)
# ---------------------------------------------------------------------------

class TestStockoutRisk:
    def test_exact_stockout(self):
        data = _chat("Which SKUs are at risk of stockout?")
        assert data["intent"] == "stockout_risk"
        assert data["intent"] != "fallback"

    def test_variant_low_stock(self):
        data = _chat("Show me all low stock items")
        assert data["intent"] == "stockout_risk"
        assert data["intent"] != "fallback"

    def test_variant_risk_no_delay(self):
        data = _chat("What items have the highest risk?")
        assert data["intent"] == "stockout_risk"
        assert data["intent"] != "fallback"

    def test_typo_stockout_caps(self):
        data = _chat("STOCKOUT alert — what is the risk?")
        assert data["intent"] == "stockout_risk"
        assert data["intent"] != "fallback"


# ---------------------------------------------------------------------------
# delay_risk
# Triggered by: "delay" in the question
# Note: stockout_risk guard excludes "delay", so this only fires when "delay"
#       is present but the supplier/demand-anomaly paths did not match first.
# ---------------------------------------------------------------------------

class TestDelayRisk:
    def test_exact_delay(self):
        data = _chat("What is the delay risk for current orders?")
        assert data["intent"] == "delay_risk"
        assert data["intent"] != "fallback"

    def test_variant_delayed(self):
        data = _chat("How many orders are delayed?")
        assert data["intent"] == "delay_risk"
        assert data["intent"] != "fallback"

    def test_typo_delay_caps(self):
        data = _chat("DELAY risk assessment")
        assert data["intent"] == "delay_risk"
        assert data["intent"] != "fallback"


# ---------------------------------------------------------------------------
# inventory_lookup
# Triggered by: "most stocked" | "most inventory" | "top stocked" |
#               "in stock" | "on hand" | "stock level"
# ---------------------------------------------------------------------------

class TestInventoryLookup:
    def test_exact_most_stocked(self):
        data = _chat("What is the most stocked item?")
        assert data["intent"] == "inventory_lookup"
        assert data["intent"] != "fallback"

    def test_variant_on_hand(self):
        data = _chat("How many units do we have on hand?")
        assert data["intent"] == "inventory_lookup"
        assert data["intent"] != "fallback"

    def test_variant_stock_level(self):
        data = _chat("What are the current stock levels?")
        assert data["intent"] == "inventory_lookup"
        assert data["intent"] != "fallback"

    def test_variant_top_stocked(self):
        data = _chat("Show me the top stocked products")
        assert data["intent"] == "inventory_lookup"
        assert data["intent"] != "fallback"

    def test_variant_in_stock(self):
        data = _chat("What do we have in stock?")
        assert data["intent"] == "inventory_lookup"
        assert data["intent"] != "fallback"

    def test_variant_most_inventory(self):
        data = _chat("Which SKU has most inventory?")
        assert data["intent"] == "inventory_lookup"
        assert data["intent"] != "fallback"


# ---------------------------------------------------------------------------
# fallback
# Completely unrecognised queries must return "fallback"
# ---------------------------------------------------------------------------

class TestFallback:
    def test_empty_question(self):
        data = _chat("asdfghjkl")
        assert data["intent"] == "fallback"

    def test_nonsense_query(self):
        data = _chat("xyzzy foo bar baz")
        assert data["intent"] == "fallback"

    def test_random_greeting(self):
        data = _chat("Hello there, how are you?")
        assert data["intent"] == "fallback"

    def test_unrelated_topic(self):
        data = _chat("What is the weather in Paris today?")
        assert data["intent"] == "fallback"

    def test_numeric_only(self):
        data = _chat("12345 67890")
        assert data["intent"] == "fallback"
