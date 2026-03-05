---
name: frontend
description: Build or modify frontend components, pages, and API types for the erp-agent-copilot Next.js app.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# ERP Copilot — Frontend Conventions

## Stack
- Next.js 15 App Router · TypeScript · Tailwind CSS
- No component library — all UI is hand-rolled with Tailwind utilities
- SVG charts are built manually (no charting library); see `TrendPanel.tsx` for the `buildPath` / `chartSeries` / `splitChart` pattern

## File Locations
| Thing | Path |
|---|---|
| Pages | `frontend/src/app/<route>/page.tsx` |
| Client components | `frontend/src/components/<Name>.tsx` |
| API types + fetch functions | `frontend/src/lib/api.ts` |
| Global styles | `frontend/src/app/globals.css` |
| Tailwind config | `frontend/tailwind.config.ts` |

## Page Pattern
Pages are **async server components** that fetch data and hand it to a `"use client"` panel component:

```tsx
// app/reorders/page.tsx
import { fetchReorderRecommendations } from "@/lib/api";
import { ReorderPanel } from "@/components/ReorderPanel";

export default async function ReordersPage() {
  const recommendations = await fetchReorderRecommendations();
  return <ReorderPanel recommendations={recommendations} />;
}
```

For pages that need client-side fetching (e.g. SKU detail), the page just passes params to the panel:

```tsx
// app/skus/[sku_id]/page.tsx
import { SkuDetailPanel } from "@/components/SkuDetailPanel";
export default function SkuDetailPage({ params }: { params: { sku_id: string } }) {
  return <SkuDetailPanel skuId={params.sku_id.toUpperCase()} />;
}
```

## Component Pattern
- `"use client"` at top for interactive components
- Named exports (`export function FooPanel`)
- `useEffect` for data fetching on mount or dependency change
- Always show a loading state (`animate-pulse` skeleton cards) while fetching
- Always show an error string when fetch fails

## Custom Tailwind Tokens
| Token | Value | Use |
|---|---|---|
| `text-ink` / `bg-ink` | `#101A2A` | Primary text / dark backgrounds |
| `bg-mist` | `#F3F7FF` | Soft card backgrounds |
| `text-pulse` | `#00A9A5` | Teal accent |
| `text-ember` | `#F97316` | Orange accent |
| `text-sky` | `#2563EB` | Blue accent |
| `font-heading` | Sora | Section headings |
| `font-body` | Manrope | Body text (default) |

## Card / Section Shell
Every major section uses this wrapper:
```tsx
<section className="rounded-3xl border border-white/70 bg-white/85 p-5 shadow-md backdrop-blur">
```

KPI / stat cards:
```tsx
<div className="rounded-xl border border-slate-200 bg-white p-4">
  <p className="text-xs text-slate-500">Label</p>
  <p className="mt-1 text-xl font-bold text-slate-900">Value</p>
</div>
```

## Status Badge Colors
```
REORDER_NOW  → bg-rose-100 text-rose-700
REORDER_SOON → bg-amber-100 text-amber-700
OK           → bg-emerald-100 text-emerald-700
HIGH conf    → bg-emerald-100 text-emerald-700
MEDIUM conf  → bg-amber-100 text-amber-700
LOW conf     → bg-rose-100 text-rose-700
```

## Navigation
Add new pages to `NAV_ITEMS` in `AppShell.tsx`. Use `exact: true` only for `/`. All other items use `startsWith` for active state so nested routes (e.g. `/skus/SKU-1000`) keep the parent highlighted.

## API Layer (`api.ts`)
- All fetch functions use `{ cache: "no-store" }`
- Base URL: `process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000"`
- Export a `type` for every response shape
- Throw a descriptive `Error` on non-ok responses

## Adding a New Page Checklist
1. Add response type(s) and fetch function(s) to `api.ts`
2. Create `app/<route>/page.tsx` (server component — fetch + pass to panel)
3. Create `components/<Name>Panel.tsx` (`"use client"` — rendering + interaction)
4. Add entry to `NAV_ITEMS` in `AppShell.tsx`
5. Update `README.md` pages table and API endpoints section
