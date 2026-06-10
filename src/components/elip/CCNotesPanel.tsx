import type { Lead } from "@/lib/elip-data";

export function CCNotesPanel({ lead, agentName }: { lead: Lead; agentName?: string }) {
  const incomplete = (lead.cc_notes ?? "").trim().length < 20;
  return (
    <div
      className="rounded-md p-4 mb-4"
      style={{
        background: "var(--cc-bg)",
        borderLeft: "3px solid var(--cc-border)",
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="font-bold text-navy text-sm">📋 CONTACT CENTRE CALL NOTES</div>
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Read-only — Contact Centre data</span>
      </div>
      <div className="text-xs text-muted-foreground border-b border-blue-200/50 pb-2 mb-2">
        Captured by: {agentName ?? lead.submitted_by_agent} ·{" "}
        {new Date(lead.submitted_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} ·{" "}
        {new Date(lead.submitted_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
      </div>
      <p className="italic text-[13px] text-zinc-800 leading-relaxed whitespace-pre-wrap">
        {lead.cc_notes || "(no notes captured)"}
      </p>
      {incomplete && (
        <div className="mt-3 text-xs text-red-700 font-semibold">
          ⚠️ Incomplete call notes — contact the submitting agent before calling
        </div>
      )}
      <div className="mt-3 pt-2 border-t border-blue-200/50 text-xs text-zinc-700 grid grid-cols-2 gap-2">
        <div><span className="text-muted-foreground">Product:</span> <strong>{lead.product}</strong></div>
        <div><span className="text-muted-foreground">Amount:</span> <strong>JOD {lead.financing_amount.toLocaleString()}</strong></div>
        <div><span className="text-muted-foreground">Company:</span> <strong>{lead.company_name}</strong></div>
        <div><span className="text-muted-foreground">Income:</span> <strong>JOD {lead.net_income_jod.toLocaleString()}/month</strong></div>
      </div>
    </div>
  );
}
