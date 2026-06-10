import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { PageHeader } from "@/components/elip/UI";
import { useElip, PRODUCTS, CHANNELS, WORK_DURATIONS, type Product } from "@/lib/elip-data";
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
type Turn = {
  id: string;
  speaker: "agent" | "client" | "ai";
  text: string;
  ts: number;
  interim?: boolean;
};

type Extracted = {
  customer_name: string;
  phone_number: string;
  net_income_jod: string;
  other_income_jod: string;
  existing_obligations_jod: string;
  years_in_current_job: string;
  dependents: string;
  financial_notes: string;
  company_name: string;
  product: Product;
  financing_amount: string;
  work_duration: string;
  job_title: string;
  channel: string;
};

type DebugEntry = {
  id: string;
  ts: number;
  source: "interim" | "regex" | "ai" | "ai-error";
  transcript: string;
  raw: unknown;
  confidence: number;
  filled: number;
  total: number;
  changed: string[];
  latencyMs?: number;
  error?: string;
};

const EMPTY: Extracted = {
  customer_name: "",
  phone_number: "",
  net_income_jod: "",
  other_income_jod: "",
  existing_obligations_jod: "",
  years_in_current_job: "",
  dependents: "",
  financial_notes: "",
  company_name: "",
  product: "Personal Loan",
  financing_amount: "",
  work_duration: "1–2 years",
  job_title: "",
  channel: "Inbound Call",
};

// ------------ Extraction engine ------------
function normalizePhone(raw: string) {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return trimmed;
  return trimmed.startsWith("+") ? `+${digits}` : digits;
}

function cleanPhrase(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.,;:]+$/, "");
}

function titleCase(value: string) {
  return cleanPhrase(value).replace(/\b\w/g, (c) => c.toUpperCase());
}

function normalizeDigits(value: string) {
  return value.replace(/[٠-٩۰-۹]/g, (d) => String("٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹".indexOf(d) % 10));
}

const SMALL_NUMBERS: Record<string, number> = {
  zero: 0,
  oh: 0,
  o: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  صفر: 0,
  واحد: 1,
  واحدة: 1,
  اثنين: 2,
  اتنين: 2,
  ثلاثة: 3,
  تلاتة: 3,
  اربعة: 4,
  أربعة: 4,
  خمسة: 5,
  ستة: 6,
  سبعة: 7,
  ثمانية: 8,
  تسعة: 9,
};

function spokenNumberToNumber(value: string) {
  const tokens = normalizeDigits(value)
    .toLowerCase()
    .replace(/-/g, " ")
    .match(/[a-z\u0600-\u06ff]+|\d+(?:\.\d+)?/g);
  if (!tokens?.length) return null;

  let total = 0;
  let current = 0;
  let sawNumber = false;
  for (const token of tokens) {
    if (/^\d/.test(token)) {
      current += Number(token);
      sawNumber = true;
    } else if (token in SMALL_NUMBERS) {
      current += SMALL_NUMBERS[token];
      sawNumber = true;
    } else if (["hundred", "مئة", "مية"].includes(token)) {
      current = Math.max(current, 1) * 100;
      sawNumber = true;
    } else if (["thousand", "k", "الف", "ألف"].includes(token)) {
      total += Math.max(current, 1) * 1000;
      current = 0;
      sawNumber = true;
    } else if (["million", "مليون"].includes(token)) {
      total += Math.max(current, 1) * 1_000_000;
      current = 0;
      sawNumber = true;
    }
  }
  return sawNumber ? Math.round(total + current) : null;
}

function parseMoneyPhrase(value: string) {
  const text = normalizeDigits(value).replace(/,/g, " ");
  const numeric = text.match(/(\d+(?:\.\d+)?)\s*(k|thousand|الف|ألف|million|مليون)?/i);
  if (numeric) {
    const base = Number(numeric[1]);
    const scale = numeric[2]?.toLowerCase();
    if (scale && ["k", "thousand", "الف", "ألف"].includes(scale))
      return String(Math.round(base * 1000));
    if (scale && ["million", "مليون"].includes(scale)) return String(Math.round(base * 1_000_000));
    return String(Math.round(base));
  }
  const spoken = spokenNumberToNumber(text);
  return spoken && spoken > 0 ? String(spoken) : "";
}

