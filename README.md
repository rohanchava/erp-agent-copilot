# ERP Agent Copilot (Learning Project)

A local full-stack project to learn how to build an ERP/WMS data copilot with synthetic data, ML predictions, and an agent-style interface.

## Stack
- Frontend: Next.js + TypeScript + Tailwind + Framer Motion
- Backend: FastAPI + Pandas + scikit-learn
- Data: synthetic ERP tables (`inventory`, `orders`, `shipments`, `purchase_orders`)

## Project layout
- `frontend/`: chat-first dashboard UI
- `backend/`: API, tool-routing agent, ML predictors
- `data/`: synthetic ERP generator and generated CSV files

## Quick start
1. Generate synthetic data
```bash
cd data
python3 generate_data.py
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

Open `http://localhost:3000`.

## Try these prompts
- `Give me a KPI summary`
- `Which SKU has highest stockout risk?`
- `Which suppliers are most delayed?`
- `Which warehouse has lowest cover risk?`
- `Forecast SKU-1008 trend for next 14 days`

## Learning roadmap
1. Replace rule-based agent routing with LLM tool-calling.
2. Add warehouse location dimension and per-site forecasting.
3. Add SQL layer + query policy guardrails.
4. Add auth + row-level security.
5. Add model eval notebook and drift checks.
