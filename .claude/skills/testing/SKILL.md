---
name: testing
description: Write or run tests for the erp-agent-copilot backend endpoints and frontend components.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# ERP Copilot — Testing Conventions

## Current State
There are **no test files yet** — this is a greenfield testing setup.
Backend uses Python + FastAPI. Frontend uses Next.js + TypeScript.

## Backend Testing

### Stack
- `pytest` + `httpx` + FastAPI `TestClient`
- Install: already in `.venv` if added to `requirements.txt`; else `pip install pytest httpx`

### Test File Location
```
backend/
  tests/
    __init__.py
    test_endpoints.py     # Route-level integration tests
    test_store.py         # ERPStore unit tests
    test_ml.py            # MLPredictor unit tests
```

### FastAPI TestClient Pattern
```python
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}

def test_sku_profile_found():
    r = client.get("/skus/SKU-1000/profile")
    assert r.status_code == 200
    data = r.json()
    assert data["sku_id"] == "SKU-1000"
    assert "on_hand" in data
    assert "reorder" in data

def test_sku_profile_not_found():
    r = client.get("/skus/INVALID-SKU/profile")
    assert r.status_code == 404
```

### Run Backend Tests
```bash
cd backend
.venv/bin/pytest tests/ -v
```

## Frontend Testing

### Stack
- Vitest + React Testing Library (preferred for Next.js App Router projects)
- Install: `npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom`

### Test File Location
Colocated with components:
```
frontend/src/components/
  ReorderPanel.tsx
  ReorderPanel.test.tsx   ← colocated
frontend/src/lib/
  chartHelpers.ts
  chartHelpers.test.ts    ← pure function tests
```

### Component Test Pattern
```typescript
import { render, screen } from "@testing-library/react";
import { ReorderPanel } from "./ReorderPanel";

const mockRecs = [{ sku_id: "SKU-1000", status: "REORDER_NOW", ... }];

test("shows reorder now count", () => {
  render(<ReorderPanel recommendations={mockRecs} />);
  expect(screen.getByText("1")).toBeInTheDocument(); // reorder now count
});

test("shows empty state when no filter match", () => {
  render(<ReorderPanel recommendations={[]} />);
  expect(screen.getByText(/no items match/i)).toBeInTheDocument();
});
```

### Pure Function Tests (chartHelpers)
```typescript
import { buildPath, chartSeries } from "./chartHelpers";

test("buildPath returns empty string for empty input", () => {
  expect(buildPath([])).toBe("");
});

test("chartSeries normalises values into SVG coords", () => {
  const pts = chartSeries([0, 50, 100], 100, 100, 0, 100);
  expect(pts[0]).toEqual({ x: 0, y: 100 });
  expect(pts[2]).toEqual({ x: 100, y: 0 });
});
```

### Run Frontend Tests
```bash
cd frontend
npx vitest run
```

## What to Test

### High Priority
- All backend endpoints: happy path + 404/error cases
- `chartHelpers.ts` — pure functions, easy to unit test
- `ReorderPanel` empty state and filter logic
- `SkuDetailPanel` renders skeleton while loading

### Medium Priority
- Store methods: `reorder_recommendations()`, `stock_performance()`, `anomaly_summary()`
- API fetch functions in `api.ts` — mock `fetch`, assert correct URLs

### Skip for Now
- Full E2E (Playwright/Cypress) — overkill for a learning project
- Snapshot tests — too brittle for rapidly changing UI
