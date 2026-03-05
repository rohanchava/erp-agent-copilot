---
name: backend
description: Add or modify FastAPI endpoints, store methods, and ML services for the erp-agent-copilot backend.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# ERP Copilot — Backend Conventions

## Stack
- FastAPI 0.115 · Pandas 2.2 · scikit-learn 1.6 · Python 3.9+
- Venv: `backend/.venv/` — always use `.venv/bin/python` / `.venv/bin/uvicorn`
- Start server: `cd backend && .venv/bin/uvicorn main:app --port 8000`

## File Locations
| Thing | Path |
|---|---|
| Routes | `backend/main.py` |
| Data access + analytics | `backend/services/store.py` — `ERPStore` class |
| ML models + forecasting | `backend/services/ml.py` — `MLPredictor` class |
| Rule-based agent | `backend/services/agent.py` |
| LLM agent | `backend/services/llm_agent.py` |
| Dependencies | `backend/requirements.txt` |
| Data generator | `data/generate_data.py` |
| Generated CSVs | `data/generated/` |

## Adding a New Endpoint

### GET (read / analytics)
```python
@app.get("/resource/{resource_id}")
def get_resource(
    resource_id: str,
    days: int = Query(default=30, ge=7, le=180),
    limit: int = Query(default=5, ge=1, le=20),
) -> dict[str, Any]:
    result = store.method_name(resource_id.upper(), days=days, limit=limit)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Unknown resource: {resource_id}")
    return result
```

### POST (prediction / simulation)
```python
class MyRequest(BaseModel):
    sku_id: str
    horizon_days: int = 14

@app.post("/predict/my-model")
def predict_something(payload: MyRequest) -> dict[str, Any]:
    return ml.my_prediction(payload.sku_id.upper(), payload.horizon_days)
```

## Error Handling
- **404 for unknown IDs**: use `HTTPException(status_code=404, detail=...)`
- **Store returns None**: always guard with `if result is None: raise HTTPException(...)`
- **ML returns error dict**: `{"error": "..."}` for unknown SKU/order — this is fine for prediction endpoints
- **Never let pandas KeyError bubble up**: validate inputs before DataFrame ops

## Store Method Conventions (`store.py`)
- Single-row lookups return `pd.Series | None`: `inventory_row(sku_id)`, `order_row(order_id)`
- List returns: `list[dict[str, Any]]`
- Analytics return `dict[str, Any] | None`
- Time-window helpers: use `self._window_start(days)` — returns a `pd.Timestamp`
- Always `.upper()` SKU/supplier IDs before DataFrame lookups
- Date columns normalised to midnight: `pd.Timestamp.today().normalize()`

## Type Annotations
```python
from typing import Any, Optional
# Use modern union syntax where possible
def method(x: str, y: int | None = None) -> dict[str, Any] | None: ...
```

## CORS
Allowed origins are in `main.py`: `["http://localhost:3000", "http://localhost:3001"]`
Add new origins there if needed for dev.

## Adding a New Store Method Checklist
1. Add method to `ERPStore` in `store.py`
2. Use `self._window_start(days)` for time-filtering
3. Return `None` (not empty dict) when the resource doesn't exist
4. Add the route in `main.py` — keep route handler thin, logic in store
5. Add endpoint to README API surface table
