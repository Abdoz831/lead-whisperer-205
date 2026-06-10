import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/elip/UI";
import { useElip, rlmName } from "@/lib/elip-data";

export const Route = createFileRoute("/management/salvage")({
  component: Salvage,
});

function Salvage() {
  const { leads } = useElip();
  const salvage = leads.filter(l => l.affiliate_redirect || l.group_salvage_status);

  return (
    <>
      <PageHeader title="Group Salvage Pipeline" subtitle="Rejected leads redirected to sister institutions. Track recovery rate — target 20%." />
      <div className="p-6 space-y-4">
        <div className="elip-card p-4 flex items-center justify-between">
          <div className="text-sm font-semibold text-navy">{salvage.length} of {salvage.length} eligible leads redirected — Target: 20%</div>
          <div className="text-xs text-muted-foreground">Phase 3 activation pending</div>
        </div>

        <div className="rounded border-l-4 border-amber-500 bg-amber-50 p-4 text-xs">
          ⚠️ Group Salvage requires legal sign-off before activation. Legal opinion on CBJ compliance and PDPL conformity is a mandatory condition. <strong>Status: In progress.</strong>
        </div>

        <div className="elip-card overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-zinc-50 text-zinc-600 text-[11px] uppercase tracking-wider">
              <tr>{["Lead ID", "Customer", "Reason", "Amount", "Referred By", "Affiliate", "Status", "Date"].map(h => <th key={h} className="text-left px-3 py-2 font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody>
              {salvage.length === 0 && <tr><td colSpan={8} className="text-center p-8 text-muted-foreground">No leads in Group Salvage pipeline yet.</td></tr>}
              {salvage.map(l => (
                <tr key={l.lead_id} className="border-t">
                  <td className="px-3 py-2 font-mono">{l.lead_id}</td>
                  <td className="px-3 py-2 font-semibold text-navy">{l.customer_name}</td>
                  <td className="px-3 py-2">{l.closing_blocker || "RLM-Reject"}</td>
                  <td className="px-3 py-2 tabular-nums">JOD {l.financing_amount.toLocaleString()}</td>
                  <td className="px-3 py-2">{rlmName(l.assigned_rlm)}</td>
                  <td className="px-3 py-2">Etihad Group</td>
                  <td className="px-3 py-2"><span className="px-2 py-0.5 rounded bg-blue-100 text-blue-900 text-[10px] font-semibold">{l.group_salvage_status || "Pending Consent"}</span></td>
                  <td className="px-3 py-2 text-muted-foreground">{new Date(l.submitted_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
