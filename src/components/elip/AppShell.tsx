import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { ElipProvider, useElip, type Role } from "@/lib/elip-data";
import { Toaster } from "@/components/ui/sonner";

const sections = [
  {
    label: "CALL CENTRE",
    icon: "📞",
    roles: ["cc"] as Role[],
    links: [
      { to: "/call-centre/new-lead", label: "New Lead Entry" },
      { to: "/call-centre/submissions", label: "My Submissions" },
    ],
  },
  {
    label: "SALES PIPELINE",
    icon: "💼",
    roles: ["rlm"] as Role[],
    links: [
      { to: "/sales/queue", label: "Leads Queue" },
      { to: "/sales/pipeline", label: "Active Pipeline" },
      { to: "/sales/recall", label: "Re-Call Queue" },
      { to: "/sales/ledger", label: "Processed Ledger" },
    ],
  },
  {
    label: "MANAGEMENT",
    icon: "📊",
    roles: ["tl"] as Role[],
    links: [
      { to: "/management/kpi", label: "KPI Dashboard" },
      { to: "/management/workload", label: "Workload Monitor" },
      { to: "/management/churn", label: "Churn Alert Queue" },
      { to: "/management/recall", label: "Re-Call Schedule" },
      { to: "/management/salvage", label: "Group Salvage" },
      { to: "/management/reactivation", label: "Re-Activation Queue" },
    ],
  },
];

function Sidebar() {
  const { role, setRole, currentUser } = useElip();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <aside className="w-64 shrink-0 bg-navy text-navy-foreground flex flex-col">
      <div className="px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🏦</span>
          <div>
            <div className="font-bold tracking-tight text-base leading-tight">ELIP 2026</div>
            <div className="text-[11px] text-white/60 leading-tight">Etihad Lead Intelligence Platform</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 text-sm">
        {sections.map((s) => (
          <div key={s.label} className="mb-4">
            <div className="px-5 py-1 text-[11px] font-semibold tracking-wider text-white/50 flex items-center gap-2">
              <span>{s.icon}</span> {s.label}
            </div>
            {s.links.map((l) => {
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

      <div className="border-t border-white/10 p-4 text-xs">
        <div className="mb-2 text-white/60">Viewing as</div>
        <div className="grid grid-cols-3 gap-1 mb-3">
          {(["cc", "rlm", "tl"] as Role[]).map((r) => (
            <button
              key={r}
              onClick={() => setRole(r)}
              className={`py-1.5 rounded text-[11px] font-semibold transition-colors ${
                role === r ? "bg-gold text-gold-foreground" : "bg-white/5 text-white/70 hover:bg-white/10"
              }`}
            >
              {r === "cc" ? "CC Agent" : r === "rlm" ? "Sales RLM" : "TL / Mgmt"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-gold text-gold-foreground flex items-center justify-center font-bold text-xs">
            {currentUser.name.split(" ").map((n) => n[0]).join("")}
          </div>
          <div className="flex-1 min-w-0">
            <div className="truncate font-medium">{currentUser.name}</div>
            <div className="text-white/50 text-[10px]">{role === "cc" ? "Contact Centre" : role === "rlm" ? "Retail Loan Manager" : "Team Leader"}</div>
          </div>
        </div>
      </div>
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
