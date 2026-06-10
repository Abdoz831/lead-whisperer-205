import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageHeader, KPICard } from "@/components/elip/UI";

export const Route = createFileRoute("/management/kpi")({
  component: KPIPage,
});

const triggers = [
  { kpi: "Conversion Rate", current: "7.9%", target: "Min 8.0%", status: "warn", action: "Diagnostic report queued", manual: "Run Diagnostic" },
  { kpi: "AI Model Lift", current: "2.1pp", target: "Min 1.5pp", status: "ok", action: "No action", manual: "View Report" },
  { kpi: "Workload Balance", current: "1.8x", target: "Max 2.5x", status: "ok", action: "No action", manual: "View Detail" },
  { kpi: "Affiliate Salvage", current: "0%", target: "Min 20%", status: "muted", action: "Phase 3 pending", manual: "View Status" },
  { kpi: "No Answer Resolution", current: "61%", target: "Min 65%", status: "warn", action: "TL review recommended", manual: "Investigate" },
  { kpi: "Social Lead SLA", current: "N/A", target: "<15 min avg", status: "muted", action: "Phase 3 pending", manual: "View Status" },
] as const;

function KPIPage() {
  return (
    <>
      <PageHeader title="Management — KPI Dashboard" subtitle="Full pipeline visibility. Monitor team health, workload, churn risk, and recovery." />
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-5 gap-4">
          <KPICard label="Conversion Rate (Cycle)" value="7.9%" sub="Target: 8.0% · ↑ trending up" status={{ text: "⚠️ BELOW TARGET", tone: "warn" }} accent="navy" />
          <KPICard label="Pipeline Under Mgmt" value="JOD 1,503,748" sub="13 active units" status={{ text: "ON TRACK", tone: "ok" }} accent="navy" />
          <KPICard label="Churn Alerts" value="3 active" sub="2 leads >48h stagnant" status={{ text: "⚠️ ACTION NEEDED", tone: "warn" }} accent="orange" />
          <KPICard label="Workload Index" value="1.8x" sub="Max allowed 2.5x" status={{ text: "BALANCED", tone: "ok" }} accent="green" />
          <KPICard label="Etihad Affiliates Recovery" value="0%" sub="Target 20% (Phase 3)" status={{ text: "NOT ACTIVE", tone: "muted" }} accent="gold" />
        </div>

        <div className="elip-card overflow-hidden">
          <div className="px-4 py-3 border-b bg-card">
            <h2 className="text-sm font-bold text-navy">Automated KPI Triggers</h2>
            <p className="text-xs text-muted-foreground">Self-governing. Humans remain final authority.</p>
          </div>
          <table className="w-full text-xs">
            <thead className="bg-zinc-50 text-zinc-600 text-[11px] uppercase tracking-wider">
              <tr>
                {["KPI", "Current", "Target", "Status", "Auto-Action", "Manual"].map(h => <th key={h} className="text-left px-3 py-2 font-semibold">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {triggers.map(t => (
                <tr key={t.kpi} className="border-t">
                  <td className="px-3 py-2 font-semibold">{t.kpi}</td>
                  <td className="px-3 py-2 font-mono">{t.current}</td>
                  <td className="px-3 py-2 text-muted-foreground">{t.target}</td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      t.status === "ok" ? "bg-green-100 text-green-800" :
                      t.status === "warn" ? "bg-amber-100 text-amber-900" :
                      "bg-zinc-100 text-zinc-700"
                    }`}>{t.status === "ok" ? "✅ OK" : t.status === "warn" ? "⚠️ WARNING" : "⏸️ NOT ACTIVE"}</span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{t.action}</td>
                  <td className="px-3 py-2">
                    <button onClick={() => toast.success(`✓ ${t.manual} executed and flagged to TL and CRO.`)} className="bg-navy text-navy-foreground px-3 py-1 rounded text-[11px] font-semibold">{t.manual}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="elip-card p-5">
          <h2 className="text-sm font-bold text-navy mb-1">Conversion Recovery Path — Phase 1 progress</h2>
          <p className="text-xs text-muted-foreground mb-6">Current 7.9% · Target 8.0% · Ceiling 11.0%</p>
          <div className="relative h-3 bg-zinc-100 rounded-full overflow-hidden">
            <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-red-500 via-amber-400 to-green-500" style={{ width: "64.5%" }} />
            <div className="absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-gold border-4 border-white shadow-md animate-pulse" style={{ left: "calc(48.4% - 10px)" }} />
          </div>
          <div className="grid grid-cols-6 mt-3 text-[10px] text-zinc-600 text-center">
            {[["4.91%","CRISIS"],["6.0%","PHASE 1 FLOOR"],["7.9%","CURRENT ▼"],["8.0%","TARGET"],["8.65%","FULL AI"],["11.0%","CEILING"]].map(([v,l]) => (
              <div key={l}><div className="font-bold text-navy">{v}</div><div>{l}</div></div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
