import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageHeader } from "@/components/elip/UI";
import { useElip } from "@/lib/elip-data";

export const Route = createFileRoute("/management/reactivation")({
  component: ReActivation,
});

function ReActivation() {
  const { leads, updateLead } = useElip();
  const expired = leads.filter(l => l.current_status === "RLM-Expired" || l.last_update_hours >= 30 * 24);

  return (
    <>
      <PageHeader title="Re-Activation Queue" subtitle="Expired leads (30+ days inactive). Never permanently deleted — always recoverable." />
      <div className="p-6">
        <div className="elip-card overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-zinc-50 text-zinc-600 text-[11px] uppercase tracking-wider">
              <tr>{["Lead ID", "Customer", "Company", "Amount", "Days Expired", "Reason", "Actions"].map(h => <th key={h} className="text-left px-3 py-2 font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody>
              {expired.length === 0 && <tr><td colSpan={7} className="text-center p-8 text-muted-foreground">No expired leads.</td></tr>}
              {expired.map(l => (
                <tr key={l.lead_id} className="border-t hover:bg-zinc-50">
                  <td className="px-3 py-2 font-mono">{l.lead_id}</td>
                  <td className="px-3 py-2 font-semibold text-navy">{l.customer_name}</td>
                  <td className="px-3 py-2">{l.company_name}</td>
                  <td className="px-3 py-2 tabular-nums">JOD {l.financing_amount.toLocaleString()}</td>
                  <td className="px-3 py-2 font-bold">{Math.round(l.last_update_hours / 24)}d</td>
                  <td className="px-3 py-2 text-muted-foreground">{l.closing_blocker || "No activity"}</td>
                  <td className="px-3 py-2 flex gap-1">
                    <button onClick={() => { updateLead(l.lead_id, { current_status: "Docs Pending", last_update_hours: 0 }); toast.success("Lead re-activated and back in pipeline"); }} className="bg-green-600 text-white px-2 py-1 rounded text-[10px] font-semibold">Move to Active</button>
                    <button onClick={() => { updateLead(l.lead_id, { current_status: "RLM-Expired", outcome: "rlm_expired" }); toast.info("Moved to Processed Ledger"); }} className="bg-zinc-600 text-white px-2 py-1 rounded text-[10px] font-semibold">Final Close</button>
                    <button onClick={() => { updateLead(l.lead_id, { assigned_rlm: "rlm-003" }); toast.success("Reassigned"); }} className="border border-zinc-300 px-2 py-1 rounded text-[10px] font-semibold">Reassign</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
