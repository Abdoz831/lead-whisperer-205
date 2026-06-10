import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/elip/UI";
import { useElip, rlmName } from "@/lib/elip-data";

export const Route = createFileRoute("/sales/ledger")({
  component: Ledger,
});

function Ledger() {
  const { leads } = useElip();
  const ledger = leads.filter((l) => l.outcome === "closed_won" || l.current_status === "Closed Won" || l.current_status === "RLM-Reject" || l.current_status === "RLM-Expired" || l.current_status === "Approved");

  return (
    <>
      <PageHeader title="Processed Ledger" subtitle="Immutable record of all closed outcomes. No edits permitted." />
      <div className="p-6">
        <div className="elip-card overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-zinc-50 text-zinc-600 text-[11px] uppercase tracking-wider">
              <tr>
                {["Lead ID", "Customer", "Product", "Deal (JOD)", "RLM", "Outcome", "Date", "Notes"].map(h => (
                  <th key={h} className="text-left px-3 py-2 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ledger.map((l) => {
                const outcomeLabel = l.outcome === "closed_won" || l.current_status === "Closed Won" || l.current_status === "Approved" ? "Closed Won" :
                  l.current_status === "RLM-Reject" ? (l.affiliate_redirect ? "Redirected to Group" : "RLM-Reject") :
                  l.current_status === "RLM-Expired" ? "Expired-Unrecovered" : l.current_status;
                const tone = outcomeLabel.includes("Closed") ? "bg-green-100 text-green-900" :
                  outcomeLabel === "Redirected to Group" ? "bg-blue-100 text-blue-900" :
                  outcomeLabel.includes("Expired") ? "bg-zinc-200 text-zinc-700" : "bg-red-100 text-red-900";
                return (
                  <tr key={l.lead_id} className="border-t hover:bg-zinc-50">
                    <td className="px-3 py-2 font-mono">{l.lead_id}</td>
                    <td className="px-3 py-2 font-semibold text-navy">{l.customer_name}</td>
                    <td className="px-3 py-2">{l.product}</td>
                    <td className="px-3 py-2 tabular-nums">{l.financing_amount.toLocaleString()}</td>
                    <td className="px-3 py-2">{rlmName(l.assigned_rlm)}</td>
                    <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${tone}`}>{outcomeLabel}</span></td>
                    <td className="px-3 py-2 text-muted-foreground">{new Date(l.submitted_at).toLocaleDateString()}</td>
                    <td className="px-3 py-2 text-muted-foreground truncate max-w-xs">{l.rlm_notes || l.cc_notes.slice(0, 60) + "..."}</td>
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
