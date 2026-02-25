# ERP Agent Copilot

Agentic ERP/WMS copilot with synthetic enterprise data, ML risk forecasting, and interactive stock trend predictions.

## Why This Project
ERP and warehouse systems usually require digging through many screens for routine operational decisions. This project provides a chat-first interface that can:
- answer operational questions,
- surface KPIs and risk signals,
- show transparent tool traces,
- visualize inventory trends with forecasts.

It is designed as a learning project for full-stack ML applications.

## Features
- Agentic Q&A for ERP/WMS-style operations
- KPI dashboard (`open orders`, `delayed shipments`, `fill rate`, `low stock`, `warehouses`)
- Anomaly analytics (demand spikes, stock drops, supplier delivery risk)
- Stockout risk prediction per SKU
- Delay risk prediction for orders
- Supplier delay analytics and warehouse cover-risk analytics
- Inventory trend + forecast chart (history vs projected stock)
- Synthetic data generator for repeatable local development

## Tech Stack
- Frontend: Next.js (App Router), TypeScript, Tailwind CSS, Framer Motion
- Backend: FastAPI, Pandas, scikit-learn
- ML:
  - Logistic Regression for stockout risk
  - Logistic Regression for delay risk
  - Time-series feature regression for SKU demand forecasting
- Data: generated CSV datasets (inventory, orders, shipments, supplier POs, inventory history, warehouse inventory)

## Architecture
```text
Frontend (Next.js)
  -> /agent/chat
  -> /kpis
  -> /predict/*
  -> /trends/stock/{sku}

Backend (FastAPI)
  -> ERPStore (data access + analytics tools)
  -> MLPredictor (risk + forecast models)
  -> Agent Router (intent routing + tool traces)

Data Layer
  -> Synthetic ERP/WMS generator
  -> CSV datasets in data/generated/
```

## Project Structure
```text
erp-agent-copilot/
  frontend/      # UI dashboard + chat + trend visualization
  backend/       # FastAPI routes, agent logic, ML services
  data/          # Synthetic data generation and generated datasets
```

## Quickstart
1. Generate data
```bash
cd data
../backend/.venv/bin/python generate_data.py
```

2. Run backend
```bash
cd ../backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

3. Run frontend (new terminal)
```bash
cd ../frontend
npm install
npm run dev
```

4. Open app
```text
http://localhost:3000
```

## LLM Tool-Calling Agent (Optional)
The backend now supports OpenAI tool-calling for more flexible natural-language questions.

Set environment variables before starting backend:
```bash
export OPENAI_API_KEY=your_key_here
export LLM_AGENT_MODEL=gpt-4o-mini
```

Optional controls:
- `DISABLE_LLM_AGENT=1` forces rule-based fallback
- If no `OPENAI_API_KEY` is present, app automatically uses rule-based agent

## Demo Questions
- `Give me a KPI summary`
- `Which SKU has highest stockout risk?`
- `Give stockout risk for SKU-1008`
- `Which suppliers are most delayed?`
- `How are supplier 3 deliveries in last 60 days?`
- `How has SKU-1008 been performing stock wise in last 45 days?`
- `What anomalies did we see in last 30 days?`
- `Which warehouse has lowest inventory cover risk?`
- `Forecast trend for SKU-1008`

## API Endpoints
- `GET /health`
- `GET /kpis`
- `GET /skus`
- `GET /trends/stock/{sku_id}`
- `GET /analytics/suppliers`
- `GET /analytics/suppliers/{supplier_id}`
- `GET /analytics/warehouses`
- `GET /analytics/anomalies`
- `GET /analytics/stock-performance/{sku_id}`
- `POST /predict/stockout`
- `POST /predict/delay`
- `POST /simulate/stock`
- `POST /agent/chat`

## Learning Notes
This project now supports LLM tool-calling with a safe rule-based fallback so development stays stable without external API keys.

## Roadmap
1. Add SQL semantic layer and query guardrails.
2. Add auth and row-level security.
3. Add model evaluation, monitoring, and drift checks.
4. Add real ERP connector adapters (NetSuite/SAP/Odoo).

## License
For learning and portfolio use.
