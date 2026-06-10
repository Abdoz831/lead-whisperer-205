import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader, ScoreCircle } from "@/components/elip/UI";
import { CCNotesPanel } from "@/components/elip/CCNotesPanel";
import { useElip, rlmName, priorityClass } from "@/lib/elip-data";

export const Route = createFileRoute("/sales/queue")({
  component: Queue,
});

function Queue() {
  const { leads, updateLead, currentUser } = useElip();
  const [expanded, setExpanded] = useState<string | null>(null);
  const queue = leads
    .filter((l) => l.current_status === "Queued")
    .sort((a, b) => b.ai_score - a.ai_score);

  function accept(id: string) {
    updateLead(id, { current_status: "Docs Pending", assigned_rlm: currentUser.id.startsWith("rlm") ? currentUser.id : "rlm-001" });
    toast.success("Lead accepted — now in Active Pipeline");
  }

  return (
    <>
      <PageHeader title="Sales Pipeline — Leads Queue" subtitle="Your leads are pre-briefed. Read the call notes before every call." />
      <div className="p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-navy">Leads Queue</h2>
          <span className="text-xs text-muted-foreground">{queue.length} warm leads from Contact Centre — click any row to read call notes first.</span>
        </div>

        <div className="elip-card overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-zinc-50 text-zinc-600 text-[11px] uppercase tracking-wider">
              <tr>
                {["", "Lead ID", "Customer", "Company", "Product", "Amount", "Score", "Priority", "Channel", "Best Time", "Received", ""].map((h) => (
                  <th key={h} className="text-left px-3 py-2 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {queue.length === 0 && (
                <tr><td colSpan={12} className="text-center p-8 text-muted-foreground">No leads in queue. Contact Centre is capturing — new leads will appear here automatically.</td></tr>
              )}
              {queue.map((l) => (
                <>
                  <tr key={l.lead_id} className="border-t hover:bg-zinc-50 cursor-pointer" onClick={() => setExpanded(expanded === l.lead_id ? null : l.lead_id)}>
                    <td className="px-3 py-2 text-muted-foreground">{expanded === l.lead_id ? "▾" : "▸"}</td>
                    <td className="px-3 py-2 font-mono">{l.lead_id}</td>
                    <td className="px-3 py-2 font-semibold text-navy">{l.customer_name}</td>
                    <td className="px-3 py-2">{l.company_name}</td>
                    <td className="px-3 py-2">{l.product}</td>
                    <td className="px-3 py-2 tabular-nums">JOD {l.financing_amount.toLocaleString()}</td>
                    <td className="px-3 py-2"><ScoreCircle score={l.ai_score} priority={l.priority} /></td>
                    <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${priorityClass(l.priority)}`}>{l.priority}</span></td>
                    <td className="px-3 py-2 text-muted-foreground">{l.channel}</td>
                    <td className="px-3 py-2 text-[11px]">{l.best_time_to_call}</td>
                    <td className="px-3 py-2 text-muted-foreground">{new Date(l.submitted_at).toLocaleDateString()}</td>
                    <td className="px-3 py-2">
                      <button onClick={(e) => { e.stopPropagation(); accept(l.lead_id); }} className="bg-navy text-navy-foreground px-3 py-1 rounded text-[11px] font-semibold">Accept Lead</button>
                    </td>
                  </tr>
                  {expanded === l.lead_id && (
                    <tr className="bg-zinc-50/50">
                      <td colSpan={12} className="p-4">
                        <CCNotesPanel lead={l} />
                        <div className="text-[11px] text-muted-foreground">Routed to: <strong>{rlmName(l.assigned_rlm)}</strong> · LPW {l.lpw_multiplier}x · Score reason: {scoreReason(l)}</div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function scoreReason(l: { product: string; company_name: string; financing_amount: number }) {
  const parts: string[] = [l.product];
  if (/وزارة|ministry|government/i.test(l.company_name)) parts.push("Government employer");
  if (l.financing_amount >= 100000) parts.push("High capacity");
  return parts.join(" + ");
}
