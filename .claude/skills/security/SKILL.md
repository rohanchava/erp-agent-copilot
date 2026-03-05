---
name: security
description: Review or harden the erp-agent-copilot app for security issues — input validation, injection, auth, CORS, dependency exposure.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# ERP Copilot — Security Conventions

## Threat Model
This is a local dev / portfolio project with synthetic data. No real credentials or PII.
Primary concerns: safe coding habits, no accidental exposure if deployed, dependency hygiene.

## Known Attack Surface

### Backend (FastAPI)
| Surface | Current State | Risk |
|---|---|---|
| CORS | Allows `localhost:3000` + `localhost:3001` | Low — local only; tighten for any deployment |
| Input validation | FastAPI/Pydantic validates POST bodies; Query params use `ge`/`le` bounds | Good |
| SKU/ID injection | IDs uppercased then used in pandas `.loc[]` — not SQL | Low — no SQL injection path |
| `agent/chat` freeform input | Question string passed to LLM or rule-based router | Medium — prompt injection possible if LLM enabled |
| `OPENAI_API_KEY` | Read from env var, never logged | Good — ensure never committed |
| Error messages | Some return raw detail strings in 404s | Low — reveals internal field names |

### Frontend (Next.js)
| Surface | Current State | Risk |
|---|---|---|
| `dangerouslySetInnerHTML` | Not used anywhere | Good |
| User-controlled URLs | SKU IDs from API used in `href` — not from user input | Low |
| `NEXT_PUBLIC_API_BASE` | Env var exposed to client bundle | Fine — it's a URL, not a secret |
| Dependencies | Next.js 15, Tailwind — check for CVEs periodically | Medium |

## Rules to Follow When Writing Code

### Never do
- `eval()`, `exec()`, `subprocess` with user input
- Raw f-string SQL: `f"SELECT * FROM t WHERE id = '{user_input}'"` (not applicable here — no SQL, but keep in mind)
- Log or return secrets: API keys, tokens
- Commit `.env` files or any file containing `API_KEY`, `SECRET`, `PASSWORD`
- `allow_origins=["*"]` in CORS for any non-local deployment

### Always do
- `.upper()` / `.strip()` SKU IDs before DataFrame lookups (already done)
- Use Pydantic models for all POST request bodies (already done)
- Validate Query param bounds with `ge`/`le` (already done)
- Use `HTTPException` rather than returning raw error dicts for 404s
- Keep `OPENAI_API_KEY` in env, never hardcode

## Hardening Checklist (Before Any Deployment)
- [ ] Restrict CORS `allow_origins` to actual frontend domain
- [ ] Add rate limiting (`slowapi` for FastAPI)
- [ ] Add auth (API key header or JWT) to all non-`/health` endpoints
- [ ] Sanitise LLM agent input — strip prompt injection attempts
- [ ] Run `pip-audit` on backend deps: `.venv/bin/pip-audit`
- [ ] Run `npm audit` on frontend deps: `cd frontend && npm audit`
- [ ] Set `secure`, `httpOnly`, `sameSite` on any cookies if auth added
- [ ] Move `data/generated/` behind auth — currently open to anyone who can hit the API

## Dependency Audit Commands
```bash
# Backend
cd backend && .venv/bin/pip-audit

# Frontend
cd frontend && npm audit

# Check for outdated packages
cd backend && .venv/bin/pip list --outdated
cd frontend && npm outdated
```

## Prompt Injection (LLM Agent)
If `OPENAI_API_KEY` is set, user questions go directly to the LLM with tool access.
Mitigations already in place: tool calls are read-only (no write tools exposed).
If hardening: add an input allowlist or strip known injection patterns before forwarding.
