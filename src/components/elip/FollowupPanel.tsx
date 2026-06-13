import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useElip, type Lead } from "@/lib/elip-data";
import { getFollowupAdvice, type FollowupAdvice } from "@/lib/followup-advice.functions";
import { areAgentsKilled, useAgentsKilled } from "@/lib/agents-kill-switch";

const FOLLOWUP_STAGES = ["No Answer", "Follow-up Scheduled", "Docs Pending", "Booked", "Underwriting", "Approved"] as const;
type FollowupStage = (typeof FOLLOWUP_STAGES)[number];

const STAGE_META: Record<FollowupStage, { icon: string; tint: string; hint: string }> = {
  "No Answer": { icon: "📵", tint: "bg-red-50 border-red-300 text-red-900", hint: "Rotate channel & time. After 3 attempts, switch to WhatsApp/SMS." },
  "Follow-up Scheduled": { icon: "📅", tint: "bg-blue-50 border-blue-300 text-blue-900", hint: "Confirm appointment 24h before. Send reminder + value prop." },
  "Docs Pending": { icon: "📄", tint: "bg-amber-50 border-amber-300 text-amber-900", hint: "Chase the exact missing doc. Offer pickup. Set a hard deadline." },
  Booked: { icon: "✅", tint: "bg-emerald-50 border-emerald-300 text-emerald-900", hint: "Pre-call briefing. Anticipate objections. Push to Appian." },
  Underwriting: { icon: "🔍", tint: "bg-indigo-50 border-indigo-300 text-indigo-900", hint: "RLM status check. Manage customer expectation." },
  Approved: { icon: "🎯", tint: "bg-green-50 border-green-300 text-green-900", hint: "Closing call. Push to disbursement immediately." },
};

const URGENCY_COLOR: Record<string, string> = {
  critical: "bg-red-600 text-white",
  high: "bg-orange-500 text-white",
  medium: "bg-amber-400 text-zinc-900",
  low: "bg-zinc-300 text-zinc-800",
};

