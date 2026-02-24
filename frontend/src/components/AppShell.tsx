"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Overview" },
  { href: "/trends", label: "Trends" },
  { href: "/anomalies", label: "Anomalies" },
  { href: "/copilot", label: "Copilot" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen">
      <div className="mx-auto flex w-full max-w-[1400px] gap-4 px-3 py-4 sm:px-6">
        <aside className="hidden w-56 shrink-0 rounded-3xl border border-white/40 bg-slate-950/90 p-4 text-slate-100 shadow-2xl backdrop-blur lg:block">
          <p className="text-[10px] uppercase tracking-[0.22em] text-cyan-300">ERP Copilot</p>
          <h2 className="mt-2 font-heading text-lg">Ops Command</h2>

          <nav className="mt-5 space-y-1">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block rounded-xl px-3 py-2 text-sm transition ${
                    active
                      ? "bg-cyan-400/20 text-cyan-200"
                      : "text-slate-300 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-8 rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-xs text-cyan-100">
            Ask time-window questions like: <br />
            <span className="font-semibold">"How has SKU-1008 performed in last 45 days?"</span>
          </div>
        </aside>

        <div className="flex-1">
          <header className="mb-4 rounded-2xl border border-white/60 bg-white/70 px-4 py-3 shadow-sm backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Synthetic ERP Intelligence</p>
                <h1 className="font-heading text-xl text-slate-900 sm:text-2xl">Warehouse Ops Copilot</h1>
              </div>

              <div className="flex flex-wrap gap-2 lg:hidden">
                {NAV_ITEMS.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`rounded-lg px-3 py-1.5 text-xs transition ${
                        active ? "bg-slate-900 text-white" : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          </header>

          <main className="pb-4">{children}</main>
        </div>
      </div>
    </div>
  );
}
