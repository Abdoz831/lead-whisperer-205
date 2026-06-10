import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { PageHeader } from "@/components/elip/UI";
import {
  useElip,
  PRODUCTS,
  CHANNELS,
  WORK_DURATIONS,
  type Product,
} from "@/lib/elip-data";
import { extractLeadFromTranscript } from "@/lib/extract-lead.functions";

export const Route = createFileRoute("/call-centre/assistant")({
  component: Assistant,
});


// ------------ Web Speech API typings (loose) ------------
type SRConstructor = new () => SpeechRecognitionLike;
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
}

// ------------ Turn / extraction types ------------
type Turn = { id: string; speaker: "agent" | "client" | "ai"; text: string; ts: number; interim?: boolean };

type Extracted = {
  customer_name: string;
  phone_number: string;
  net_income_jod: string;
  company_name: string;
  product: Product;
  financing_amount: string;
  work_duration: string;
  job_title: string;
  channel: string;
};

const EMPTY: Extracted = {
  customer_name: "",
  phone_number: "",
  net_income_jod: "",
  company_name: "",
  product: "Personal Loan",
  financing_amount: "",
  work_duration: "1–2 years",
  job_title: "",
  channel: "Inbound Call",
};

// ------------ Extraction engine ------------
function extractFromTranscript(full: string, prior: Extracted): Extracted {
  const t = full.replace(/\s+/g, " ").trim();
  const lower = t.toLowerCase();
  const out: Extracted = { ...prior };

  // Name: "my name is X", "I am X", "this is X"
  const name = t.match(/\b(?:my name is|i am|this is|i'm)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/);
  if (name && !prior.customer_name) out.customer_name = name[1];

  // Phone: Jordanian 07X XXX XXXX or +962
  const phone = t.match(/(\+?962[\s-]?\d[\s-]?\d{3}[\s-]?\d{4}|\b07[789][\s-]?\d{3}[\s-]?\d{4}\b)/);
  if (phone) out.phone_number = phone[1].replace(/\s+/g, "");

  // Financing amount — "JOD 120,000", "120 thousand dinars", "120k"
  const amt =
    t.match(/(?:jod|jd|dinars?)\s*([\d,]{3,})/i) ||
    t.match(/([\d,]{3,})\s*(?:jod|jd|dinars?)/i);
  if (amt) out.financing_amount = amt[1].replace(/,/g, "");
  else {
    const k = lower.match(/\b(\d{1,3})\s*(?:thousand|k)\b/);
    if (k) out.financing_amount = String(Number(k[1]) * 1000);
  }

  // Income — "salary 2000", "income 2500", "earn 1800"
  const inc = t.match(/(?:salary|income|earn(?:ing)?s?|make|monthly)[^\d]{0,15}([\d,]{3,})/i);
  if (inc) out.net_income_jod = inc[1].replace(/,/g, "");

  // Product keywords
  const productMap: [RegExp, Product][] = [
    [/mortgage|rahn/i, "Mortgage"],
    [/housing\s*loan|home\s*loan/i, "Housing Loan"],
    [/auto|car\s*loan|vehicle/i, "Auto Loan"],
    [/buyout\s*(?:of\s*)?credit\s*card/i, "Buyout Credit Card"],
    [/buyout\s*(?:of\s*)?housing/i, "Buyout Housing Loan"],
    [/buyout|consolidat/i, "Buyout Personal Loan"],
    [/credit\s*card|platinum|visa|mastercard/i, "Credit Card"],
    [/plcc/i, "PLCC"],
    [/personal\s*loan|cash\s*loan/i, "Personal Loan"],
  ];
  for (const [re, p] of productMap) {
    if (re.test(lower)) { out.product = p; break; }
  }

  // Company / employer — "I work at X", "work for X", "employed by X", "ministry of X"
  const co =
    t.match(/(?:i\s+work\s+(?:at|for|in)|employed\s+(?:by|at)|company\s+is|employer\s+is)\s+([A-Z][\w&.\- ]{2,40}?)(?:\.|,| and | as | for | with |$)/i) ||
    t.match(/\b(Ministry\s+of\s+[A-Z][\w ]+|Royal\s+Jordanian|Arab\s+Bank|Housing\s+Bank|Aramex|Zain\s+Jordan|Orange\s+Telecom|Jordan\s+Hospital|King\s+Hussein\s+Cancer\s+Center|PwC\s+Jordan|University\s+of\s+Jordan)\b/);
  if (co) out.company_name = (co[1] || co[0]).trim();
  else if (/self[-\s]?employed/i.test(t)) out.company_name = "Self-employed";

  // Job title — "I'm a teacher", "work as engineer", "I am a doctor/nurse/manager"
  const job = t.match(/(?:i'?m\s+(?:a|an)|work\s+as\s+(?:a|an)?|position\s+is|job\s+is)\s+([a-z][a-z\- ]{2,30}?)(?:\.|,| at | with | for | in |$)/i);
  if (job) out.job_title = job[1].trim().replace(/\b\w/g, (c) => c.toUpperCase());

  // Work duration — "X years at", "for X years"
  const dur = lower.match(/(\d+)\s*(?:years?|yrs?)/);
  if (dur) {
    const n = Number(dur[1]);
    if (n < 1) out.work_duration = "Less than 3 months";
    else if (n === 1) out.work_duration = "1–2 years";
    else if (n === 2) out.work_duration = "2–3 years";
    else out.work_duration = "More than 3 years";
  }

  // Channel hints
  if (/web\s*chat/i.test(t)) out.channel = "Web Chat";
  else if (/calculator/i.test(t)) out.channel = "Loan Calculator";
  else if (/contact\s*form|website\s*form/i.test(t)) out.channel = "Contact-Us Form";

  return out;
}

function diffFields(prev: Extracted, next: Extracted): (keyof Extracted)[] {
  const keys = Object.keys(next) as (keyof Extracted)[];
  return keys.filter((k) => prev[k] !== next[k] && next[k] !== "");
}

const FIELD_LABELS: Record<keyof Extracted, string> = {
  customer_name: "Customer Name",
  phone_number: "Phone",
  net_income_jod: "Net Income (JOD)",
  company_name: "Employer",
  product: "Product",
  financing_amount: "Amount (JOD)",
  work_duration: "Work Duration",
  job_title: "Job Title",
  channel: "Channel",
};

function Assistant() {
  const { addLead, currentUser } = useElip();
  const extractFn = useServerFn(extractLeadFromTranscript);
  const [turns, setTurns] = useState<Turn[]>([
    { id: "ai-0", speaker: "ai", text: "Ready. Tap the mic and start your call. I'll transcribe live and fill the lead form as I detect details.", ts: Date.now() },
  ]);
  const [extracted, setExtracted] = useState<Extracted>({ ...EMPTY });
  const [listening, setListening] = useState(false);
  const [speaker, setSpeaker] = useState<"agent" | "client">("client");
  const [lang, setLang] = useState<"en-US" | "ar-JO">("en-US");
  const [supported, setSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aiThinking, setAiThinking] = useState(false);

  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const speakerRef = useRef(speaker);
  speakerRef.current = speaker;
  const extractedRef = useRef(extracted);
  extractedRef.current = extracted;
  const scrollRef = useRef<HTMLDivElement>(null);
  const aiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aiSeqRef = useRef(0);
  const lastSentRef = useRef("");


  // init recognition
  useEffect(() => {
    const SR =
      (window as unknown as { SpeechRecognition?: SRConstructor; webkitSpeechRecognition?: SRConstructor })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: SRConstructor }).webkitSpeechRecognition;
    if (!SR) { setSupported(false); return; }
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = lang;
    recRef.current = rec;
    return () => { try { rec.stop(); } catch { /* noop */ } };
  }, [lang]);

  // AI extraction (debounced) — runs Lovable AI over the FULL conversation
  function scheduleAiExtraction(allTurns: Turn[]) {
    if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    aiTimerRef.current = setTimeout(async () => {
      const transcript = allTurns
        .filter((t) => t.speaker !== "ai" && !t.interim)
        .map((t) => `${t.speaker === "client" ? "Client" : "Agent"}: ${t.text}`)
        .join("\n");
      if (!transcript.trim() || transcript === lastSentRef.current) return;
      lastSentRef.current = transcript;
      const seq = ++aiSeqRef.current;
      setAiThinking(true);
      try {
        const result = await extractFn({ data: { transcript } });
        if (seq !== aiSeqRef.current) return;
        const before = extractedRef.current;
        // Merge: AI wins for non-empty values; never blank an existing value
        const merged: Extracted = { ...before };
        (Object.keys(result) as (keyof Extracted)[]).forEach((k) => {
          const v = (result as Extracted)[k];
          if (typeof v === "string" && v.trim()) {
            (merged as Record<keyof Extracted, string>)[k] = v as string;
          }
        });
        const changed = diffFields(before, merged);
        if (changed.length) {
          setExtracted(merged);
          setTurns((prev) => [
            ...prev,
            {
              id: `ai-${Date.now()}`,
              speaker: "ai",
              text: `🤖 AI updated: ${changed.map((k) => `${FIELD_LABELS[k]} → ${String(merged[k])}`).join(" · ")}`,
              ts: Date.now(),
            },
          ]);
        }
      } catch (err) {
        console.error("AI extraction failed", err);
      } finally {
        if (seq === aiSeqRef.current) setAiThinking(false);
      }
    }, 1200);
  }

  // attach handlers
  useEffect(() => {
    const rec = recRef.current;
    if (!rec) return;
    rec.onresult = (e) => {
      let interim = "";
      let finalText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const tx = r[0].transcript;
        if (r.isFinal) finalText += tx + " ";
        else interim += tx;
      }
      if (finalText.trim()) {
        const sp = speakerRef.current;
        const turn: Turn = { id: `t-${Date.now()}-${Math.random()}`, speaker: sp, text: finalText.trim(), ts: Date.now() };
        setTurns((prev) => {
          const cleaned = prev.filter((p) => !p.interim);
          const next = [...cleaned, turn];
          // 1. Fast local regex pass for instant pre-fill
          const conv = next.filter((n) => n.speaker !== "ai" && !n.interim).map((n) => n.text).join(" ");
          const before = extractedRef.current;
          const after = extractFromTranscript(conv, before);
          if (diffFields(before, after).length) setExtracted(after);
          // 2. Authoritative AI extraction (debounced)
          scheduleAiExtraction(next);
          return next;
        });
      }
      if (interim.trim()) {
        const sp = speakerRef.current;
        setTurns((prev) => {
          const cleaned = prev.filter((p) => !p.interim);
          return [...cleaned, { id: "interim", speaker: sp, text: interim, ts: Date.now(), interim: true }];
        });
      }
    };
    rec.onerror = (e) => {
      setError(e.error || "Speech error");
      setListening(false);
    };
    rec.onend = () => {
      if (listening) {
        try { rec.start(); } catch { /* noop */ }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listening]);

  // auto scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  function toggleMic() {
    const rec = recRef.current;
    if (!rec) return;
    setError(null);
    if (listening) {
      try { rec.stop(); } catch { /* noop */ }
      setListening(false);
    } else {
      try { rec.start(); setListening(true); } catch (err) {
        setError(String(err));
      }
    }
  }

  function reset() {
    try { recRef.current?.stop(); } catch { /* noop */ }
    setListening(false);
    setTurns([{ id: "ai-0", speaker: "ai", text: "Cleared. Ready for next call.", ts: Date.now() }]);
    setExtracted({ ...EMPTY });
  }

  const ccNotes = useMemo(() => {
    const lines = turns
      .filter((t) => t.speaker !== "ai" && !t.interim)
      .map((t) => `${t.speaker === "client" ? "Client" : "Agent"}: ${t.text}`);
    return lines.join("\n").slice(0, 500);
  }, [turns]);

  function submit() {
    const e: string[] = [];
    if (extracted.customer_name.trim().length < 3) e.push("Customer Name");
    if (!/^[+\d][\d\s+()-]{6,}$/.test(extracted.phone_number)) e.push("Phone");
    if (!extracted.net_income_jod || isNaN(Number(extracted.net_income_jod))) e.push("Net Income");
    if (extracted.company_name.trim().length < 2) e.push("Employer");
    if (!extracted.financing_amount || isNaN(Number(extracted.financing_amount))) e.push("Amount");
    if (extracted.job_title.trim().length < 2) e.push("Job Title");
    if (ccNotes.length < 20) e.push("Call notes (continue the conversation)");
    if (e.length) {
      toast.error(`Missing or invalid: ${e.join(", ")}`);
      return;
    }
    const { lead, rlmName } = addLead({
      channel: extracted.channel,
      customer_name: extracted.customer_name.trim(),
      customer_cif: "NA",
      phone_number: extracted.phone_number.trim(),
      net_income_jod: Number(extracted.net_income_jod),
      company_name: extracted.company_name.trim(),
      product: extracted.product,
      financing_amount: Number(extracted.financing_amount),
      work_duration: extracted.work_duration,
      job_title: extracted.job_title.trim(),
      cc_notes: ccNotes,
      submitted_by_agent: currentUser.id,
    });
    toast.success(
      `Lead ${lead.lead_id} routed to ${rlmName} · ${lead.priority} · AI Score ${lead.ai_score}/100`
    );
    reset();
  }

  return (
    <>
      <PageHeader
        title="AI Call Assistant"
        subtitle="Speak naturally with the client. ELIP transcribes live and auto-fills the lead — review, then send to Sales."
      />
      <div className="p-6 grid grid-cols-12 gap-5 h-[calc(100vh-200px)]">
        {/* LEFT — Conversation */}
        <div className="col-span-7 elip-card flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b bg-card flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-navy">Live Conversation</h2>
              <p className="text-[11px] text-muted-foreground">
                Speaking as <strong>{speaker === "client" ? "the Client" : "the Bank Agent"}</strong>
                {" · "}{lang === "en-US" ? "English" : "Arabic (Jordan)"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value as "en-US" | "ar-JO")}
                className="text-[11px] border rounded px-2 py-1 bg-white"
              >
                <option value="en-US">English</option>
                <option value="ar-JO">العربية</option>
              </select>
              <button
                onClick={() => setSpeaker((s) => (s === "client" ? "agent" : "client"))}
                className="text-[11px] border rounded px-2 py-1 bg-white hover:bg-zinc-50"
                title="Toggle which voice is speaking"
              >
                Tag as: {speaker === "client" ? "Client" : "Agent"} ⇄
              </button>
              <button
                onClick={reset}
                className="text-[11px] border rounded px-2 py-1 bg-white hover:bg-zinc-50"
              >
                Clear
              </button>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2 bg-zinc-50/40">
            {turns.map((t) => (
              <Bubble key={t.id} turn={t} />
            ))}
          </div>

          <div className="border-t p-3 flex items-center gap-3 bg-card">
            {!supported && (
              <div className="text-[11px] text-red-600 flex-1">
                Speech recognition is not available in this browser. Use Chrome/Edge for live transcription.
              </div>
            )}
            {supported && (
              <>
                <button
                  onClick={toggleMic}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                    listening
                      ? "bg-red-600 text-white animate-pulse"
                      : "bg-navy text-navy-foreground hover:opacity-90"
                  }`}
                >
                  <span className="text-base">{listening ? "■" : "🎙"}</span>
                  {listening ? "Stop Listening" : "Start Listening"}
                </button>
                <div className="text-[11px] text-muted-foreground flex-1">
                  {listening
                    ? "Listening… speak normally. Tap Tag-as to switch speakers."
                    : "Tap the mic and begin your call. Tag-as Client when the customer speaks."}
                  {error && <span className="text-red-600 ml-2">({error})</span>}
                </div>
              </>
            )}
          </div>
        </div>

        {/* RIGHT — Live extraction */}
        <div className="col-span-5 elip-card flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b bg-card flex items-center justify-between">
            <h2 className="text-sm font-bold text-navy">AI-Extracted Lead</h2>
            <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${aiThinking ? "bg-primary text-primary-foreground animate-pulse" : "bg-gold text-gold-foreground"}`}>
              {aiThinking ? "AI THINKING…" : "LIVE"}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
            <Field label="Customer Name" value={extracted.customer_name} onChange={(v) => setExtracted({ ...extracted, customer_name: v })} />
            <Field label="Phone" value={extracted.phone_number} onChange={(v) => setExtracted({ ...extracted, phone_number: v })} />
            <Field label="Employer / Company" value={extracted.company_name} onChange={(v) => setExtracted({ ...extracted, company_name: v })} />
            <Field label="Job Title" value={extracted.job_title} onChange={(v) => setExtracted({ ...extracted, job_title: v })} />
            <div className="grid grid-cols-2 gap-3">
              <Select label="Product" value={extracted.product} options={PRODUCTS as unknown as string[]} onChange={(v) => setExtracted({ ...extracted, product: v as Product })} />
              <Select label="Work Duration" value={extracted.work_duration} options={WORK_DURATIONS as unknown as string[]} onChange={(v) => setExtracted({ ...extracted, work_duration: v })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Financing (JOD)" value={extracted.financing_amount} onChange={(v) => setExtracted({ ...extracted, financing_amount: v })} />
              <Field label="Net Income (JOD)" value={extracted.net_income_jod} onChange={(v) => setExtracted({ ...extracted, net_income_jod: v })} />
            </div>
            <Select label="Channel" value={extracted.channel} options={CHANNELS as unknown as string[]} onChange={(v) => setExtracted({ ...extracted, channel: v })} />

            <div>
              <div className="text-[10px] uppercase font-semibold text-zinc-500 mb-1">Auto-generated CC Notes</div>
              <div className="border rounded bg-zinc-50 p-2 text-[11px] whitespace-pre-wrap max-h-32 overflow-y-auto">
                {ccNotes || <span className="text-muted-foreground italic">Will populate from the conversation.</span>}
              </div>
              <div className="text-[10px] text-right text-muted-foreground mt-0.5">{ccNotes.length} / 500</div>
            </div>
          </div>
          <div className="border-t p-3 bg-card">
            <button
              onClick={submit}
              className="w-full bg-navy text-navy-foreground py-2 rounded text-sm font-semibold hover:opacity-90"
            >
              Send Lead to Sales Queue →
            </button>
            <div className="text-[10px] text-muted-foreground text-center mt-1.5">
              Submitting as <strong>{currentUser.name}</strong>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function Bubble({ turn }: { turn: Turn }) {
  if (turn.speaker === "ai") {
    return (
      <div className="flex justify-center">
        <div className="text-[11px] bg-gold/15 border border-gold/40 text-zinc-800 rounded-full px-3 py-1">
          🤖 {turn.text}
        </div>
      </div>
    );
  }
  const isClient = turn.speaker === "client";
  return (
    <div className={`flex ${isClient ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
          isClient
            ? "bg-white border border-zinc-200 text-zinc-900"
            : "bg-navy text-navy-foreground"
        } ${turn.interim ? "opacity-60 italic" : ""}`}
      >
        <div className="text-[10px] uppercase tracking-wider font-bold mb-0.5 opacity-70">
          {isClient ? "Client" : "Bank Agent"}
        </div>
        {turn.text}
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <div className="text-[10px] uppercase font-semibold text-zinc-500 mb-1">{label}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full border rounded px-2 py-1.5 text-sm ${value ? "bg-gold/5 border-gold/40" : "border-zinc-300"}`}
        placeholder="—"
      />
    </div>
  );
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div>
      <div className="text-[10px] uppercase font-semibold text-zinc-500 mb-1">{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-zinc-300 rounded px-2 py-1.5 text-sm bg-white"
      >
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
