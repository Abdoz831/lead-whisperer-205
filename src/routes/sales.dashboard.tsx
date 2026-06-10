import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/elip/UI";
import { useElip, rlmName, type Stage } from "@/lib/elip-data";

export const Route = createFileRoute("/sales/dashboard")({
  component: SalesDashboard,
});

const PHASES: { key: Stage | "Active" | "Queued"; label: string; tone: string }[] = [
  { key: "Queued", label: "Queued", tone: "bg-zinc-100 text-zinc-800 border-zinc-300" },
  { key: "No Answer", label: "Re-Call", tone: "bg-amber-100 text-amber-900 border-amber-300" },
  { key: "Follow-up Scheduled", label: "Follow-up", tone: "bg-sky-100 text-sky-900 border-sky-300" },
  { key: "Docs Pending", label: "Docs Pending", tone: "bg-indigo-100 text-indigo-900 border-indigo-300" },
  { key: "Booked", label: "Booked", tone: "bg-purple-100 text-purple-900 border-purple-300" },
  { key: "Underwriting", label: "Underwriting", tone: "bg-blue-100 text-blue-900 border-blue-300" },
  { key: "Approved", label: "Approved", tone: "bg-emerald-100 text-emerald-900 border-emerald-300" },
  { key: "Closed Won", label: "Closed Won", tone: "bg-green-200 text-green-900 border-green-400" },
  { key: "Rejected", label: "Rejected", tone: "bg-rose-100 text-rose-900 border-rose-300" },
];

