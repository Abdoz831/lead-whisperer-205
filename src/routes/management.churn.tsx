import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageHeader } from "@/components/elip/UI";
import { useElip, rlmName } from "@/lib/elip-data";

export const Route = createFileRoute("/management/churn")({
  component: Churn,
});

function Churn() {
  const { leads, acknowledged, acknowledge, updateLead } = useElip();
  const churn = leads.filter(l => l.last_update_hours >= 48 && !["Closed Won", "RLM-Expired"].includes(l.current_status));

  return (
    <>
      <PageHeader title="Churn Alert Queue" subtitle="Leads stagnant for 48+ hours without a status update. Action required." />
      <div className="p-6">
        <div className="elip-card overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-zinc-50 text-zinc-600 text-[11px] uppercase tracking-wider">
              <tr>
                {["Customer", "Company", "RLM", "Days Stagnant", "Stage", "Amount (JOD)", "Alert", "Actions"].map(h => <th key={h} className="text-left px-3 py-2 font-semibold">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {churn.length === 0 && <tr><td colSpan={8} className="text-center p-8 text-muted-foreground">No churn alerts.</td></tr>}
              {churn.map(l => {
                const days = Math.round(l.last_update_hours / 24);
                const alert = days >= 60 ? { c: "bg-red-600 text-white", t: "🔴 CRITICAL STALL" } : days >= 14 ? { c: "bg-red-100 text-red-900", t: "🔴 48H CHURN" } : { c: "bg-amber-100 text-amber-900", t: "🟡 REVIEW" };
                const ack = acknowledged.has(l.lead_id);
                return (
                  <tr key={l.lead_id} className={`border-t ${ack ? "opacity-60" : "hover:bg-zinc-50"}`}>
                    <td className="px-3 py-2 font-semibold text-navy">{l.customer_name}</td>
                    <td className="px-3 py-2">{l.company_name}</td>
                    <td className="px-3 py-2">{rlmName(l.assigned_rlm)}</td>
                    <td className="px-3 py-2 font-bold tabular-nums">{days}d</td>
                    <td className="px-3 py-2">{l.current_status}</td>
                    <td className="px-3 py-2 tabular-nums">{l.financing_amount.toLocaleString()}</td>
                    <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${alert.c}`}>{alert.t}</span></td>
                    <td className="px-3 py-2 flex gap-1">
                      <button disabled={ack} onClick={() => { acknowledge(l.lead_id); toast.success("Alert acknowledged"); }} className="border border-zinc-300 px-2 py-1 rounded text-[10px] font-semibold disabled:opacity-50">{ack ? "Acknowledged" : "Acknowledge"}</button>
                      <button onClick={() => toast.warning("Escalated to CRO/CFO visibility tier")} className="bg-amber-500 text-white px-2 py-1 rounded text-[10px] font-semibold">Escalate</button>
                      <button onClick={() => { updateLead(l.lead_id, { assigned_rlm: "rlm-002" }); toast.success("Lead reassigned"); }} className="bg-navy text-navy-foreground px-2 py-1 rounded text-[10px] font-semibold">Reassign</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
