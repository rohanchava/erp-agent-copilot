# Session Summary

Last updated: 2026-02-24
Repo: `rohanchava/erp-agent-copilot`
Branch: `main`
Recent commit: `f5ef199`

## What We Built

### Platform and UX
- Converted the app into a multi-page experience with navigation:
  - `/` Overview
  - `/trends` Trends + What-If Simulator
  - `/anomalies` Operational anomalies dashboard
  - `/copilot` AI copilot chat
- Added an app shell with responsive sidebar/top navigation.
- Improved visual style with a stronger background system and cleaner card hierarchy.

### Data and Analytics
- Upgraded synthetic dataset generation with date-aware records for:
  - `orders`
  - `shipments`
  - `purchase_orders`
  - `inventory_history`
- Added time-window analytics in backend store layer:
  - stock performance by SKU over custom windows
  - supplier performance by custom windows
  - anomaly summaries (demand spikes, stock drops, supplier delivery risk)
  - overview timeline metrics
  - top stock movers (gainers/decliners)

### ML and Forecasting
- Existing ML:
  - stockout risk model (logistic regression)
  - delay risk model (logistic regression)
  - demand trend forecasting (linear regression with periodic features)
- Added simulation capability:
  - what-if stock scenario using multipliers for demand, lead time, and replenishment
  - baseline vs scenario comparison
  - projected runout and delta vs baseline

### Frontend Interactivity
- Overview page now includes:
  - time-window toggles (7D/30D/90D)
  - sparkline trends for orders, delayed shipments, fill rate
  - top gainers/decliners panels
- Trends page now includes:
  - SKU selector
  - history/forecast horizon controls
  - scenario controls via sliders
  - baseline vs scenario overlay lines
  - runout/safety stock summary cards

## Important Files

### Backend
- `backend/main.py`
- `backend/services/store.py`
- `backend/services/ml.py`
- `backend/services/agent.py`

### Frontend
- `frontend/src/app/layout.tsx`
- `frontend/src/app/page.tsx`
- `frontend/src/app/trends/page.tsx`
- `frontend/src/app/anomalies/page.tsx`
- `frontend/src/app/copilot/page.tsx`
- `frontend/src/components/AppShell.tsx`
- `frontend/src/components/OverviewInsights.tsx`
- `frontend/src/components/TrendPanel.tsx`
- `frontend/src/components/AnomalyPanel.tsx`
- `frontend/src/components/CopilotPanel.tsx`
- `frontend/src/lib/api.ts`

### Data
- `data/generate_data.py`
- `data/generated/*.csv`

## Current API Surface

### Core
- `GET /health`
- `GET /kpis`
- `GET /skus`

### Trends + Simulation
- `GET /trends/stock/{sku_id}`
- `POST /simulate/stock`

### Analytics
- `GET /analytics/overview-timeline`
- `GET /analytics/top-movers`
- `GET /analytics/anomalies`
- `GET /analytics/warehouses`
- `GET /analytics/suppliers`
- `GET /analytics/suppliers/{supplier_id}`
- `GET /analytics/stock-performance/{sku_id}`

### Predictions + Agent
- `POST /predict/stockout`
- `POST /predict/delay`
- `POST /agent/chat`

## Run Commands

### Regenerate data
```bash
cd /Users/rohanchava/erp-agent-copilot/data
../backend/.venv/bin/python generate_data.py
```

### Start backend
```bash
cd /Users/rohanchava/erp-agent-copilot/backend
source .venv/bin/activate
uvicorn main:app --reload --port 8000
```

### Start frontend
```bash
cd /Users/rohanchava/erp-agent-copilot/frontend
npm run dev
```

## Suggested Next Steps
1. Add reorder recommendation engine (suggest order date/quantity with confidence).
2. Add model evaluation page (MAPE, ROC-AUC, drift trend).
3. Replace rule-based agent intent routing with tool-calling LLM.
4. Add role-based views (planner, warehouse manager, procurement).
5. Add database layer (Postgres/Supabase) and move beyond CSV runtime storage.

## Resume Prompt Template
Use this at the start of a new session:

"Open `/Users/rohanchava/erp-agent-copilot` at commit `f5ef199` and continue with: <next feature>. Read `docs/session-summary.md` first."
