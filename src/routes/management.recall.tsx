import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageHeader } from "@/components/elip/UI";
import { useElip, rlmName } from "@/lib/elip-data";

export const Route = createFileRoute("/management/recall")({
  component: ReCallSchedule,
});

function ReCallSchedule() {
  const { leads, updateLead } = useElip();
  const recall = leads.filter(l => l.current_status === "No Answer");

  return (
    <>
      <PageHeader title="No Answer Re-Call Schedule" subtitle="Leads queued for next optimal call window. System notifies RLM 15 minutes before each window." />
      <div className="p-6">
        <div className="elip-card overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-zinc-50 text-zinc-600 text-[11px] uppercase tracking-wider">
              <tr>{["Customer", "Company", "RLM", "Next Window", "Attempt", "Max", "Best Time Logic", "Actions"].map(h => <th key={h} className="text-left px-3 py-2 font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody>
              {recall.length === 0 && <tr><td colSpan={8} className="text-center p-8 text-muted-foreground">No leads in re-call schedule.</td></tr>}
              {recall.map(l => (
                <tr key={l.lead_id} className="border-t hover:bg-zinc-50">
                  <td className="px-3 py-2 font-semibold text-navy">{l.customer_name}</td>
                  <td className="px-3 py-2">{l.company_name}</td>
                  <td className="px-3 py-2">{rlmName(l.assigned_rlm)}</td>
                  <td className="px-3 py-2"><span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-semibold">{l.best_time_to_call}</span></td>
                  <td className="px-3 py-2 font-semibold">{l.no_answer_attempts}</td>
                  <td className="px-3 py-2 text-muted-foreground">3</td>
                  <td className="px-3 py-2 text-muted-foreground italic text-[11px]">Auto-detected from company name</td>
                  <td className="px-3 py-2">
                    <button onClick={() => { updateLead(l.lead_id, { current_status: "Docs Pending" }); toast.success("Lead expedited to top of queue"); }} className="bg-navy text-navy-foreground px-3 py-1 rounded text-[11px] font-semibold">Expedite Call</button>
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