function hoursAgo(h: number): string {
  if (h < 1) return "just now";
  if (h < 24) return `${Math.round(h)}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function SalesDashboard() {
  const { leads, updateLead } = useElip();

  const stats = useMemo(() => {
    const totalAmount = leads.reduce((s, l) => s + (l.financing_amount || 0), 0);
    const won = leads.filter((l) => l.outcome === "closed_won");
    const wonAmount = won.reduce((s, l) => s + l.financing_amount, 0);
    const active = leads.filter(
      (l) => !["Closed Won", "Approved", "Rejected", "RLM-Reject", "RLM-Expired"].includes(l.current_status),
    );
    const hot = leads.filter((l) => l.deal_temperature === "Hot");
    const p1 = leads.filter((l) => l.priority === "P1");
    const conversion = leads.length ? (won.length / leads.length) * 100 : 0;
    return { totalAmount, won, wonAmount, active, hot, p1, conversion };
  }, [leads]);

  const phaseCounts = useMemo(() => {
    const map = new Map<string, { count: number; amount: number }>();
    for (const p of PHASES) map.set(p.key as string, { count: 0, amount: 0 });
    for (const l of leads) {
      const k = l.current_status;
      const cur = map.get(k) ?? { count: 0, amount: 0 };
      cur.count += 1;
      cur.amount += l.financing_amount || 0;
      map.set(k, cur);
    }
    return map;
  }, [leads]);

  const recall = useMemo(
    () =>
      leads
        .filter((l) => l.current_status === "No Answer")
        .sort((a, b) => (b.no_answer_attempts || 0) - (a.no_answer_attempts || 0)),
    [leads],
  );

  const followUps = useMemo(
    () =>
      leads
        .filter((l) => l.current_status === "Follow-up Scheduled")
        .sort((a, b) => a.last_update_hours - b.last_update_hours),
    [leads],
  );

  const queueLowPrio = useMemo(
    () =>
      leads
        .filter(
          (l) =>
            l.current_status === "Queued" && (l.priority === "P3" || l.priority === "P4"),
        )
        .sort((a, b) => (b.ai_score || 0) - (a.ai_score || 0)),
    [leads],
  );

  const ledger = useMemo(
    () =>
      leads
        .filter(
          (l) =>
            l.outcome === "closed_won" ||
            l.current_status === "Closed Won" ||
            l.current_status === "RLM-Reject" ||
            l.current_status === "RLM-Expired" ||
            l.current_status === "Approved",
        )
        .sort((a, b) => (b.submitted_at || "").localeCompare(a.submitted_at || "")),
    [leads],
  );




  return (
    <>
      <PageHeader
        title="Sales Pipeline Dashboard"
        subtitle="Single source of truth — pipeline phases, follow-ups and re-call queue at a glance."
      />
      <div className="p-6 space-y-6">
        {/* KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KPI label="Total Leads" value={leads.length.toString()} accent="navy" />
          <KPI label="Active in Pipeline" value={stats.active.length.toString()} accent="navy" />
          <KPI label="P1 Priority" value={stats.p1.length.toString()} accent="gold" />
          <KPI label="Hot Deals" value={stats.hot.length.toString()} accent="rose" />
          <KPI
            label="Conversion"
            value={`${stats.conversion.toFixed(1)}%`}
            sub={`Won JOD ${stats.wonAmount.toLocaleString()}`}
            accent="emerald"
          />
        </div>

        {/* Phases */}
        <div className="elip-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-navy text-sm">Pipeline Phases</h3>
            <div className="text-[11px] text-muted-foreground">
              Total pipeline value:{" "}
              <span className="font-semibold text-navy">JOD {stats.totalAmount.toLocaleString()}</span>
            </div>
          </div>
          <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-2">
            {PHASES.map((p) => {
              const c = phaseCounts.get(p.key as string) ?? { count: 0, amount: 0 };
              return (
                <div key={p.key} className={`rounded border ${p.tone} px-2 py-2`}>
                  <div className="text-[10px] uppercase tracking-wider font-semibold opacity-80">{p.label}</div>
                  <div className="text-xl font-black tabular-nums leading-tight">{c.count}</div>
                  <div className="text-[10px] tabular-nums opacity-80">JOD {c.amount.toLocaleString()}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recall queue + Follow-ups */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="elip-card overflow-hidden">
            <div className="px-4 py-3 border-b bg-amber-50 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-navy text-sm">📞 Re-Call Queue</h3>
                <p className="text-[11px] text-muted-foreground">
                  Leads marked No Answer — last call time tracked, next optimal window suggested.
                </p>
              </div>
              <span className="text-xs font-semibold bg-amber-200 text-amber-900 px-2 py-0.5 rounded">
                {recall.length}
              </span>
            </div>
            <table className="w-full text-xs">
              <thead className="bg-zinc-50 text-zinc-600 text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">Customer</th>
                  <th className="text-left px-3 py-2 font-semibold">RLM</th>
                  <th className="text-left px-3 py-2 font-semibold">Last Call</th>
                  <th className="text-left px-3 py-2 font-semibold">Next Window</th>
                  <th className="text-left px-3 py-2 font-semibold">Att.</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {recall.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center p-6 text-muted-foreground text-xs">
                      No leads in re-call queue.
                    </td>
                  </tr>
                )}
                {recall.map((l) => (
                  <tr key={l.lead_id} className="border-t hover:bg-zinc-50">
                    <td className="px-3 py-2">
                      <div className="font-semibold text-navy">{l.customer_name}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {l.product} · JOD {l.financing_amount.toLocaleString()}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-[11px]">{rlmName(l.assigned_rlm)}</td>
                    <td className="px-3 py-2 text-[11px] text-muted-foreground tabular-nums">
                      {hoursAgo(l.last_update_hours)}
                    </td>
                    <td className="px-3 py-2">
                      <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-semibold">
                        {l.best_time_to_call}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-semibold tabular-nums">
                      {l.no_answer_attempts}
                      <span className="text-muted-foreground">/3</span>
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => {
                          updateLead(l.lead_id, { current_status: "Docs Pending" });
                          toast.success("Lead moved back to Active Pipeline");
                        }}
                        className="bg-navy text-navy-foreground px-2 py-1 rounded text-[10px] font-semibold"
                      >
                        Expedite
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="elip-card overflow-hidden">
            <div className="px-4 py-3 border-b bg-sky-50 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-navy text-sm">📅 Follow-up List</h3>
                <p className="text-[11px] text-muted-foreground">
                  Scheduled call-backs — last touch tracked so nothing slips.
                </p>
              </div>
              <span className="text-xs font-semibold bg-sky-200 text-sky-900 px-2 py-0.5 rounded">
                {followUps.length}
              </span>
            </div>
            <table className="w-full text-xs">
              <thead className="bg-zinc-50 text-zinc-600 text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">Customer</th>
                  <th className="text-left px-3 py-2 font-semibold">RLM</th>
                  <th className="text-left px-3 py-2 font-semibold">Last Call</th>
                  <th className="text-left px-3 py-2 font-semibold">Best Time</th>
                </tr>
              </thead>
              <tbody>
                {followUps.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-center p-6 text-muted-foreground text-xs">
                      No scheduled follow-ups.
                    </td>
                  </tr>
                )}
                {followUps.map((l) => (
                  <tr key={l.lead_id} className="border-t hover:bg-zinc-50">
                    <td className="px-3 py-2">
                      <div className="font-semibold text-navy">{l.customer_name}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {l.product} · JOD {l.financing_amount.toLocaleString()}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-[11px]">{rlmName(l.assigned_rlm)}</td>
                    <td className="px-3 py-2 text-[11px] text-muted-foreground tabular-nums">
                      {hoursAgo(l.last_update_hours)}
                    </td>
                    <td className="px-3 py-2">
                      <span className="px-2 py-0.5 rounded bg-sky-100 text-sky-900 text-[10px] font-semibold">
                        {l.best_time_to_call}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Leads Queue — P3 / P4 awaiting manual review */}
        <div className="elip-card overflow-hidden">
          <div className="px-4 py-3 border-b bg-zinc-50 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-navy text-sm">📥 Leads Queue — P3 / P4 (Manual Review)</h3>
              <p className="text-[11px] text-muted-foreground">
                Lower-priority leads waiting in the Sales Queue. P1 / P2 are auto-accepted into Active Pipeline.
              </p>
            </div>
            <span className="text-xs font-semibold bg-zinc-200 text-zinc-800 px-2 py-0.5 rounded">
              {queueLowPrio.length}
            </span>
          </div>
          <table className="w-full text-xs">
            <thead className="bg-zinc-50 text-zinc-600 text-[10px] uppercase tracking-wider">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">Priority</th>
                <th className="text-left px-3 py-2 font-semibold">Customer</th>
                <th className="text-left px-3 py-2 font-semibold">Company</th>
                <th className="text-left px-3 py-2 font-semibold">Product</th>
                <th className="text-left px-3 py-2 font-semibold">Amount</th>
                <th className="text-left px-3 py-2 font-semibold">AI Score</th>
                <th className="text-left px-3 py-2 font-semibold">Best Time</th>
              </tr>
            </thead>
            <tbody>
              {queueLowPrio.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center p-6 text-muted-foreground text-xs">
                    No P3 / P4 leads waiting in queue.
                  </td>
                </tr>
              )}
              {queueLowPrio.map((l) => (
                <tr key={l.lead_id} className="border-t hover:bg-zinc-50">
                  <td className="px-3 py-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        l.priority === "P3"
                          ? "bg-amber-100 text-amber-900"
                          : "bg-zinc-200 text-zinc-800"
                      }`}
                    >
                      {l.priority}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-semibold text-navy">{l.customer_name}</td>
                  <td className="px-3 py-2 text-[11px]">{l.company_name}</td>
                  <td className="px-3 py-2 text-[11px]">{l.product}</td>
                  <td className="px-3 py-2 tabular-nums text-[11px]">
                    JOD {l.financing_amount.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 font-semibold tabular-nums">{l.ai_score}</td>
                  <td className="px-3 py-2">
                    <span className="px-2 py-0.5 rounded bg-zinc-100 text-zinc-800 text-[10px] font-semibold">
                      {l.best_time_to_call}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>


        {/* Processed Ledger — immutable closed outcomes */}
        <div className="elip-card overflow-hidden">
          <div className="px-4 py-3 border-b bg-emerald-50 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-navy text-sm">📒 Processed Ledger</h3>
              <p className="text-[11px] text-muted-foreground">
                Immutable record of all closed outcomes — wins, rejects and expired. No edits permitted.
              </p>
            </div>
            <span className="text-xs font-semibold bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded">
              {ledger.length}
            </span>
          </div>
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-zinc-50 text-zinc-600 text-[10px] uppercase tracking-wider sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">Lead ID</th>
                  <th className="text-left px-3 py-2 font-semibold">Customer</th>
                  <th className="text-left px-3 py-2 font-semibold">Product</th>
                  <th className="text-left px-3 py-2 font-semibold">Deal (JOD)</th>
                  <th className="text-left px-3 py-2 font-semibold">RLM</th>
                  <th className="text-left px-3 py-2 font-semibold">Outcome</th>
                  <th className="text-left px-3 py-2 font-semibold">Date</th>
                </tr>
              </thead>
              <tbody>
                {ledger.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center p-6 text-muted-foreground text-xs">
                      No processed outcomes yet.
                    </td>
                  </tr>
                )}
                {ledger.map((l) => {
                  const outcomeLabel =
                    l.outcome === "closed_won" ||
                    l.current_status === "Closed Won" ||
                    l.current_status === "Approved"
                      ? "Closed Won"
                      : l.current_status === "RLM-Reject"
                        ? l.affiliate_redirect
                          ? "Redirected to Group"
                          : "RLM-Reject"
                        : l.current_status === "RLM-Expired"
                          ? "Expired-Unrecovered"
                          : l.current_status;
                  const tone = outcomeLabel.includes("Closed")
                    ? "bg-green-100 text-green-900"
                    : outcomeLabel === "Redirected to Group"
                      ? "bg-blue-100 text-blue-900"
                      : outcomeLabel.includes("Expired")
                        ? "bg-zinc-200 text-zinc-700"
                        : "bg-red-100 text-red-900";
                  return (
                    <tr key={l.lead_id} className="border-t hover:bg-zinc-50">
                      <td className="px-3 py-2 font-mono text-[10px]">{l.lead_id}</td>
                      <td className="px-3 py-2 font-semibold text-navy">{l.customer_name}</td>
                      <td className="px-3 py-2 text-[11px]">{l.product}</td>
                      <td className="px-3 py-2 tabular-nums text-[11px]">
                        {l.financing_amount.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-[11px]">{rlmName(l.assigned_rlm)}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${tone}`}>
                          {outcomeLabel}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground text-[11px] tabular-nums">
                        {new Date(l.submitted_at).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex gap-3 text-xs">

          <Link
            to="/sales/queue"
            className="bg-navy text-navy-foreground px-3 py-2 rounded font-semibold"
          >
            Go to Leads Queue →
          </Link>
          <Link
            to="/sales/pipeline"
            className="bg-card border px-3 py-2 rounded font-semibold text-navy"
          >
            Open Active Pipeline →
          </Link>
        </div>
      </div>
    </>
  );
}

function KPI({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent: "navy" | "gold" | "rose" | "emerald";
}) {
  const accentClass: Record<typeof accent, string> = {
    navy: "border-l-navy",
    gold: "border-l-gold",
    rose: "border-l-rose-500",
    emerald: "border-l-emerald-500",
  };
  return (
    <div className={`elip-card p-3 border-l-4 ${accentClass[accent]}`}>
      <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">{label}</div>
      <div className="text-2xl font-black text-navy tabular-nums leading-tight">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}
