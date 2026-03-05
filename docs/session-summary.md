# Session Summary

Last updated: 2026-03-04
Repo: `rohanchava/erp-agent-copilot`
Branch: `main`
Recent commit: `0fa02fb`

## What We Built

### SKU Detail Page (2026-03-04)
- Added per-SKU drill-down page at `/skus/[sku_id]` navigable from the Reorders table.
- New backend endpoint `GET /skus/{sku_id}/profile` — single round-trip combining inventory row, 30-day stock performance, and reorder recommendation. Returns 404 for unknown SKUs.
- New `SkuProfile` type and `fetchSkuProfile()` in `api.ts`.
- `SkuDetailPanel` client component with:
  - Header: ← Back, monospace SKU ID, SKU name, reorder status badge
  - 6 KPI cards: On Hand, Daily Demand, Lead Time, Days of Cover, Safety Stock, ROP
  - Stock trend chart with History (30/60/90/120) and Forecast (14/21/30) window pills, on-hand projection + demand trajectory SVG charts
  - Scenario simulation panel: demand/lead-time/replenishment sliders, Run What-If, delta summary card
  - Stockout Risk card: risk band badge, probability %, projected on-hand, projected days of cover, driver chips
  - Reorder Signal card: status + confidence badges, reorder qty, suggested order date, urgency bar
  - `animate-pulse` loading skeleton while data fetches
- SKU IDs in Reorders table are now clickable `<Link>` elements navigating to `/skus/[sku_id]`.
- Added `http://localhost:3001` to backend CORS `allow_origins` for dev flexibility.

### Platform and UX
- Converted app into a multi-page experience with navigation:
  - `/` Overview
  - `/trends` Trends + What-If Simulator
  - `/anomalies` Operational anomalies dashboard
  - `/copilot` AI copilot chat
- Added app shell with responsive sidebar/top navigation.
- Improved visual style with stronger background system and cleaner card hierarchy.

### Homepage Improvements
- Added interactive **Operational Pulse** section with:
  - time-window toggles (7D/30D/90D)
  - sparkline trends for orders, delayed shipments, fill rate
  - top stock gainers and decliners
- New backend endpoints for homepage analytics:
  - `GET /analytics/overview-timeline`
  - `GET /analytics/top-movers`

### Data and Analytics
- Upgraded synthetic dataset generation with date-aware records for:
  - `orders`
  - `shipments`
  - `purchase_orders`
  - `inventory_history`
- Added time-window analytics in store layer:
  - stock performance by SKU over custom windows
  - supplier performance over custom windows
  - anomaly summaries (demand spikes, stock drops, supplier delivery risk)
  - overview timeline metrics
  - top movers (gainers/decliners)

### ML and Forecasting
- Existing ML:
  - stockout risk model (logistic regression)
  - delay risk model (logistic regression)
  - demand trend forecasting (linear regression with periodic features)
- Added simulation capability:
  - what-if stock scenario using demand, lead-time, and replenishment multipliers
  - baseline vs scenario comparison
  - projected runout, min forecast on-hand, safety stock estimate

### Trend Experience Upgrades
- Added controls for:
  - history window (30/60/90/120)
  - forecast window (14/21/30)
  - scenario sliders for demand/lead-time/replenishment multipliers
- Added baseline vs scenario overlay line in forecast chart.

### Agent Upgrades
- Added strategic prompt handling for improvement-priority questions.
- Added optional **LLM tool-calling agent** with safe fallback:
  - Uses OpenAI tool calls when `OPENAI_API_KEY` is set
  - Falls back to rule-based routing when key is missing or call fails
  - `DISABLE_LLM_AGENT=1` forces rule-based mode

## Important Files

### Backend
- `backend/main.py`
- `backend/requirements.txt`
- `backend/services/store.py`
- `backend/services/ml.py`
- `backend/services/agent.py`
- `backend/services/llm_agent.py`

### Frontend
- `frontend/src/app/layout.tsx`
- `frontend/src/app/page.tsx`
- `frontend/src/app/trends/page.tsx`
- `frontend/src/app/anomalies/page.tsx`
- `frontend/src/app/copilot/page.tsx`
- `frontend/src/app/skus/[sku_id]/page.tsx` *(new)*
- `frontend/src/components/AppShell.tsx`
- `frontend/src/components/OverviewInsights.tsx`
- `frontend/src/components/TrendPanel.tsx`
- `frontend/src/components/AnomalyPanel.tsx`
- `frontend/src/components/CopilotPanel.tsx`
- `frontend/src/components/ReorderPanel.tsx`
- `frontend/src/components/SkuDetailPanel.tsx` *(new)*
- `frontend/src/lib/api.ts`

### Docs
- `docs/session-summary.md`

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

### SKU Detail
- `GET /skus/{sku_id}/profile`

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

## Environment Variables
- `OPENAI_API_KEY` enables LLM tool-calling agent
- `LLM_AGENT_MODEL` defaults to `gpt-4o-mini`
- `DISABLE_LLM_AGENT=1` forces rule-based routing

## Suggested Next Steps
1. Add model evaluation page (MAPE, ROC-AUC, drift trends).
2. Add SQL semantic layer + guardrails for richer enterprise-scale querying.
3. Add role-based dashboards (planner, warehouse manager, procurement).
4. Add real ERP connector adapters (NetSuite/SAP/Odoo) with read-only MCP integration first.
5. Add SKU search / cross-link from Trends and Anomalies pages to SKU detail.

## Resume Prompt Template
Use this in a new chat:

"Open `/Users/rohanchava/erp-agent-copilot`, read `docs/session-summary.md`, and continue with: <next feature>."
