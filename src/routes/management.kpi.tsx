import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader, KPICard } from "@/components/elip/UI";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/management/kpi")({
  component: KPIPage,
});

type Trigger = {
  kpi: string;
  current: string;
  target: string;
  status: "ok" | "warn" | "muted";
  action: string;
  manual: string;
  report: {
    summary: string;
    findings: string[];
    recommendation: string;
    owner: string;
  };
};

const triggers: Trigger[] = [
  {
    kpi: "Conversion Rate", current: "7.9%", target: "Min 8.0%", status: "warn",
    action: "Diagnostic report queued", manual: "Run Diagnostic",
    report: {
      summary: "Cycle conversion is 0.1pp below the Phase 1 floor of 8.0%. Trend is recovering (+0.4pp WoW).",
      findings: [
        "P2 leads converting at 6.4% vs. plan 7.5% — driver: 18% docs-pending stagnation >48h.",
        "AI-assisted calls outperform manual by +2.1pp lift (above 1.5pp target).",
        "Top loss reason: 'No Answer' (34%), followed by 'Premium too high' (21%).",
      ],
      recommendation: "Escalate 7 stagnant P2 files to TL review and trigger reactivation cadence on the No-Answer cohort.",
      owner: "Senior Director — Sales Operations",
    },
  },
  {
    kpi: "AI Model Lift", current: "2.1pp", target: "Min 1.5pp", status: "ok",
    action: "No action", manual: "View Report",
    report: {
      summary: "AI assistant is delivering +2.1pp conversion lift vs. control group, exceeding the 1.5pp floor.",
      findings: [
        "Auto-language detection accuracy at 94% across EN / AR / RU.",
        "Probing playbook adherence at 88% on AI-assisted calls vs. 71% manual.",
        "Lead enrichment coverage at 92% of inbound."
      ],
      recommendation: "Maintain current model. Quarterly recalibration scheduled for next cycle.",
      owner: "Senior Director — AI & Analytics",
    },
  },
  {
    kpi: "Workload Balance", current: "1.8x", target: "Max 2.5x", status: "ok",
    action: "No action", manual: "View Detail",
    report: {
      summary: "Workload distribution index at 1.8x — well within the 2.5x ceiling. No agent overload detected.",
      findings: [
        "Top agent: 42 active files. Bottom agent: 23. Spread within tolerance.",
        "Average handle time stable at 4m 12s.",
        "No reassignments required this cycle.",
      ],
      recommendation: "Continue current allocation rules.",
      owner: "Senior Director — Call Centre Operations",
    },
  },
  {
    kpi: "Affiliate Salvage", current: "0%", target: "Min 20%", status: "muted",
    action: "Phase 3 pending", manual: "View Status",
    report: {
      summary: "Etihad affiliate salvage stream is not yet active — scheduled for Phase 3 rollout.",
      findings: [
        "Integration design approved.",
        "Awaiting data-sharing agreement countersignature.",
        "Pilot agent cohort identified (n=4).",
      ],
      recommendation: "Hold — no action required this cycle. ETA Phase 3 kickoff in 3 weeks.",
      owner: "Senior Director — Partnerships",
    },
  },
  {
    kpi: "No Answer Resolution", current: "61%", target: "Min 65%", status: "warn",
    action: "TL review recommended", manual: "Investigate",
    report: {
      summary: "No-Answer resolution rate at 61% — 4pp below target. 38 leads in active no-answer queue.",
      findings: [
        "62% of no-answers resolved by attempt #3; remaining 38% require cadence extension.",
        "Best resolution window: 11:00–13:00 local time (74% pickup).",
        "WhatsApp follow-up after 2 missed calls lifts pickup by +12pp.",
      ],
      recommendation: "Enable WhatsApp auto-follow-up after attempt #2 and shift retry window into the 11–13 band.",
      owner: "Senior Director — Call Centre Operations",
    },
  },
  {
    kpi: "Social Lead SLA", current: "N/A", target: "<15 min avg", status: "muted",
    action: "Phase 3 pending", manual: "View Status",
    report: {
      summary: "Social lead intake SLA tracking not yet wired — Phase 3 dependency.",
      findings: [
        "Meta / TikTok lead webhooks configured in staging.",
        "Routing rules drafted, pending TL sign-off.",
      ],
      recommendation: "Hold — activation gated on Phase 3 kickoff.",
      owner: "Senior Director — Growth",
    },
  },
];

function KPIPage() {
  const [open, setOpen] = useState<Trigger | null>(null);

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
            <p className="text-xs text-muted-foreground">Self-governing. Humans remain final authority. Manual reports route to the Senior Director.</p>
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
                    <button onClick={() => setOpen(t)} className="bg-navy text-navy-foreground px-3 py-1 rounded text-[11px] font-semibold">{t.manual}</button>
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

      <Dialog open={!!open} onOpenChange={(v) => !v && setOpen(null)}>
        <DialogContent className="max-w-2xl">
          {open && (
            <>
              <DialogHeader>
                <DialogTitle className="text-navy">{open.manual} — {open.kpi}</DialogTitle>
                <DialogDescription>
                  Routed to <span className="font-semibold text-navy">{open.report.owner}</span>
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded border p-3 bg-zinc-50">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Current</div>
                    <div className="text-lg font-bold text-navy font-mono">{open.current}</div>
                  </div>
                  <div className="rounded border p-3 bg-zinc-50">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Target</div>
                    <div className="text-lg font-bold text-navy font-mono">{open.target}</div>
                  </div>
                  <div className="rounded border p-3 bg-zinc-50">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Status</div>
                    <div className={`inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                      open.status === "ok" ? "bg-green-100 text-green-800" :
                      open.status === "warn" ? "bg-amber-100 text-amber-900" :
                      "bg-zinc-100 text-zinc-700"
                    }`}>{open.status === "ok" ? "✅ OK" : open.status === "warn" ? "⚠️ WARNING" : "⏸️ NOT ACTIVE"}</div>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-bold text-navy uppercase tracking-wider mb-1">Executive Summary</h3>
                  <p className="text-sm text-zinc-700">{open.report.summary}</p>
                </div>

                <div>
                  <h3 className="text-xs font-bold text-navy uppercase tracking-wider mb-1">Findings</h3>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-zinc-700">
                    {open.report.findings.map((f, i) => <li key={i}>{f}</li>)}
                  </ul>
                </div>

                <div className="rounded border-l-4 border-gold bg-amber-50 p-3">
                  <h3 className="text-xs font-bold text-navy uppercase tracking-wider mb-1">Recommendation</h3>
                  <p className="text-sm text-zinc-800">{open.report.recommendation}</p>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(null)}>Close</Button>
                <Button
                  className="bg-navy text-navy-foreground hover:bg-navy/90"
                  onClick={() => {
                    toast.success(`✓ Report sent to ${open.report.owner}.`);
                    setOpen(null);
                  }}
                >
                  Send to Senior Director
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
