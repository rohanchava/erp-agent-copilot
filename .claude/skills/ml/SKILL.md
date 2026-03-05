---
name: ml
description: Add or enhance ML models, predictive analytics, AI features, and agent capabilities in the erp-agent-copilot backend.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# ERP Copilot — ML & AI Conventions

## Stack
- scikit-learn 1.6 (LogisticRegression, LinearRegression)
- Pandas / NumPy for feature engineering
- OpenAI SDK (optional LLM agent, gpt-4o-mini by default)
- All models trained at startup in `MLPredictor.__init__()`

## File Locations
| Thing | Path |
|---|---|
| ML models + forecasting | `backend/services/ml.py` — `MLPredictor` class |
| Rule-based agent | `backend/services/agent.py` |
| LLM tool-calling agent | `backend/services/llm_agent.py` |
| Data access (features) | `backend/services/store.py` — `ERPStore` |
| Routes | `backend/main.py` |

---

## Existing Models

### 1. Stockout Risk (LogisticRegression)
- **Target**: `days_of_cover < 8`
- **Features**: `on_hand`, `daily_demand`, `lead_time_days`, `days_of_cover`
- **Output**: `stockout_risk` score (0-1), `risk_band` (LOW/MEDIUM/HIGH), `projected_on_hand`, `projected_days_of_cover`, `drivers`
- **Endpoint**: `POST /predict/stockout`

### 2. Delay Risk (LogisticRegression)
- **Target**: `is_delayed == 1`
- **Features**: `order_qty`, `fulfilled_qty`, `supplier_risk`, `distance_km`
- **Output**: `delay_risk` score, `risk_band`, `drivers`
- **Endpoint**: `POST /predict/delay`

### 3. Demand Forecasting (LinearRegression, per-SKU)
- **Features**: time index + 4 periodic sine/cosine features (weekly + monthly cycles)
- **Output**: projected `on_hand` and `predicted_demand` per day
- **Used by**: `GET /trends/stock/{sku_id}` and `POST /simulate/stock`

### 4. ROP Reorder Engine (rule-based formula)
- `safety_stock = 1.65 × demand_std × sqrt(lead_time)`
- `rop = (daily_demand × lead_time) + safety_stock`
- `reorder_qty = EOQ approximation`
- **Endpoint**: `GET /recommendations/reorder`

---

## Pattern: Adding a New ML Model

```python
# In MLPredictor.__init__():
self._train_my_model()

def _train_my_model(self):
    df = self.store.inventory.copy()
    # Feature engineering
    X = df[["feature_1", "feature_2"]].fillna(0)
    y = (df["target_col"] < threshold).astype(int)
    self.my_model = LogisticRegression(max_iter=500)
    self.my_model.fit(X, y)

def my_prediction(self, sku_id: str) -> dict[str, Any]:
    row = self.store.inventory_row(sku_id)
    if row is None:
        return {"error": f"Unknown sku_id: {sku_id}"}
    X = pd.DataFrame([{
        "feature_1": row["feature_1"],
        "feature_2": row["feature_2"],
    }])
    prob = float(self.my_model.predict_proba(X)[0][1])
    return {
        "sku_id": sku_id,
        "score": round(prob, 4),
        "risk_band": "HIGH" if prob > 0.7 else "MEDIUM" if prob > 0.4 else "LOW",
    }
```

Then in `main.py`:
```python
class MyRequest(BaseModel):
    sku_id: str

@app.post("/predict/my-model")
def predict_my_model(payload: MyRequest) -> dict[str, Any]:
    return ml.my_prediction(payload.sku_id.upper())
```

---

## Pattern: Adding an LLM Tool

Add to the `TOOLS` list in `llm_agent.py`:
```python
{
    "type": "function",
    "function": {
        "name": "my_tool",
        "description": "What it does and when the agent should call it",
        "parameters": {
            "type": "object",
            "properties": {
                "sku_id": {"type": "string", "description": "SKU identifier"},
            },
            "required": ["sku_id"],
        },
    },
}
```

Then add a case to `call_tool()`:
```python
elif name == "my_tool":
    result = ml.my_prediction(args.get("sku_id", ""))
```

---

## Pattern: Adding a Rule-Based Intent

Add to the waterfall in `_rule_based_answer()` in `agent.py`:
```python
elif any(w in q for w in ["keyword1", "keyword2"]) and sku:
    intent = "my_intent"
    data = ml.my_prediction(sku)
    answer = f"Prediction for {sku}: {data['risk_band']} risk (score: {data['score']})"
    traces = [{"tool": "my_tool", "input": {"sku_id": sku}, "output": data}]
```

---

## AI Feature Ideas (Prioritised)

### High Impact — Ready to Build Now
1. **Demand Anomaly Alerts per SKU** — Z-score on recent demand vs historical baseline; flag SKUs with unusual spikes; surface in SKU detail page
2. **Lead Time Forecasting** — Train regression on `purchase_orders` to predict `actual_lead_time` from `supplier_id + order_qty + distance_km`; improve ROP accuracy
3. **Supplier Risk Score** — Combine `late_rate`, `avg_late_days`, `po_count` into a single composite score per supplier; show trend over time
4. **Replenishment Recommendation Confidence** — Use demand std + stockout probability together to produce a tighter confidence band on reorder qty

### Medium — Needs Feature Engineering
5. **Seasonal Demand Detection** — Classify SKUs as seasonal vs stable using autocorrelation of `inventory_history`; adjust safety stock multiplier
6. **Multi-SKU Correlation** — Identify SKUs that tend to spike together (shared supplier or category); surface as "co-risk" in anomaly panel
7. **Fill Rate Prediction** — Predict `fill_rate` for an order given supplier risk + current stock; add to copilot tool suite

### Ambitious — Worth Planning
8. **Natural Language SKU Search** — Embed SKU names + demand patterns; allow copilot to answer "find me a SKU similar to SKU-1008"
9. **Automated What-If Narratives** — After `simulate/stock`, call LLM to generate a plain-English risk summary with specific recommendations
10. **Proactive Alerts Feed** — Background job that scores all SKUs nightly and surfaces top-N risks on the Overview page without manual querying

---

## Data Available for Training
| Table | Key Fields | Useful For |
|---|---|---|
| `inventory` | `on_hand`, `daily_demand`, `lead_time_days`, `days_of_cover` | Stockout, reorder models |
| `inventory_history` | `date`, `sku_id`, `on_hand`, `demand_qty` | Demand forecasting, seasonality |
| `purchase_orders` | `supplier_id`, `order_date`, `expected_delivery`, `actual_delivery`, `order_qty` | Lead time forecasting, supplier risk |
| `shipments` | `is_delayed`, `delay_days`, `distance_km` | Delay risk model |
| `orders` | `order_qty`, `fulfilled_qty`, `fill_rate` | Fill rate prediction |
| `warehouse_inventory` | `warehouse_id`, `sku_id`, `on_hand`, `days_of_cover` | Warehouse-level risk |
