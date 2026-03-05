# ERP Agent Copilot

Agentic ERP/WMS copilot with synthetic enterprise data, ML risk forecasting, interactive inventory trends, and per-SKU drill-down analytics.

## Why This Project
ERP and warehouse systems usually require digging through many screens for routine operational decisions. This project provides a multi-page dashboard + chat interface that can:
- answer operational questions with tool traces,
- surface KPIs, reorder signals, and risk indicators,
- visualize inventory trends with forecast and what-if simulation,
- drill into any SKU for a full profile: trend, stockout risk, and reorder signal.

Designed as a learning project for full-stack ML applications.

## Features
- **KPI dashboard** — open orders, delayed shipments, fill rate, low stock SKUs, warehouses
- **Operational Pulse** — daily sparklines for orders, delayed shipments, fill rate with 7D/30D/90D window toggles; top stock gainers and decliners
- **Anomaly analytics** — demand spikes, stock drops, supplier delivery risk (z-score based)
- **Reorder recommendations** — ROP-based signals with safety stock, reorder qty, suggested order date, confidence (HIGH/MEDIUM/LOW), urgency score
- **Inventory trends + what-if simulator** — history vs projected stock chart, scenario sliders for demand / lead-time / replenishment multipliers, baseline vs scenario overlay
- **SKU catalog** — searchable list of all SKUs with on-hand and days-of-cover
- **SKU detail page** — per-SKU profile with 6 KPI cards, trend chart, scenario simulation, stockout risk card, and reorder signal card
- **Stockout risk prediction** per SKU (logistic regression, configurable horizon)
- **Delay risk prediction** for orders
- **Supplier analytics** — delay rates, avg late days, on-time rate
- **Warehouse analytics** — low cover-risk ranking
- **AI Copilot chat** — natural-language Q&A with tool traces; optional OpenAI tool-calling with rule-based fallback
- **Synthetic data generator** for repeatable local development

## Pages
| Route | Description |
|-------|-------------|
| `/` | Overview — KPIs, Operational Pulse, top movers |
| `/trends` | Inventory trends + what-if simulator |
| `/anomalies` | Demand spikes, stock drops, supplier risk |
| `/reorders` | ROP-based reorder recommendations table |
| `/skus` | SKU catalog with search (links to detail page) |
| `/skus/[sku_id]` | Per-SKU detail: trend, stockout risk, reorder signal, scenario sim |
| `/copilot` | AI copilot chat with tool traces |

## Tech Stack
- **Frontend:** Next.js 15 (App Router), TypeScript, Tailwind CSS
- **Backend:** FastAPI, Pandas, scikit-learn
- **ML:**
  - Logistic Regression — stockout risk, delay risk
  - Time-series feature regression — SKU demand forecasting
  - ROP formula — reorder point with safety stock (Z=1.65, 95% service level)
- **Data:** Generated CSV datasets (inventory, orders, shipments, supplier POs, inventory history, warehouse inventory)

## Architecture
```text
Frontend (Next.js App Router)
  └─ Pages: Overview, Trends, Anomalies, Reorders, SKUs, Copilot

Backend (FastAPI)
  ├─ ERPStore      — data access, analytics, reorder engine
  ├─ MLPredictor   — risk models, demand forecasting, simulation
  └─ Agent Router  — intent routing, tool traces, optional LLM

Data Layer
  └─ Synthetic ERP/WMS generator → data/generated/ CSVs
```

## Project Structure
```text
erp-agent-copilot/
  frontend/
    src/
      app/          # Next.js pages (overview, trends, anomalies, reorders, skus, copilot)
      components/   # TrendPanel, ReorderPanel, SkuDetailPanel, AnomalyPanel, CopilotPanel, …
      lib/api.ts    # Typed fetch functions + response types
  backend/
    main.py         # FastAPI routes
    services/
      store.py      # ERPStore — data access + analytics
      ml.py         # MLPredictor — risk + forecast models
      agent.py      # Rule-based agent router
      llm_agent.py  # OpenAI tool-calling agent
  data/
    generate_data.py  # Synthetic dataset generator
    generated/        # Output CSVs (git-ignored)
  docs/
    session-summary.md  # Running dev session log
```

## Quickstart

### 1. Generate data
```bash
cd data
../backend/.venv/bin/python generate_data.py
```

### 2. Run backend
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 3. Run frontend
```bash
cd frontend
npm install
npm run dev
```

### 4. Open app
```
http://localhost:3000
```

## LLM Tool-Calling Agent (Optional)
Set environment variables before starting the backend:
```bash
export OPENAI_API_KEY=your_key_here
export LLM_AGENT_MODEL=gpt-4o-mini   # default
```
- If no `OPENAI_API_KEY` is set, the app automatically uses the rule-based agent.
- `DISABLE_LLM_AGENT=1` forces rule-based mode regardless.

## API Endpoints

### Core
- `GET /health`
- `GET /kpis`
- `GET /skus`
- `GET /skus/{sku_id}/profile`

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

### Recommendations + Predictions
- `GET /recommendations/reorder`
- `POST /predict/stockout`
- `POST /predict/delay`

### Agent
- `POST /agent/chat`

## Demo Questions (Copilot)
- `Give me a KPI summary`
- `Which SKU has the highest stockout risk?`
- `Give stockout risk for SKU-1008`
- `Which suppliers are most delayed?`
- `How are supplier 3 deliveries in last 60 days?`
- `How has SKU-1008 been performing stock-wise in the last 45 days?`
- `What anomalies did we see in the last 30 days?`
- `Which warehouse has the lowest inventory cover risk?`
- `Forecast trend for SKU-1008`

## Roadmap
1. Model evaluation page — MAPE, ROC-AUC, drift trends.
2. SQL semantic layer + query guardrails.
3. Role-based dashboards (planner, warehouse manager, procurement).
4. Real ERP connector adapters (NetSuite/SAP/Odoo).
5. Auth and row-level security.

## License
For learning and portfolio use.
