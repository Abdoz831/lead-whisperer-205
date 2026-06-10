import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader, KPICard, ScoreCircle } from "@/components/elip/UI";
import { CCNotesPanel } from "@/components/elip/CCNotesPanel";
import { useElip, rlmName, stageClass, type Stage, type Lead } from "@/lib/elip-data";
import { enrichLead } from "@/lib/enrich-lead.functions";

export const Route = createFileRoute("/sales/pipeline")({
  component: Pipeline,
});

const STAGE_OPTIONS: Stage[] = ["No Answer", "Follow-up Scheduled", "Docs Pending", "Booked", "Underwriting", "Approved", "Closed Won", "RLM-Reject"];

function Pipeline() {
  const { leads, updateLead } = useElip();
  const enrichFn = useServerFn(enrichLead);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showBriefing, setShowBriefing] = useState<Lead | null>(null);
  const [rejectLead, setRejectLead] = useState<Lead | null>(null);

  async function runEnrich(l: Lead) {
    updateLead(l.lead_id, { enrichment_status: "loading", enrichment_error: "" });
    try {
      const result = await enrichFn({
        data: {
          customer_name: l.customer_name,
          company_name: l.company_name,
          job_title: l.job_title,
          product: l.product,
          financing_amount: l.financing_amount,
          net_income_jod: l.net_income_jod,
          cc_notes: l.cc_notes,
        },
      });
      updateLead(l.lead_id, { enrichment: result, enrichment_status: "idle" });
      setExpanded(l.lead_id);
      toast.success(`Social intel + sales playbook ready for ${l.customer_name}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to enrich lead";
      updateLead(l.lead_id, { enrichment_status: "error", enrichment_error: msg });
      toast.error(msg);
    }
  }

  const active = useMemo(
    () => leads.filter((l) => !["Queued", "Closed Won", "RLM-Reject", "RLM-Expired"].includes(l.current_status) && l.outcome !== "closed_won"),
    [leads]
  );

  const totalActive = active.reduce((s, l) => s + l.financing_amount, 0);
  const closed = leads.filter((l) => l.outcome === "closed_won" || l.current_status === "Approved");
  const totalClosed = closed.reduce((s, l) => s + l.financing_amount, 0);
  const hot = active.filter((l) => l.deal_temperature === "Hot");
  const totalHot = hot.reduce((s, l) => s + l.financing_amount, 0);
  const docs = active.filter((l) => l.current_status === "Docs Pending");
  const totalDocs = docs.reduce((s, l) => s + l.financing_amount, 0);

  function changeStage(id: string, stage: Stage) {
    const patch: Partial<Lead> = { current_status: stage };
    if (stage === "No Answer") {
      patch.no_answer_attempts = (active.find(l => l.lead_id === id)?.no_answer_attempts ?? 0) + 1;
      toast.info("Lead moved to Re-Call Queue with optimal callback window");
    }
    if (stage === "Closed Won") {
      patch.outcome = "closed_won";
      toast.success("Deal closed — moved to Processed Ledger");
    }
    updateLead(id, patch);
  }

  function submitAppian(id: string) {
    toast.loading("Submitting to Appian...", { id: `appian-${id}` });
    setTimeout(() => {
      const ticket = `RLM-${Math.floor(100000 + Math.random() * 900000)}`;
      updateLead(id, { appian_ticket: ticket });
      toast.success(`Submitted. Appian Ticket: ${ticket}`, { id: `appian-${id}` });
    }, 1800);
  }

  function confirmReject(redirect: boolean) {
    if (!rejectLead) return;
    updateLead(rejectLead.lead_id, {
      current_status: "RLM-Reject",
      outcome: "rlm_reject",
      affiliate_redirect: redirect,
      group_salvage_status: redirect ? "Pending Consent" : "",
    });
    toast.success(redirect ? "Lead queued for Group Salvage redirect. Customer will receive consent notification." : "Lead closed as rejected.");
    setRejectLead(null);
  }

  return (
    <>
      <PageHeader title="Sales Pipeline — Active Pipeline" subtitle="Deals in flight. Update stages, log RLM notes, push to close." />
      <div className="p-6">
        <div className="grid grid-cols-4 gap-4 mb-6">
          <KPICard label="Total Active Pipeline" value={`JOD ${totalActive.toLocaleString()}`} sub={`${active.length} active units`} accent="navy" />
          <KPICard label="Total Closed / Approved" value={`JOD ${totalClosed.toLocaleString()}`} sub={`${closed.length} units closed`} accent="green" />
          <KPICard label="Hot Leads" value={`JOD ${totalHot.toLocaleString()}`} sub={`${hot.length} hot leads`} accent="orange" />
          <KPICard label="Docs Pending" value={`JOD ${totalDocs.toLocaleString()}`} sub={`${docs.length} in Docs Pending`} accent="blue" />
        </div>

        <div className="elip-card overflow-hidden">
          <div className="px-4 py-3 border-b bg-card">
            <h2 className="text-sm font-bold text-navy">Active Pipeline</h2>
            <p className="text-xs text-muted-foreground">{active.length} deals in flight.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-zinc-50 text-zinc-600 text-[11px] uppercase tracking-wider">
                <tr>
                  {["", "Customer", "Days", "Product", "RLM", "Deal (JOD)", "Score", "Temp", "Stage", "Blocker", "Social Intel", "Appian", "Actions"].map((h) => (
                    <th key={h} className="text-left px-2 py-2 font-semibold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {active.map((l) => {
                  const churn = l.last_update_hours >= 48;
                  return (
                    <>
                      <tr key={l.lead_id} className="border-t hover:bg-zinc-50">
                        <td className="px-2 py-2"><button className="text-muted-foreground" onClick={() => setExpanded(expanded === l.lead_id ? null : l.lead_id)}>{expanded === l.lead_id ? "▾" : "▸"}</button></td>
                        <td className="px-2 py-2 font-semibold text-navy">
                          {l.customer_name}
                          {churn && <span className="ml-2 inline-block px-1.5 py-0.5 rounded bg-red-600 text-white text-[9px] font-bold">🔴 48H CHURN</span>}
                        </td>
                        <td className="px-2 py-2 tabular-nums">{Math.round(l.last_update_hours / 24)}d</td>
                        <td className="px-2 py-2">{l.product}</td>
                        <td className="px-2 py-2 text-xs">{rlmName(l.assigned_rlm)}</td>
                        <td className="px-2 py-2 tabular-nums font-semibold">{l.financing_amount.toLocaleString()}</td>
                        <td className="px-2 py-2"><ScoreCircle score={l.ai_score} priority={l.priority} /></td>
                        <td className="px-2 py-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            l.deal_temperature === "Hot" ? "bg-green-600 text-white" :
                            l.deal_temperature === "Medium" ? "bg-amber-500 text-white" :
                            l.deal_temperature === "Cold" ? "bg-zinc-500 text-white" : "bg-zinc-200 text-zinc-700"
                          }`}>{l.deal_temperature}</span>
                        </td>
                        <td className="px-2 py-2">
                          <select
                            value={l.current_status}
                            onChange={(e) => changeStage(l.lead_id, e.target.value as Stage)}
                            className={`text-[11px] border rounded px-1.5 py-1 ${stageClass(l.current_status)}`}
                          >
                            {STAGE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-2">
                          {l.closing_blocker && (
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              l.closing_blocker === "Pending Review" ? "bg-orange-100 text-orange-900" : "bg-red-100 text-red-900"
                            }`}>{l.closing_blocker}</span>
                          )}
                        </td>
                        <td className="px-2 py-2">
                          {l.enrichment_status === "loading" ? (
                            <span className="text-[10px] text-muted-foreground italic">Searching…</span>
                          ) : l.enrichment ? (
                            <button
                              onClick={() => setExpanded(expanded === l.lead_id ? null : l.lead_id)}
                              className="text-left max-w-[180px]"
                              title={l.enrichment.professional_profile}
                            >
                              <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold mr-1 ${
                                l.enrichment.confidence === "high" ? "bg-emerald-600 text-white" :
                                l.enrichment.confidence === "medium" ? "bg-amber-500 text-white" :
                                "bg-zinc-400 text-white"
                              }`}>{l.enrichment.confidence.toUpperCase()}</span>
                              <span className="text-[10px] text-navy underline decoration-dotted line-clamp-2">{l.enrichment.professional_profile}</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => runEnrich(l)}
                              className="bg-purple-600 text-white px-2 py-1 rounded text-[10px] font-semibold"
                              title="Search public/social media via Tavily and generate a sales playbook"
                            >🔎 Enrich</button>
                          )}
                        </td>
                        <td className="px-2 py-2 font-mono text-[11px]">
                          {l.appian_ticket || (l.current_status === "Booked" ? (
                            <button onClick={() => submitAppian(l.lead_id)} className="bg-gold text-gold-foreground px-2 py-1 rounded text-[10px] font-semibold">Submit to Appian →</button>
                          ) : <span className="text-muted-foreground">—</span>)}
                        </td>
                        <td className="px-2 py-2 whitespace-nowrap flex gap-1">
                          <button onClick={() => setShowBriefing(l)} className="bg-navy text-navy-foreground px-2 py-1 rounded text-[10px] font-semibold">Call Now</button>
                          <button onClick={() => { if (confirm("Mark as Closed Won? Irreversible.")) changeStage(l.lead_id, "Closed Won"); }} className="bg-green-600 text-white px-2 py-1 rounded text-[10px] font-semibold">Win ✓</button>
                          <button onClick={() => setRejectLead(l)} className="bg-red-600 text-white px-2 py-1 rounded text-[10px] font-semibold">Reject ✗</button>
                        </td>
                      </tr>
                      {expanded === l.lead_id && (
                        <tr className="bg-zinc-50/50">
                          <td colSpan={13} className="p-4 space-y-3">
                            <EnrichmentPanel lead={l} onEnrich={() => runEnrich(l)} />
                            <CCNotesPanel lead={l} />
                            <div className="elip-card p-3">
                              <div className="text-[11px] font-semibold text-navy mb-1">RLM Notes (editable)</div>
                              <textarea
                                defaultValue={l.rlm_notes}
                                onBlur={(e) => updateLead(l.lead_id, { rlm_notes: e.target.value })}
                                rows={3}
                                className="w-full border border-zinc-300 rounded px-2 py-1.5 text-xs"
                                placeholder="Log progress notes — separate from Contact Centre data"
                              />
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showBriefing && (
        <Modal onClose={() => setShowBriefing(null)} title="Pre-Call Briefing">
          <div className="space-y-2 text-sm">
            <div><strong>Customer:</strong> {showBriefing.customer_name}</div>
            <div className="text-xs text-muted-foreground">{showBriefing.company_name} · Income JOD {showBriefing.net_income_jod.toLocaleString()}/month</div>
            <div className="text-xs"><strong>{showBriefing.product}</strong> · JOD {showBriefing.financing_amount.toLocaleString()}</div>
            <div className="text-xs">📞 Best time: {showBriefing.best_time_to_call}</div>
            <hr className="my-2" />
            <EnrichmentPanel lead={showBriefing} />
            <CCNotesPanel lead={showBriefing} />
            {showBriefing.rlm_notes && (
              <div className="text-xs bg-zinc-50 p-3 rounded border"><strong>Previous RLM notes:</strong> {showBriefing.rlm_notes}</div>
            )}
            <div className="flex gap-2 justify-end pt-3 border-t">
              <button onClick={() => setShowBriefing(null)} className="px-3 py-1.5 text-xs border rounded">Cancel</button>
              <button onClick={() => { toast.success("Call started"); setShowBriefing(null); }} className="bg-navy text-navy-foreground px-3 py-1.5 text-xs rounded font-semibold">Start Call →</button>
            </div>
          </div>
        </Modal>
      )}

      {rejectLead && (
        <Modal onClose={() => setRejectLead(null)} title="Reject Lead">
          <p className="text-sm mb-4">
            This lead will be permanently removed from your pipeline. Would you like to redirect to <strong>Group Salvage</strong>? The customer will be referred to a sister institution.
          </p>
          <div className="flex flex-col gap-2">
            <button onClick={() => confirmReject(true)} className="bg-blue-600 text-white px-3 py-2 text-xs rounded font-semibold">Yes — Redirect to Group Salvage</button>
            <button onClick={() => confirmReject(false)} className="bg-red-600 text-white px-3 py-2 text-xs rounded font-semibold">No — Close only</button>
            <button onClick={() => setRejectLead(null)} className="border px-3 py-2 text-xs rounded">Not yet</button>
          </div>
        </Modal>
      )}
    </>
  );
}

function Modal({ children, title, onClose }: { children: React.ReactNode; title: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-card rounded-lg shadow-xl max-w-lg w-full p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3 pb-2 border-b">
          <h3 className="font-bold text-navy">{title}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
