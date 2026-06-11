import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { ElipProvider } from "@/lib/elip-data";
import { Toaster } from "@/components/ui/sonner";
import {
  Headphones,
  Briefcase,
  Settings2,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";


type Section = {
  label: string;
  Icon: LucideIcon;
  links: { to: string; label: string }[];
  defaultOpen?: boolean;
};

const sections: Section[] = [
  {
    label: "CALL CENTRE",
    Icon: Headphones,
    defaultOpen: true,
    links: [
      { to: "/call-centre/assistant", label: "AI Call Assistant" },
    ],
  },
  {
    label: "SALES PIPELINE",
    Icon: Briefcase,
    defaultOpen: true,
    links: [
      { to: "/sales/dashboard", label: "Pipeline Dashboard" },
      { to: "/sales/pipeline", label: "Active Pipeline" },
    ],
  },
  {
    label: "SETTINGS & OBSERVATIONS",
    Icon: Settings2,
    defaultOpen: false,
    links: [
      { to: "/management/kpi", label: "KPI Dashboard" },
      { to: "/management/workload", label: "Workload Monitor" },
      { to: "/management/churn", label: "Churn Alert Queue" },
      { to: "/management/recall", label: "Re-Call Schedule" },
      { to: "/management/salvage", label: "Etihad Affiliates" },
      { to: "/management/reactivation", label: "Re-Activation Queue" },
      { to: "/sales/queue", label: "Leads Queue" },
      { to: "/sales/ledger", label: "Processed Ledger" },
      { to: "/management/audit", label: "Explainable AI & Audit Log" },
      { to: "/management/hermes", label: "Hermes Agent Hub" },
    ],
  },
];


function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(sections.map((s) => [s.label, s.defaultOpen ?? false])),
  );
  const toggle = (label: string) =>
    setOpenSections((p) => ({ ...p, [label]: !p[label] }));


  return (
      <aside className="w-64 shrink-0 bg-navy text-navy-foreground flex flex-col">
      <div className="px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          {/* ELIP logo mark — Etihad-inspired bloom petals */}
          <svg viewBox="0 0 40 40" className="w-10 h-10 shrink-0" aria-hidden="true">
            <defs>
              <linearGradient id="elipPetal" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="oklch(0.76 0.16 55)" />
                <stop offset="100%" stopColor="oklch(0.62 0.18 42)" />
              </linearGradient>
            </defs>
            <g transform="translate(20 20)">
              {[0, 60, 120, 180, 240, 300].map((deg) => (
                <ellipse
                  key={deg}
                  cx="0"
                  cy="-9"
                  rx="4.5"
                  ry="9"
                  fill="url(#elipPetal)"
                  transform={`rotate(${deg})`}
                  opacity="0.92"
                />
              ))}
              <circle r="3.2" fill="white" />
            </g>
          </svg>
          <div className="flex flex-col leading-none">
            <div className="flex items-baseline gap-1.5">
              <span className="font-black tracking-tight text-2xl text-white" style={{ fontFamily: '"Inter", system-ui, sans-serif', letterSpacing: '-0.04em' }}>
                EL<span className="text-primary">i</span>P
              </span>
              <span className="text-[10px] font-semibold text-white/40 tracking-[0.2em]">2026</span>
            </div>
            <div className="text-[9.5px] uppercase tracking-[0.18em] text-white/55 mt-1">
              Lead Intelligence
            </div>
          </div>
        </div>
      </div>




      <nav className="flex-1 overflow-y-auto py-3 text-sm">
        {sections.map((s) => (
          <div key={s.label} className="mb-2">
            <button
              type="button"
              onClick={() => toggle(s.label)}
              className="w-full px-5 py-1.5 text-[11px] font-semibold tracking-wider text-white/60 hover:text-white flex items-center gap-2 transition-colors"
              aria-expanded={!!openSections[s.label]}
            >
              <s.Icon className="w-3.5 h-3.5" strokeWidth={2.25} />
              <span className="flex-1 text-left">{s.label}</span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform ${
                  openSections[s.label] ? "rotate-0" : "-rotate-90"
                }`}
                strokeWidth={2.5}
              />
            </button>

            {openSections[s.label] &&
              s.links.map((l) => {
                const active = pathname === l.to;
                return (
                  <Link
                    key={l.to}
                    to={l.to}
                    className={`block pl-9 pr-4 py-1.5 border-l-2 transition-colors ${
                      active
                        ? "border-gold text-white bg-white/5 font-semibold"
                        : "border-transparent text-white/70 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    {l.label}
                  </Link>
                );
              })}
          </div>
        ))}
      </nav>
    </aside>
  );
}

function TopBanner() {
  return (
    <div className="bg-gold text-gold-foreground text-sm font-semibold px-6 py-2 flex items-center justify-between">
      <span>ELIP Phase 1 — Day 23 of 90 | Conversion Rate: 7.9% | Target: 8.0% | Status: ON TRACK ✓</span>
      <span className="text-xs font-normal opacity-80">Every lead. Every call. Every outcome. Governed.</span>
    </div>
  );
}

function Footer() {
  return (
    <footer className="px-6 py-3 text-[11px] text-muted-foreground border-t bg-card">
      Bank Al Etihad · Digital Academy 2026 · ELIP Phase 1 — Days 1–90 · Strictly Confidential
    </footer>
  );
}

export function AppShell() {
  return (
    <ElipProvider>
      <div className="flex h-screen w-full">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <TopBanner />
          <main className="flex-1 overflow-y-auto bg-background">
            <Outlet />
          </main>
          <Footer />
        </div>
      </div>
      <Toaster richColors position="top-right" />
    </ElipProvider>
  );
}