export function FollowupPanel() {
  const { leads } = useElip();
  const adviceFn = useServerFn(getFollowupAdvice);
  const [advice, setAdvice] = useState<FollowupAdvice | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeStage, setActiveStage] = useState<FollowupStage | "all">("all");
  const [agentsKilled] = useAgentsKilled();

  const followups = useMemo<Lead[]>(
    () => leads.filter((l) => (FOLLOWUP_STAGES as readonly string[]).includes(l.current_status)),
    [leads]
  );

  const byStage = useMemo(() => {
    const map = {} as Record<FollowupStage, Lead[]>;
    FOLLOWUP_STAGES.forEach((s) => (map[s] = []));
    followups.forEach((l) => {
      if ((FOLLOWUP_STAGES as readonly string[]).includes(l.current_status)) {
        map[l.current_status as FollowupStage].push(l);
      }
    });
    return map;
  }, [followups]);

  const visible = activeStage === "all" ? followups : byStage[activeStage];

  async function runAdvice() {
    if (areAgentsKilled()) {
      toast.error("🛑 Kill switch is ON — AI follow-up advice is disabled.");
      return;
    }
    if (visible.length === 0) {
      toast.info("No leads in this segment to advise on.");
      return;
    }
    setLoading(true);
    try {
      const res = await adviceFn({
        data: {
          leads: visible.slice(0, 30).map((l) => ({
            lead_id: l.lead_id,
            customer_name: l.customer_name,
            product: l.product,
            financing_amount: l.financing_amount,
            current_status: l.current_status,
            last_update_hours: l.last_update_hours,
            no_answer_attempts: l.no_answer_attempts,
            deal_temperature: l.deal_temperature,
            closing_blocker: l.closing_blocker,
            cc_notes: l.cc_notes,
            rlm_notes: l.rlm_notes,
            best_time_to_call: l.best_time_to_call,
          })),
        },
      });
      setAdvice(res);
      toast.success(`AI generated ${res.items.length} follow-up actions`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to get advice");
    } finally {
      setLoading(false);
    }
  }

  // Auto-run once on mount when leads exist
  useEffect(() => {
    if (followups.length > 0 && !advice && !loading && !areAgentsKilled()) runAdvice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const adviceMap = useMemo(() => {
    const m = new Map<string, FollowupAdvice["items"][number]>();
    advice?.items.forEach((a) => m.set(a.lead_id, a));
    return m;
  }, [advice]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-sm font-bold text-navy">🔔 AI Follow-up Notifications</h2>
          <p className="text-[11px] text-muted-foreground">
            {followups.length} leads need a follow-up · AI suggests the next action for each
          </p>
        </div>
        <button
          onClick={runAdvice}
          disabled={loading || agentsKilled}
          title={agentsKilled ? "Kill switch is ON — agents disabled" : ""}
          className="bg-navy disabled:bg-zinc-400 text-navy-foreground px-3 py-1.5 rounded text-xs font-semibold"
        >
          {agentsKilled ? "🛑 Agents disabled" : loading ? "Generating…" : advice ? "🔄 Refresh advice" : "✨ Generate advice"}
        </button>
      </div>

      {agentsKilled && (
        <div className="bg-rose-50 border-l-4 border-rose-600 text-rose-900 text-xs px-3 py-2 rounded">
          🛑 <strong>Kill switch is ON.</strong> AI follow-up advice is paused — manage follow-ups manually using the stage playbook hints.
        </div>
      )}

      {advice?.summary && (
        <div className="bg-purple-50 border border-purple-200 text-purple-900 text-xs px-3 py-2 rounded">
          <strong>Queue summary:</strong> {advice.summary}
        </div>
      )}

      {/* Stage filter chips */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setActiveStage("all")}
          className={`text-[11px] px-2.5 py-1 rounded-full border ${
            activeStage === "all" ? "bg-navy text-navy-foreground border-navy" : "bg-card border-zinc-300 text-zinc-700"
          }`}
        >All ({followups.length})</button>
        {FOLLOWUP_STAGES.map((s) => (
          <button
            key={s}
            onClick={() => setActiveStage(s)}
            className={`text-[11px] px-2.5 py-1 rounded-full border ${
              activeStage === s ? "bg-navy text-navy-foreground border-navy" : "bg-card border-zinc-300 text-zinc-700"
            }`}
          >{STAGE_META[s].icon} {s} ({byStage[s].length})</button>
        ))}
      </div>

      {/* Stage hint */}
      {activeStage !== "all" && (
        <div className={`text-[11px] px-3 py-2 rounded border-l-4 ${STAGE_META[activeStage].tint}`}>
          <strong>{STAGE_META[activeStage].icon} {activeStage} playbook:</strong> {STAGE_META[activeStage].hint}
        </div>
      )}

      {/* Notification list */}
      {visible.length === 0 ? (
        <div className="elip-card p-6 text-center text-xs text-muted-foreground">
          No leads in this segment. 🎉
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((l) => {
            const a = adviceMap.get(l.lead_id);
            const stale = l.last_update_hours >= 48;
            const meta = STAGE_META[l.current_status as FollowupStage];
            return (
              <div key={l.lead_id} className={`elip-card p-3 border-l-4 ${meta?.tint ?? "border-zinc-300"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base">{meta?.icon}</span>
                      <span className="font-semibold text-navy text-sm">{l.customer_name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-200 text-zinc-700">{l.current_status}</span>
                      <span className="text-[10px] text-zinc-600">{l.product} · JOD {l.financing_amount.toLocaleString()}</span>
                      {stale && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-600 text-white">{Math.round(l.last_update_hours/24)}d stale</span>}
                      {l.no_answer_attempts ? <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-100 text-red-800">{l.no_answer_attempts} no-answers</span> : null}
                    </div>

                    {a ? (
                      <div className="mt-2 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${URGENCY_COLOR[a.urgency]}`}>
                            {a.urgency.toUpperCase()}
                          </span>
                          <span className="text-xs font-semibold text-navy">→ {a.next_action}</span>
                          <span className="text-[10px] text-zinc-600">via {a.channel} · {a.timing}</span>
                        </div>
                        <div className="text-[11px] text-zinc-700"><strong>Why:</strong> {a.reasoning}</div>
                        <div className="text-[11px] italic bg-zinc-50 border border-zinc-200 rounded p-2 text-zinc-800">
                          💬 “{a.script}”
                        </div>
                        <div className="text-[10px] text-red-700"><strong>Risk if delayed:</strong> {a.risk_if_delayed}</div>
                      </div>
                    ) : (
                      <div className="mt-1 text-[11px] text-muted-foreground italic">
                        {loading ? "Generating advice…" : "Click ✨ Generate advice for AI recommendation"}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