function parsePhonePhrase(value: string) {
  const text = normalizeDigits(value).toLowerCase().replace(/-/g, " ");
  const compactDigits = text.replace(/[^+\d]/g, "");
  if (compactDigits.replace(/\D/g, "").length >= 7) return normalizePhone(compactDigits);

  const tokens =
    text.match(
      /plus|double|triple|zero|oh|o|one|two|three|four|five|six|seven|eight|nine|[٠-٩۰-۹\d]|صفر|واحد|واحدة|اثنين|اتنين|ثلاثة|تلاتة|اربعة|أربعة|خمسة|ستة|سبعة|ثمانية|تسعة/g,
    ) ?? [];
  let out = "";
  let repeat = 1;
  for (const token of tokens) {
    if (token === "plus") {
      out = "+";
      continue;
    }
    if (token === "double") {
      repeat = 2;
      continue;
    }
    if (token === "triple") {
      repeat = 3;
      continue;
    }
    const digit = /^\d$/.test(token) ? token : SMALL_NUMBERS[token]?.toString();
    if (digit !== undefined) {
      out += digit.repeat(repeat);
      repeat = 1;
    }
  }
  return out.replace(/\D/g, "").length >= 7 ? normalizePhone(out) : "";
}

function firstCapturedPhrase(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return cleanPhrase(match[1]);
  }
  return "";
}

