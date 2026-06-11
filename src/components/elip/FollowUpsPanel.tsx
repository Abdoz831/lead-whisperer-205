import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useElip, type Lead, type Stage } from "@/lib/elip-data";
import { followupAdvice, type FollowupAdvice } from "@/lib/followup-advice.functions";

type AdviceItem = FollowupAdvice["items"][number];

const STAGE_TABS: { id: Stage; label: string; icon: string; color: string }[] = [
  { id: "No Answer", label: "No Answer", icon: "📞", color: "border-red-500" },
  { id: "Follow-up Scheduled", label: "Follow-up Scheduled", icon: "📅", color: "border-blue-500" },
  { id: "Docs Pending", label: "Waiting Documents", icon: "📄", color: "border-amber-500" },
];

const URGENCY_COLOR: Record<string, string> = {
  critical: "bg-red-600 text-white",
  high: "bg-orange-500 text-white",
  medium: "bg-amber-400 text-amber-950",
  low: "bg-zinc-300 text-zinc-800",
};

const CHANNEL_ICON: Record<string, string> = {
  call: "📞",
  whatsapp: "💬",
  sms: "✉️",
  email: "📧",
  in_branch: "🏛️",
};

export function FollowUpsPanel() {
  const { leads } = useElip();
  const advise = useServerFn(followupAdvice);
  const [active, setActive] = useState<Stage>("No Answer");
  const [adviceByLead, setAdviceByLead] = useState<Record<string, AdviceItem>>({});
  const [summary, setSummary] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<string>("");

  const grouped = useMemo(() => {
    const map = new Map<Stage, Lead[]>();
    for (const s of STAGE_TABS) map.set(s.id, []);
    for (const l of leads) {
      if (map.has(l.current_status)) {
        const arr = map.get(l.current_status)!;
        arr.push(l);
      }
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => b.last_update_hours - a.last_update_hours);
    }
    return map;
  }, [leads]);

  const currentLeads = grouped.get(active) ?? [];

  async function generate(stage: Stage) {
    const stageLeads = grouped.get(stage) ?? [];
    if (stageLeads.length === 0) {
      toast.info("No leads in this stage right now.");
      return;
    }
    setLoading(true);
    try {
      const r = await advise({
        data: {
          leads: stageLeads.slice(0, 25).map((l) => ({
            lead_id: l.lead_id,
            customer_name: l.customer_name,
            product: l.product,
            financing_amount: l.financing_amount,
            current_status: l.current_status,
            closing_blocker: l.closing_blocker,
            last_update_hours: l.last_update_hours,
            no_answer_attempts: l.no_answer_attempts,
            next_call_window: l.next_call_window,
            cc_notes: l.cc_notes,
            rlm_notes: l.rlm_notes,
            enrichment_summary: l.enrichment?.professional_profile ?? "",
          })),
        },
      });
      const map: Record<string, AdviceItem> = { ...adviceByLead };
      for (const item of r.items) map[item.lead_id] = item;
      setAdviceByLead(map);
      setSummary(r.stage_summary);
      setGeneratedAt(r.generated_at);
      toast.success(`AI follow-up plan ready for ${r.items.length} leads`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate advice");
    } finally {
      setLoading(false);
    }
  }

  // auto-generate first time on each stage switch if empty
  useEffect(() => {
    const haveAny = currentLeads.some((l) => adviceByLead[l.lead_id]);
    if (!haveAny && currentLeads.length > 0 && !loading) {
      generate(active);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const counts = STAGE_TABS.map((s) => ({ ...s, count: grouped.get(s.id)?.length ?? 0 }));
  const totalNeedAttention = counts.reduce((a, b) => a + b.count, 0);

  return (
    <div className="space-y-4">
      <div className="elip-card p-4 border-l-4 border-purple-500">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-navy">🔔 Follow-up Command Centre</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              AI groups every pipeline lead by status and tells you who to chase, on which channel, with what script — re-ranked by urgency.
            </p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-navy tabular-nums">{totalNeedAttention}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Need attention</div>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        {counts.map((s) => (
          <button
            key={s.id}
            onClick={() => setActive(s.id)}
            className={`flex-1 elip-card p-3 text-left border-l-4 transition ${s.color} ${
              active === s.id ? "ring-2 ring-navy" : "opacity-70 hover:opacity-100"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-bold text-navy">{s.icon} {s.label}</div>
              <span className="text-lg font-bold tabular-nums text-navy">{s.count}</span>
            </div>
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <div className="text-[11px] text-zinc-600">
          {summary ? (
            <><strong>AI coach:</strong> {summary}</>
          ) : loading ? (
            "Generating follow-up plan…"
          ) : (
            "Click Generate to refresh AI guidance for this stage."
          )}
          {generatedAt && <span className="ml-2 text-[10px] text-zinc-400">· {new Date(generatedAt).toLocaleTimeString()}</span>}
        </div>
        <button
          onClick={() => generate(active)}
          disabled={loading || currentLeads.length === 0}
          className="bg-purple-600 disabled:bg-zinc-400 text-white px-3 py-1.5 rounded text-[11px] font-bold"
        >{loading ? "Thinking…" : "🤖 Generate / Refresh"}</button>
      </div>

      <div className="space-y-3">
        {currentLeads.length === 0 && (
          <div className="elip-card p-6 text-center text-xs text-muted-foreground">
            No leads currently in <strong>{active}</strong>. ✅
          </div>
        )}
        {currentLeads.map((l) => (
          <AdviceCard key={l.lead_id} lead={l} advice={adviceByLead[l.lead_id]} loading={loading} />
        ))}
      </div>
    </div>
  );
}

function AdviceCard({ lead, advice, loading }: { lead: Lead; advice?: AdviceItem; loading: boolean }) {
  const age = Math.round(lead.last_update_hours);
  return (
    <div className="elip-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="font-bold text-navy text-sm">{lead.customer_name}</div>
            <span className="text-[10px] text-zinc-500">· {lead.product} · JOD {lead.financing_amount.toLocaleString()}</span>
            {advice && (
              <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${URGENCY_COLOR[advice.urgency]}`}>
                {advice.urgency}
              </span>
            )}
            <span className="text-[10px] text-zinc-500">· {age}h since update</span>
            {lead.no_answer_attempts > 0 && (
              <span className="text-[10px] bg-red-50 text-red-700 px-1.5 rounded">📞×{lead.no_answer_attempts}</span>
            )}
            {lead.closing_blocker && (
              <span className="text-[10px] bg-orange-100 text-orange-900 px-1.5 rounded">{lead.closing_blocker}</span>
            )}
          </div>
        </div>
        {advice && (
          <div className="text-right text-[10px] text-zinc-600 whitespace-nowrap">
            <div>{CHANNEL_ICON[advice.best_channel]} <strong>{advice.best_channel}</strong></div>
            <div className="text-zinc-500">⏰ {advice.best_time}</div>
          </div>
        )}
      </div>

      {!advice ? (
        <div className="text-[11px] text-muted-foreground italic mt-2">
          {loading ? "AI is preparing a plan…" : "Awaiting AI plan."}
        </div>
      ) : (
        <div className="mt-3 grid md:grid-cols-2 gap-3 text-[11px]">
          <div className="bg-blue-50/60 border-l-2 border-blue-400 p-2 rounded">
            <div className="text-[9px] uppercase tracking-wider text-blue-700 font-bold mb-0.5">Situation</div>
            <div className="text-zinc-800">{advice.headline}</div>
          </div>
          <div className="bg-emerald-50/60 border-l-2 border-emerald-500 p-2 rounded">
            <div className="text-[9px] uppercase tracking-wider text-emerald-700 font-bold mb-0.5">Next action</div>
            <div className="text-zinc-800 font-medium">{advice.next_action}</div>
          </div>
          <div className="bg-purple-50/60 border-l-2 border-purple-500 p-2 rounded md:col-span-2">
            <div className="text-[9px] uppercase tracking-wider text-purple-700 font-bold mb-0.5">Suggested script</div>
            <div className="text-zinc-800 italic">"{advice.script}"</div>
          </div>
          <div className="bg-red-50/60 border-l-2 border-red-400 p-2 rounded md:col-span-2">
            <div className="text-[9px] uppercase tracking-wider text-red-700 font-bold mb-0.5">Risk if ignored</div>
            <div className="text-zinc-800">{advice.risk_if_ignored}</div>
          </div>
        </div>
      )}
    </div>
  );
}
