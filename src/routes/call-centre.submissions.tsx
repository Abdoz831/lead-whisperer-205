import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/elip/UI";
import { useElip, rlmName, priorityClass } from "@/lib/elip-data";

export const Route = createFileRoute("/call-centre/submissions")({
  component: Submissions,
});

function Submissions() {
  const { leads, currentUser } = useElip();
  const mine = leads.filter((l) => l.submitted_by_agent === currentUser.id);
  const weekAgo = Date.now() - 7 * 86400000;
  const thisWeek = mine.filter((l) => new Date(l.submitted_at).getTime() >= weekAgo);

  return (
    <>
      <PageHeader title="My Submissions" subtitle="Read-only view of leads you've submitted, with AI scoring and Sales outcomes." />
      <div className="p-6">
        <div className="grid grid-cols-4 gap-4 mb-5">
          <Stat label="Today" value={mine.filter(l => new Date(l.submitted_at).toDateString() === new Date().toDateString()).length} />
          <Stat label="This Week" value={thisWeek.length} />
          <Stat label="Avg Score" value={mine.length ? Math.round(mine.reduce((s, l) => s + l.ai_score, 0) / mine.length) : 0} />
          <Stat label="P1 Submitted" value={mine.filter(l => l.priority === "P1").length} />
        </div>

        <div className="elip-card overflow-hidden">
          <div className="px-4 py-3 border-b bg-card flex items-center justify-between">
            <h2 className="text-sm font-bold text-navy">My Submissions</h2>
            <span className="text-xs bg-gold text-gold-foreground px-2 py-0.5 rounded font-semibold">{thisWeek.length} leads this week</span>
          </div>
          <table className="w-full text-xs">
            <thead className="bg-zinc-50 text-zinc-600 text-[11px] uppercase tracking-wider">
              <tr>
                {["Lead ID", "Customer", "Company", "Product", "Amount (JOD)", "AI Score", "Priority", "Assigned RLM", "Submitted", "Sales Status"].map((h) => (
                  <th key={h} className="text-left px-3 py-2 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mine.length === 0 && (
                <tr><td colSpan={10} className="text-center p-6 text-muted-foreground">No submissions yet. Use New Lead Entry to capture a lead.</td></tr>
              )}
              {mine.map((l) => (
                <tr key={l.lead_id} className="border-t hover:bg-zinc-50">
                  <td className="px-3 py-2 font-mono">{l.lead_id}</td>
                  <td className="px-3 py-2 font-semibold text-navy">{l.customer_name}</td>
                  <td className="px-3 py-2">{l.company_name}</td>
                  <td className="px-3 py-2">{l.product}</td>
                  <td className="px-3 py-2 tabular-nums">{l.financing_amount.toLocaleString()}</td>
                  <td className="px-3 py-2 font-semibold">{l.ai_score}</td>
                  <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${priorityClass(l.priority)}`}>{l.priority}</span></td>
                  <td className="px-3 py-2">{rlmName(l.assigned_rlm)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{new Date(l.submitted_at).toLocaleDateString()}</td>
                  <td className="px-3 py-2">{l.current_status === "Queued" ? <span className="text-muted-foreground italic">Awaiting Sales</span> : l.current_status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="elip-card p-4">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</div>
      <div className="text-2xl font-bold text-navy mt-1">{value}</div>
    </div>
  );
}