function extractFromTranscript(full: string, prior: Extracted): Extracted {
  const t = normalizeDigits(full).replace(/\s+/g, " ").trim();
  const lower = t.toLowerCase();
  const out: Extracted = { ...prior };

  // Name: "my name is X", "I am X", "client name is X", Arabic "اسمي X"
  const name = firstCapturedPhrase(t, [
    /\b(?:my name is|client name is|customer name is|this is)\s+([a-z][a-z'-]+(?:\s+[a-z][a-z'-]+){0,3})(?=\s+(?:and|from|my|i work|working|phone|mobile|salary|income|need|want|looking|$)|[.,]|$)/i,
    /\b(?:i'm|i am)\s+(?!a\b|an\b|looking\b|calling\b|interested\b|working\b)([a-z][a-z'-]+(?:\s+[a-z][a-z'-]+){0,3})(?=\s+(?:and|from|my|phone|mobile|salary|income|need|want|$)|[.,]|$)/i,
    /(?:اسمي|انا|أنا)\s+([\u0600-\u06ff]{2,}(?:\s+[\u0600-\u06ff]{2,}){0,3})(?=\s+(?:و|من|رقمي|هاتفي|اعمل|أعمل|راتبي|$)|[،.]|$)/,
  ]);
  if (name && !prior.customer_name && !/^(a|an|looking|calling|interested|working)$/i.test(name))
    out.customer_name = /[\u0600-\u06ff]/.test(name) ? name : titleCase(name);

  // Phone: numeric or spoken digits, Jordanian/UAE/GCC/international, English or Arabic prompts
  const phonePhrase = firstCapturedPhrase(t, [
    /(?:phone(?:\s+number)?|mobile|number|call\s+me\s+on|رقمي|هاتفي|موبايلي)\s*(?:is|:|هو)?\s*([+\d\s()-]{7,35})(?=\s+(?:and|my|i|salary|income|work|need|want|$)|[.,،]|$)/i,
    /(?:phone(?:\s+number)?|mobile|number|call\s+me\s+on)\s*(?:is|:)?\s*((?:plus|double|triple|zero|oh|one|two|three|four|five|six|seven|eight|nine|o|\s|-){14,})(?=\s+(?:and|my|i|salary|income|work|need|want|$)|[.,]|$)/i,
    /(\+?962[\s-]?\d[\s-]?\d{3}[\s-]?\d{4}|\b07[789][\s-]?\d{3}[\s-]?\d{4}\b|(?:\+|00)\d[\d\s()-]{7,24}\d)/,
  ]);
  if (phonePhrase) {
    const parsedPhone = parsePhonePhrase(phonePhrase);
    if (parsedPhone) out.phone_number = parsedPhone;
  }

  // Financing amount — "JOD 120,000", "120 thousand dinars", "one hundred twenty thousand", Arabic amount phrases
  const amountPhrase = firstCapturedPhrase(t, [
    /(?:need|want|looking\s+for|loan\s+of|amount\s+is|financing\s+amount\s+is|request(?:ing)?|بدي|اريد|أريد|محتاج)\s+([\w\u0600-\u06ff\s.,-]{2,60}?)(?:\s*(?:jod|jd|dinar|dinars|دينار))?(?=\s+(?:for|to buy|because|and my|my salary|salary|income|from|$)|[.,،]|$)/i,
    /(?:jod|jd|dinars?|دينار)\s*([\w\u0600-\u06ff\s.,-]{2,50})(?=\s+(?:for|and|my|salary|income|$)|[.,،]|$)/i,
    /([\w\u0600-\u06ff\s.,-]{2,50})\s*(?:jod|jd|dinars?|دينار)(?=\s+(?:for|and|my|salary|income|$)|[.,،]|$)/i,
  ]);
  if (amountPhrase) {
    const parsedAmount = parseMoneyPhrase(amountPhrase);
    if (parsedAmount) out.financing_amount = parsedAmount;
  }

  // Income — "salary 2000", "income 2500", "earn 1800"
  const incomePhrase = firstCapturedPhrase(t, [
    /(?:salary|net\s+salary|net\s+income|monthly\s+(?:income|salary)|earn(?:ing)?s?|i\s+make|راتبي|دخلي)\s*(?:is|:|حوالي)?\s*([\w\u0600-\u06ff\s.,-]{2,40})(?=\s+(?:and|my|i|work|need|want|$)|[.,،]|$)/i,
  ]);
  if (incomePhrase) {
    const parsedIncome = parseMoneyPhrase(incomePhrase);
    if (parsedIncome) out.net_income_jod = parsedIncome;
  }

  // Other / additional monthly income
  const otherIncPhrase = firstCapturedPhrase(t, [
    /(?:additional\s+income|other\s+income|extra\s+income|side\s+income|rental\s+income|rent\s+from|business\s+income|spouse(?:'?s)?\s+(?:salary|income)|freelance|دخل\s+اضافي|دخل\s+إضافي)\s*(?:is|:|of|من|حوالي)?\s*([\w\u0600-\u06ff\s.,-]{2,40})(?=\s+(?:and|my|i|$)|[.,،]|$)/i,
  ]);
  if (otherIncPhrase) {
    const v = parseMoneyPhrase(otherIncPhrase);
    if (v) out.other_income_jod = v;
  }

  // Existing obligations / monthly debt
  const oblPhrase = firstCapturedPhrase(t, [
    /(?:existing\s+(?:loan|loans|obligations?)|monthly\s+(?:obligation|instal?ments?|payment)|current\s+loan|i\s+(?:already\s+)?(?:have|pay)\s+a?\s*loan|credit\s+card\s+(?:payment|bill)|قسط|أقساط|التزامات)\s*(?:of|is|:|من|حوالي)?\s*([\w\u0600-\u06ff\s.,-]{2,40})(?=\s+(?:and|my|i|$)|[.,،]|$)/i,
  ]);
  if (oblPhrase) {
    const v = parseMoneyPhrase(oblPhrase);
    if (v) out.existing_obligations_jod = v;
  }

  // Dependents
  const depMatch = lower.match(/(\d+|one|two|three|four|five|six|seven)\s+(?:kids|children|dependents|dependants|اطفال|أطفال|اولاد|أولاد)/);
  if (depMatch) {
    const n = /^\d+$/.test(depMatch[1]) ? Number(depMatch[1]) : SMALL_NUMBERS[depMatch[1]];
    if (n != null) out.dependents = String(n);
  }

  // Years in current job — "I've been there 5 years", "with them for 3 years"
  const yrsMatch = lower.match(/(?:been\s+(?:there|with\s+them|in\s+this\s+job)|for|since)\s+(\d+(?:\.\d+)?|half\s+a)\s*(?:years?|yrs?|year|سنة|سنوات)/);
  if (yrsMatch) {
    const v = yrsMatch[1].startsWith("half") ? "0.5" : yrsMatch[1];
    out.years_in_current_job = v;
  }

  // Product keywords
  const productMap: [RegExp, Product][] = [
    [/mortgage|rahn|رهن/i, "Mortgage"],
    [/housing\s*loan|home\s*loan|سكن|منزل|بيت/i, "Housing Loan"],
    [/auto|car\s*loan|vehicle|سيارة|مركبة/i, "Auto Loan"],
    [/buyout\s*(?:of\s*)?credit\s*card/i, "Buyout Credit Card"],
    [/buyout\s*(?:of\s*)?housing/i, "Buyout Housing Loan"],
    [/buyout|consolidat/i, "Buyout Personal Loan"],
    [/credit\s*card|platinum|visa|mastercard|بطاقة/i, "Credit Card"],
    [/plcc/i, "PLCC"],
    [/personal\s*loan|cash\s*loan|قرض\s*شخصي|تمويل\s*شخصي/i, "Personal Loan"],
  ];
  for (const [re, p] of productMap) {
    if (re.test(lower)) {
      out.product = p;
      break;
    }
  }

  // Company / employer — "I work at X", "work for X", "employed by X", "ministry of X"
  const roleOfCompany = t.match(
    /(?:work(?:ing)?\s+as|position\s+is|job\s+(?:title\s+)?is|i'?m\s+(?:a|an)?|i\s+am\s+(?:a|an)?)\s*([a-z][a-z -]{2,45}?)\s+(?:of|at|for|with)\s+([A-Za-z][\w&. -]{2,90}?)(?:\.|,| and | my | salary | income | need | want |$)/i,
  );
  const co =
    roleOfCompany ||
    t.match(
      /(?:i\s+work\s+(?:at|for|in)|i'?m\s+working\s+(?:at|for|in)|employed\s+(?:by|at)|company\s+is|employer\s+is|اعمل\s+(?:في|لدى)|أعمل\s+(?:في|لدى))\s+([A-Za-z\u0600-\u06ff][\w\u0600-\u06ff&.\- ]{2,90}?)(?:\.|,|،| and | as | for | with | my | salary | income | need | want |$)/i,
    ) ||
    t.match(
      /\b(Ministry\s+of\s+[A-Z][\w ]+|Royal\s+Jordanian|Arab\s+Bank|Housing\s+Bank|Aramex|Zain\s+Jordan|Orange\s+Telecom|Jordan\s+Hospital|King\s+Hussein\s+Cancer\s+Center|PwC\s+Jordan|University\s+of\s+Jordan)\b/,
    );
  if (roleOfCompany) out.company_name = cleanPhrase(roleOfCompany[2]);
  else if (co) out.company_name = cleanPhrase(co[1] || co[0]);
  else if (/self[-\s]?employed/i.test(t)) out.company_name = "Self-employed";

  // Job title — "I'm a teacher", "working as Secretary General", "I am a doctor/nurse/manager"
  const job =
    roleOfCompany ||
    t.match(
      /(?:i'?m\s+(?:a|an)|i\s+am\s+(?:a|an)|work(?:ing)?\s+as\s+(?:a|an)?|position\s+is|job\s+(?:title\s+)?is)\s+([a-z][a-z\- ]{2,45}?)(?:\.|,| at | with | for | in | of | and | my | salary | income |$)/i,
    );
  if (job) out.job_title = titleCase(job[1]);

  // Work duration — "X years at", "for X years"
  const dur = lower.match(/(\d+)\s*(?:years?|yrs?|سنة|سنوات|اشهر|شهور|months?)/);
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
  net_income_jod: "Salary (JOD)",
  other_income_jod: "Other Income (JOD)",
  existing_obligations_jod: "Existing Obligations (JOD)",
  years_in_current_job: "Years in Job",
  dependents: "Dependents",
  financial_notes: "Financial Notes",
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
    {
      id: "ai-0",
      speaker: "ai",
      text: "Ready. Tap the mic and start your call. I'll transcribe live and fill the lead form as I detect details.",
      ts: Date.now(),
    },
  ]);
  const [extracted, setExtracted] = useState<Extracted>({ ...EMPTY });
  const [listening, setListening] = useState(false);
  const [speaker, setSpeaker] = useState<"agent" | "client">("client");
  const [lang, setLang] = useState<"en-US" | "ar-JO">("en-US");
  const [supported, setSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aiThinking, setAiThinking] = useState(false);
  const [showDebug, setShowDebug] = useState(true);
  const [debugLog, setDebugLog] = useState<DebugEntry[]>([]);

  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const speakerRef = useRef(speaker);
  speakerRef.current = speaker;
  const extractedRef = useRef(extracted);
  extractedRef.current = extracted;
  const scrollRef = useRef<HTMLDivElement>(null);
  const aiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aiSeqRef = useRef(0);
  const lastSentRef = useRef("");
  const askingRef = useRef(false);
  const autoAskRef = useRef(false);
  const [autoAsk, setAutoAsk] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const lastAskedRef = useRef<keyof Extracted | null>(null);
  const listeningRef = useRef(false);
  listeningRef.current = listening;
  const langRef = useRef(lang);
  langRef.current = lang;


  function pushDebug(entry: Omit<DebugEntry, "id" | "ts">) {
    setDebugLog((prev) =>
      [{ id: `dbg-${Date.now()}-${Math.random()}`, ts: Date.now(), ...entry }, ...prev].slice(
        0,
        40,
      ),
    );
  }

  function scoreConfidence(obj: Record<string, unknown>) {
    const keys = Object.keys(EMPTY) as (keyof Extracted)[];
    const filled = keys.filter((k) => {
      const v = obj[k as string];
      return typeof v === "string" && v.trim().length > 0;
    }).length;
    return { filled, total: keys.length, confidence: filled / keys.length };
  }

  // init recognition
  useEffect(() => {
    const SR =
      (
        window as unknown as {
          SpeechRecognition?: SRConstructor;
          webkitSpeechRecognition?: SRConstructor;
        }
      ).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: SRConstructor }).webkitSpeechRecognition;
    if (!SR) {
      setSupported(false);
      return;
    }
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = lang;
    recRef.current = rec;
    return () => {
      try {
        rec.stop();
      } catch {
        /* noop */
      }
    };
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
      const startedAt = Date.now();
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
        const score = scoreConfidence(result as unknown as Record<string, unknown>);
        pushDebug({
          source: "ai",
          transcript,
          raw: result,
          confidence: score.confidence,
          filled: score.filled,
          total: score.total,
          changed: changed.map((k) => FIELD_LABELS[k]),
          latencyMs: Date.now() - startedAt,
        });
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
        pushDebug({
          source: "ai-error",
          transcript,
          raw: null,
          confidence: 0,
          filled: 0,
          total: Object.keys(EMPTY).length,
          changed: [],
          latencyMs: Date.now() - startedAt,
          error: err instanceof Error ? err.message : String(err),
        });
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
        const turn: Turn = {
          id: `t-${Date.now()}-${Math.random()}`,
          speaker: sp,
          text: finalText.trim(),
          ts: Date.now(),
        };
        setTurns((prev) => {
          const cleaned = prev.filter((p) => !p.interim);
          const next = [...cleaned, turn];
          // 1. Fast local regex pass for instant pre-fill
          const conv = next
            .filter((n) => n.speaker !== "ai" && !n.interim)
            .map((n) => n.text)
            .join(" ");
          const before = extractedRef.current;
          const after = extractFromTranscript(conv, before);
          const changed = diffFields(before, after);
          if (changed.length) setExtracted(after);
          const score = scoreConfidence(after as unknown as Record<string, unknown>);
          pushDebug({
            source: "regex",
            transcript: conv,
            raw: after,
            confidence: score.confidence,
            filled: score.filled,
            total: score.total,
            changed: changed.map((k) => FIELD_LABELS[k]),
          });
          // 2. Authoritative AI extraction (debounced)
          scheduleAiExtraction(next);
          return next;
        });
      }
      if (interim.trim()) {
        const sp = speakerRef.current;
        setTurns((prev) => {
          const cleaned = prev.filter((p) => !p.interim);
          const next = [
            ...cleaned,
            { id: "interim", speaker: sp, text: interim, ts: Date.now(), interim: true },
          ];
          const conv = next
            .filter((n) => n.speaker !== "ai")
            .map((n) => n.text)
            .join(" ");
          const before = extractedRef.current;
          const after = extractFromTranscript(conv, before);
          const changed = diffFields(before, after);
          if (changed.length) setExtracted(after);
          pushDebug({
            source: "interim",
            transcript: conv,
            raw: after,
            ...scoreConfidence(after as unknown as Record<string, unknown>),
            changed: changed.map((k) => FIELD_LABELS[k]),
          });
          return next;
        });
      }
    };
    rec.onerror = (e) => {
      setError(e.error || "Speech error");
      setListening(false);
    };
    rec.onend = () => {
      if (listening) {
        try {
          rec.start();
        } catch {
          /* noop */
        }
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
      try {
        rec.stop();
      } catch {
        /* noop */
      }
      setListening(false);
    } else {
      try {
        rec.start();
        setListening(true);
      } catch (err) {
        setError(String(err));
      }
    }
  }

  function reset() {
    try {
      recRef.current?.stop();
    } catch {
      /* noop */
    }
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* noop */
    }
    autoAskRef.current = false;
    submittedRef.current = false;

    setAutoAsk(false);
    lastAskedRef.current = null;
    setListening(false);
    setTurns([
      { id: "ai-0", speaker: "ai", text: "Cleared. Ready for next call.", ts: Date.now() },
    ]);
    setExtracted({ ...EMPTY });
  }

  // ------- Voice follow-up: ask client for any missing required info -------
  const REQUIRED_ORDER: (keyof Extracted)[] = [
    "customer_name",
    "phone_number",
    "company_name",
    "job_title",
    "net_income_jod",
    "financing_amount",
  ];
  const QUESTIONS: Record<string, { en: string; ar: string }> = {
    customer_name: {
      en: "May I have your full name, please?",
      ar: "ممكن تعطيني اسمك الكامل من فضلك؟",
    },
    phone_number: {
      en: "What is the best phone number to reach you on?",
      ar: "شو أفضل رقم هاتف للتواصل معك؟",
    },
    company_name: {
      en: "Where do you work? What is your employer's name?",
      ar: "وين بتشتغل؟ شو اسم جهة العمل؟",
    },
    job_title: {
      en: "And what is your job title there?",
      ar: "وشو المسمى الوظيفي تبعك؟",
    },
    net_income_jod: {
      en: "What is your monthly net income in Jordanian dinars?",
      ar: "كم دخلك الشهري الصافي بالدينار الأردني؟",
    },
    financing_amount: {
      en: "And how much financing are you looking for, in Jordanian dinars?",
      ar: "وكم المبلغ اللي بدك تموله، بالدينار الأردني؟",
    },
  };

  function nextMissing(ex: Extracted): keyof Extracted | null {
    for (const k of REQUIRED_ORDER) {
      const v = (ex as Record<string, string>)[k] ?? "";
      if (k === "net_income_jod" || k === "financing_amount") {
        if (!v || isNaN(Number(v)) || Number(v) <= 0) return k;
      } else {
        if (!v || v.trim().length < 2) return k;
      }
    }
    return null;
  }

  async function speak(text: string) {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    askingRef.current = true;
    setSpeaking(true);
    // Pause the mic to avoid the system hearing its own voice
    try {
      recRef.current?.stop();
    } catch {
      /* noop */
    }
    setTurns((prev) => [
      ...prev,
      { id: `ask-${Date.now()}`, speaker: "ai", text: `🔊 ${text}`, ts: Date.now() },
    ]);
    await new Promise<void>((resolve) => {
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = langRef.current;
        u.rate = 1;
        u.pitch = 1;
        u.onend = () => resolve();
        u.onerror = () => resolve();
        window.speechSynthesis.speak(u);
      } catch {
        resolve();
      }
    });
    askingRef.current = false;
    setSpeaking(false);
    // Resume listening so we can hear the client's answer
    if (autoAskRef.current || listeningRef.current) {
      try {
        recRef.current?.start();
        setListening(true);
        setSpeaker("client");
      } catch {
        /* noop */
      }
    }
  }

  async function askNextMissing() {
    const miss = nextMissing(extractedRef.current);
    if (!miss) {
      autoAskRef.current = false;
      setAutoAsk(false);
      lastAskedRef.current = null;
      await speak(
        langRef.current === "ar-JO"
          ? "شكراً، اكتملت كل المعلومات المطلوبة."
          : "Thank you. I have all the information I need.",
      );
      return;
    }
    lastAskedRef.current = miss;
    const q = QUESTIONS[miss];
    await speak(langRef.current === "ar-JO" ? q.ar : q.en);
  }

  function startAutoAsk() {
    autoAskRef.current = true;
    setAutoAsk(true);
    setSpeaker("client");
    void askNextMissing();
  }

  function stopAutoAsk() {
    autoAskRef.current = false;
    setAutoAsk(false);
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* noop */
    }
    setSpeaking(false);
    askingRef.current = false;
  }

  // After extraction updates, if auto-ask is on and we're idle (not speaking,
  // no AI pass pending), ask the next missing question after a short pause to
  // let the client finish answering.
  useEffect(() => {
    if (!autoAsk) return;
    if (askingRef.current || aiThinking) return;
    const miss = nextMissing(extracted);
    const t = setTimeout(() => {
      if (!autoAskRef.current) return;
      if (askingRef.current) return;
      // If the field they were just asked is now filled, move to next one.
      // If still empty, re-prompt with the same question.
      if (miss) void askNextMissing();
      else void askNextMissing(); // triggers the "thank you" + stops
    }, 1800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extracted, autoAsk, aiThinking]);

  const ccNotes = useMemo(() => {
    const lines = turns
      .filter((t) => t.speaker !== "ai" && !t.interim)
      .map((t) => `${t.speaker === "client" ? "Client" : "Agent"}: ${t.text}`);
    const conv = lines.join("\n");
    const fin: string[] = [];
    if (extracted.other_income_jod) fin.push(`Other income: JOD ${extracted.other_income_jod}/mo`);
    if (extracted.existing_obligations_jod)
      fin.push(`Existing obligations: JOD ${extracted.existing_obligations_jod}/mo`);
    if (extracted.years_in_current_job) fin.push(`Tenure: ${extracted.years_in_current_job} yrs`);
    if (extracted.dependents) fin.push(`Dependents: ${extracted.dependents}`);
    if (extracted.financial_notes) fin.push(`Notes: ${extracted.financial_notes}`);
    const finBlock = fin.length ? `\n\n— Financial Status —\n${fin.join(" · ")}` : "";
    return (conv + finBlock).slice(0, 800);
  }, [turns, extracted]);

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
      `Lead ${lead.lead_id} routed to ${rlmName} · ${lead.priority} · AI Score ${lead.ai_score}/100`,
    );
    reset();
  }

  // Auto-submit to Sales Queue once every required field is valid.
  const submittedRef = useRef(false);
  useEffect(() => {
    if (submittedRef.current) return;
    const isValid =
      extracted.customer_name.trim().length >= 3 &&
      /^[+\d][\d\s+()-]{6,}$/.test(extracted.phone_number) &&
      extracted.company_name.trim().length >= 2 &&
      extracted.job_title.trim().length >= 2 &&
      !!extracted.net_income_jod &&
      !isNaN(Number(extracted.net_income_jod)) &&
      Number(extracted.net_income_jod) > 0 &&
      !!extracted.financing_amount &&
      !isNaN(Number(extracted.financing_amount)) &&
      Number(extracted.financing_amount) > 0 &&
      ccNotes.length >= 20;
    if (!isValid) return;
    submittedRef.current = true;
    autoAskRef.current = false;
    setAutoAsk(false);
    const t = setTimeout(() => {
      void (async () => {
        await speak(
          langRef.current === "ar-JO"
            ? "تمام، كل المعلومات اكتملت. رح أرسل الطلب لفريق المبيعات الآن."
            : "All information is complete. Sending your application to the sales team now.",
        );
        submit();
      })();
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extracted, ccNotes]);


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
                Speaking as{" "}
                <strong>{speaker === "client" ? "the Client" : "the Bank Agent"}</strong>
                {" · "}
                {lang === "en-US" ? "English" : "Arabic (Jordan)"}
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
                Speech recognition is not available in this browser. Use Chrome/Edge for live
                transcription.
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
                <button
                  onClick={autoAsk ? stopAutoAsk : startAutoAsk}
                  className={`flex items-center gap-2 px-3 py-2 rounded-full text-xs font-semibold transition-colors ${
                    autoAsk
                      ? "bg-amber-500 text-white animate-pulse"
                      : "bg-emerald-600 text-white hover:opacity-90"
                  }`}
                  title="Voice-prompt the client for any missing required information"
                >
                  <span className="text-sm">{speaking ? "🔊" : autoAsk ? "⏸" : "🤖"}</span>
                  {autoAsk
                    ? speaking
                      ? "Asking…"
                      : "Stop Auto-Ask"
                    : "Ask Missing Info"}
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
            <span
              className={`text-[10px] px-2 py-0.5 rounded font-bold ${aiThinking ? "bg-primary text-primary-foreground animate-pulse" : "bg-gold text-gold-foreground"}`}
            >
              {aiThinking ? "AI THINKING…" : "LIVE"}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
            <Field
              label="Customer Name"
              value={extracted.customer_name}
              onChange={(v) => setExtracted({ ...extracted, customer_name: v })}
            />
            <Field
              label="Phone"
              value={extracted.phone_number}
              onChange={(v) => setExtracted({ ...extracted, phone_number: v })}
            />
            <Field
              label="Employer / Company"
              value={extracted.company_name}
              onChange={(v) => setExtracted({ ...extracted, company_name: v })}
            />
            <Field
              label="Job Title"
              value={extracted.job_title}
              onChange={(v) => setExtracted({ ...extracted, job_title: v })}
            />
            <div className="grid grid-cols-2 gap-3">
              <Select
                label="Product"
                value={extracted.product}
                options={PRODUCTS as unknown as string[]}
                onChange={(v) => setExtracted({ ...extracted, product: v as Product })}
              />
              <Select
                label="Work Duration"
                value={extracted.work_duration}
                options={WORK_DURATIONS as unknown as string[]}
                onChange={(v) => setExtracted({ ...extracted, work_duration: v })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Financing (JOD)"
                value={extracted.financing_amount}
                onChange={(v) => setExtracted({ ...extracted, financing_amount: v })}
              />
              <Field
                label="Salary (JOD/month)"
                value={extracted.net_income_jod}
                onChange={(v) => setExtracted({ ...extracted, net_income_jod: v })}
              />
            </div>

            <div className="rounded border border-emerald-200 bg-emerald-50/40 p-2.5 space-y-2">
              <div className="text-[10px] uppercase font-bold text-emerald-800">
                💰 Financial Status (additional)
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Other Income (JOD/mo)"
                  value={extracted.other_income_jod}
                  onChange={(v) => setExtracted({ ...extracted, other_income_jod: v })}
                />
                <Field
                  label="Existing Obligations (JOD/mo)"
                  value={extracted.existing_obligations_jod}
                  onChange={(v) => setExtracted({ ...extracted, existing_obligations_jod: v })}
                />
                <Field
                  label="Years in Current Job"
                  value={extracted.years_in_current_job}
                  onChange={(v) => setExtracted({ ...extracted, years_in_current_job: v })}
                />
                <Field
                  label="Dependents"
                  value={extracted.dependents}
                  onChange={(v) => setExtracted({ ...extracted, dependents: v })}
                />
              </div>
              <div>
                <div className="text-[10px] uppercase font-semibold text-zinc-500 mb-1">
                  Financial Notes (assets, other banks, history…)
                </div>
                <textarea
                  value={extracted.financial_notes}
                  onChange={(e) => setExtracted({ ...extracted, financial_notes: e.target.value })}
                  rows={2}
                  className={`w-full border rounded px-2 py-1.5 text-xs ${extracted.financial_notes ? "bg-gold/5 border-gold/40" : "border-zinc-300"}`}
                  placeholder="—"
                />
              </div>
            </div>

            <Select
              label="Channel"
              value={extracted.channel}
              options={CHANNELS as unknown as string[]}
              onChange={(v) => setExtracted({ ...extracted, channel: v })}
            />


            <div>
              <div className="text-[10px] uppercase font-semibold text-zinc-500 mb-1">
                Auto-generated CC Notes
              </div>
              <div className="border rounded bg-zinc-50 p-2 text-[11px] whitespace-pre-wrap max-h-32 overflow-y-auto">
                {ccNotes || (
                  <span className="text-muted-foreground italic">
                    Will populate from the conversation.
                  </span>
                )}
              </div>
              <div className="text-[10px] text-right text-muted-foreground mt-0.5">
                {ccNotes.length} / 800
              </div>
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

      {/* Live Debug Panel */}
      <div className="px-6 pb-6">
        <div className="elip-card overflow-hidden">
          <button
            onClick={() => setShowDebug((s) => !s)}
            className="w-full px-4 py-2 border-b bg-zinc-900 text-zinc-100 flex items-center justify-between text-xs font-mono"
          >
            <span>
              🐞 LIVE DEBUG · {debugLog.length} event{debugLog.length === 1 ? "" : "s"} · latest
              source: <strong className="text-gold">{debugLog[0]?.source ?? "—"}</strong>
              {debugLog[0] && (
                <>
                  {" · conf "}
                  <strong className="text-gold">
                    {(debugLog[0].confidence * 100).toFixed(0)}%
                  </strong>
                  {" ("}
                  {debugLog[0].filled}/{debugLog[0].total}
                  {" fields)"}
                </>
              )}
            </span>
            <span>{showDebug ? "▾ hide" : "▸ show"}</span>
          </button>
          {showDebug && (
            <div className="max-h-[420px] overflow-y-auto divide-y divide-zinc-800 bg-zinc-950 text-zinc-100 font-mono text-[11px]">
              {debugLog.length === 0 && (
                <div className="p-4 text-zinc-500 italic">
                  No extraction events yet. Start listening and speak — every regex and AI pass will
                  appear here.
                </div>
              )}
              {debugLog.map((d) => {
                const pct = Math.round(d.confidence * 100);
                const tone =
                  d.source === "ai-error"
                    ? "bg-red-600 text-white"
                    : d.source === "ai"
                      ? "bg-emerald-600 text-white"
                      : d.source === "interim"
                        ? "bg-violet-600 text-white"
                        : "bg-sky-600 text-white";
                return (
                  <div key={d.id} className="p-3 grid grid-cols-12 gap-3">
                    <div className="col-span-2 space-y-1">
                      <div
                        className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${tone}`}
                      >
                        {d.source}
                      </div>
                      <div className="text-zinc-400 text-[10px]">
                        {new Date(d.ts).toLocaleTimeString("en-GB", { hour12: false })}
                      </div>
                      {d.latencyMs !== undefined && (
                        <div className="text-zinc-400 text-[10px]">{d.latencyMs} ms</div>
                      )}
                      <div className="text-[10px]">
                        <span className="text-zinc-400">conf </span>
                        <span
                          className={
                            pct >= 70
                              ? "text-emerald-400"
                              : pct >= 40
                                ? "text-amber-300"
                                : "text-red-400"
                          }
                        >
                          {pct}%
                        </span>
                        <span className="text-zinc-500">
                          {" "}
                          ({d.filled}/{d.total})
                        </span>
                      </div>
                      {d.changed.length > 0 && (
                        <div className="text-[10px] text-gold">Δ {d.changed.join(", ")}</div>
                      )}
                    </div>
                    <div className="col-span-5">
                      <div className="text-[10px] uppercase text-zinc-500 mb-1">
                        Transcript sent
                      </div>
                      <pre className="whitespace-pre-wrap break-words text-zinc-200 max-h-40 overflow-y-auto">
                        {d.transcript || "(empty)"}
                      </pre>
                    </div>
                    <div className="col-span-5">
                      <div className="text-[10px] uppercase text-zinc-500 mb-1">
                        {d.error ? "Error" : "Raw extracted JSON"}
                      </div>
                      <pre className="whitespace-pre-wrap break-words text-emerald-300 max-h-40 overflow-y-auto">
                        {d.error ? d.error : JSON.stringify(d.raw, null, 2)}
                      </pre>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
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

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase font-semibold text-zinc-500 mb-1">{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-zinc-300 rounded px-2 py-1.5 text-sm bg-white"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}
