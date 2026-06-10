import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type Role = "cc" | "rlm" | "tl";

export const PRODUCTS = [
  "Personal Loan",
  "Mortgage",
  "Housing Loan",
  "Auto Loan",
  "Credit Card",
  "Buyout Personal Loan",
  "Buyout Credit Card",
  "Buyout Housing Loan",
  "PLCC",
] as const;
export type Product = (typeof PRODUCTS)[number];

export const LPW: Record<Product, number> = {
  Mortgage: 4.5,
  "Housing Loan": 4.5,
  "Auto Loan": 2.0,
  "Personal Loan": 1.5,
  "Buyout Personal Loan": 1.5,
  "Buyout Housing Loan": 1.5,
  "Buyout Credit Card": 1.5,
  "Credit Card": 0.5,
  PLCC: 0.5,
};

export const CHANNELS = [
  "Inbound Call",
  "Web Chat",
  "Loan Calculator",
  "Contact-Us Form",
  "Outbound List",
  "Workspace 4",
] as const;

export const WORK_DURATIONS = [
  "Less than 3 months",
  "3–6 months",
  "6–9 months",
  "9 months–1 year",
  "1–2 years",
  "2–3 years",
  "More than 3 years",
] as const;

export const RLMS = [
  { id: "rlm-001", name: "Omar Khaled" },
  { id: "rlm-002", name: "Sara Nasser" },
  { id: "rlm-003", name: "Yousef Issa" },
  { id: "rlm-004", name: "Lina Faraj" },
  { id: "rlm-005", name: "Tariq Mansour" },
  { id: "rlm-006", name: "Rana Habash" },
  { id: "rlm-007", name: "Khalil Daoud" },
];

export const AGENTS = [
  { id: "cc-001", name: "Ahmad Hliessie", desk: "Desk 1 (Haneen)" },
  { id: "cc-002", name: "Noor Salem", desk: "Desk 2 (Ghadeer)" },
  { id: "cc-003", name: "Maya Khoury", desk: "Desk 3 (Lubna)" },
];

export type Priority = "P1" | "P2" | "P3" | "P4";
export type Temp = "Hot" | "Medium" | "Cold" | "N/A";
export type Stage =
  | "Queued"
  | "No Answer"
  | "Follow-up Scheduled"
  | "Docs Pending"
  | "Booked"
  | "Underwriting"
  | "Approved"
  | "Closed Won"
  | "RLM-Reject"
  | "RLM-Expired"
  | "Rejected";

export type Blocker = "" | "Docs Missing" | "Credit Score Issue" | "Pending Review";

export interface Lead {
  lead_id: string;
  customer_name: string;
  customer_cif: string;
  phone_number: string;
  net_income_jod: number;
  company_name: string;
  product: Product;
  financing_amount: number;
  work_duration: string;
  job_title: string;
  cc_notes: string;
  channel: string;
  submitted_by_agent: string;
  submitted_at: string;
  ai_score: number;
  priority: Priority;
  lpw_multiplier: number;
  best_time_to_call: string;
  assigned_rlm: string;
  current_status: Stage;
  deal_temperature: Temp;
  closing_blocker: Blocker;
  days_in_pipeline: number;
  appian_ticket: string;
  rlm_notes: string;
  status_history: { ts: string; by: string; from: Stage; to: Stage }[];
  outcome: "" | "closed_won" | "rlm_reject" | "rlm_expired";
  affiliate_redirect: boolean;
  group_salvage_status: string;
  last_update_hours: number;
  no_answer_attempts: number;
  next_call_window: string;
}

export function calcBestTime(company: string): string {
  const c = company.toLowerCase();
  if (/وزارة|ministry/i.test(company)) return "3:30 PM — Ministry pattern, 87% answer rate";
  if (/مستشفى|hospital|medical/i.test(company)) return "1:00 PM — Medical shift break, 91% answer rate";
  if (/bank|بنك/i.test(company)) return "12:30 PM — Banker lunch break, 83% answer rate";
  if (/جامعة|university/i.test(company)) return "2:00 PM — Academic break, 79% answer rate";
  if (/military|security|أمن|عسكر/i.test(company)) return "5:30 PM — Post-duty hours, 88% answer rate";
  return "8:30 AM — Before morning meetings, 76% answer rate";
}

export function calcAIScore(l: Partial<Lead>): { score: number; priority: Priority } {
  let s = 40;
  const amt = l.financing_amount ?? 0;
  if (amt > 100000) s += 25;
  else if (amt > 50000) s += 15;
  else if (amt > 20000) s += 8;
  const inc = l.net_income_jod ?? 0;
  if (inc > 2000) s += 15;
  else if (inc > 1000) s += 8;
  const p = l.product as Product | undefined;
  if (p && LPW[p] >= 4) s += 15;
  else if (p && LPW[p] >= 2) s += 8;
  if (/وزارة|ministry|government/i.test(l.company_name ?? "")) s += 10;
  s = Math.min(100, Math.max(10, s + Math.floor(Math.random() * 6)));
  const priority: Priority = s >= 86 ? "P1" : s >= 70 ? "P2" : s >= 50 ? "P3" : "P4";
  return { score: s, priority };
}

function mk(partial: Partial<Lead>, idx: number): Lead {
  const product = (partial.product ?? "Mortgage") as Product;
  const merged: Partial<Lead> = { product, financing_amount: 50000, net_income_jod: 1500, ...partial };
  const { score, priority } = calcAIScore(merged);
  const base: Lead = {
    lead_id: partial.lead_id ?? `L-${String(1000 + idx).padStart(4, "0")}`,
    customer_name: "—",
    customer_cif: "NA",
    phone_number: "+9627" + Math.floor(10000000 + Math.random() * 89999999),
    net_income_jod: 1500,
    company_name: "—",
    product,
    financing_amount: 50000,
    work_duration: "More than 3 years",
    job_title: "Officer",
    cc_notes: "",
    channel: "Inbound Call",
    submitted_by_agent: "cc-001",
    submitted_at: new Date(Date.now() - idx * 86400000).toISOString(),
    ai_score: score,
    priority,
    lpw_multiplier: LPW[product],
    best_time_to_call: calcBestTime(partial.company_name ?? ""),
    assigned_rlm: RLMS[idx % RLMS.length].id,
    current_status: "Docs Pending",
    deal_temperature: "Medium",
    closing_blocker: "",
    days_in_pipeline: idx,
    appian_ticket: "",
    rlm_notes: "",
    status_history: [],
    outcome: "",
    affiliate_redirect: false,
    group_salvage_status: "",
    last_update_hours: 4,
    no_answer_attempts: 0,
    next_call_window: "",
  };
  return { ...base, ...partial, ai_score: score, priority, lpw_multiplier: LPW[product], best_time_to_call: calcBestTime(partial.company_name ?? "—") };
}

const seedRaw: Partial<Lead>[] = [
  { customer_name: "Mahmoud Al-Rashid", company_name: "وزارة المالية", product: "Mortgage", financing_amount: 120000, net_income_jod: 2400, current_status: "Docs Pending", deal_temperature: "Medium", appian_ticket: "RLM-340498", cc_notes: "Customer interested in mortgage. All documents ready. Prefers morning calls.", last_update_hours: 6 },
  { customer_name: "Layla Hijazi", company_name: "Housing Bank", product: "Mortgage", financing_amount: 80000, net_income_jod: 2000, current_status: "Docs Pending", deal_temperature: "Hot", appian_ticket: "RLM-340498", cc_notes: "Urgent — customer has pre-approval elsewhere. We need to move fast.", last_update_hours: 3 },
  { customer_name: "Faisal & Reem Odeh", company_name: "Royal Jordanian", product: "Mortgage", financing_amount: 332300, net_income_jod: 3200, current_status: "Docs Pending", deal_temperature: "Medium", cc_notes: "Joint application — husband and wife. Both employed. Income JOD 3,000+ combined.", last_update_hours: 12 },
  { customer_name: "Hassan Younis", company_name: "Aramex", product: "Mortgage", financing_amount: 60000, net_income_jod: 1800, current_status: "Docs Pending", deal_temperature: "Hot", appian_ticket: "RLM-348001", cc_notes: "Customer already has a property in mind. Motivated to proceed immediately.", last_update_hours: 2 },
  { customer_name: "Dina Qasem", company_name: "Zain Jordan", product: "Auto Loan", financing_amount: 24448, net_income_jod: 1400, current_status: "Docs Pending", deal_temperature: "Hot", appian_ticket: "RLM-346863", cc_notes: "Has JOD 4,000 down payment ready. Car price JOD 20,000. Wants quick processing.", last_update_hours: 5 },
  { customer_name: "Omar Bishara", company_name: "Orange Telecom", product: "Mortgage", financing_amount: 116000, net_income_jod: 2200, current_status: "Docs Pending", deal_temperature: "Medium", appian_ticket: "RLM-282526", closing_blocker: "Docs Missing", cc_notes: "Customer said documents are ready but not submitted yet. Follow up on title deed.", last_update_hours: 80 * 24 },
  { customer_name: "Rasha Najjar", company_name: "Arab Potash", product: "Mortgage", financing_amount: 70000, net_income_jod: 1900, current_status: "Docs Pending", deal_temperature: "Cold", appian_ticket: "RLM-296729", closing_blocker: "Docs Missing", cc_notes: "Customer was engaged but went silent. Last contact 33 days ago. Needs TL attention.", last_update_hours: 33 * 24 },
  { customer_name: "Bashar Atallah", company_name: "Self-employed", product: "Mortgage", financing_amount: 99100, net_income_jod: 2100, current_status: "Rejected", deal_temperature: "Cold", appian_ticket: "RLM-307016", closing_blocker: "Docs Missing", cc_notes: "Customer had missing documents. Policy issue. Consider Group Salvage redirect.", last_update_hours: 100 * 24 },
  { customer_name: "Hala Mansour", company_name: "Arab Bank", product: "Personal Loan", financing_amount: 75000, net_income_jod: 1800, current_status: "Docs Pending", deal_temperature: "Medium", appian_ticket: "RLM-340608", closing_blocker: "Credit Score Issue", cc_notes: "Customer has existing loan at Arab Bank JOD 45,000. Wants buyout + top-up. Check DBR.", last_update_hours: 18 },
  { customer_name: "Nader Saif", company_name: "Self-employed", product: "Personal Loan", financing_amount: 77000, net_income_jod: 2200, current_status: "Docs Pending", deal_temperature: "Medium", appian_ticket: "RLM-340704", closing_blocker: "Credit Score Issue", cc_notes: "Self-employed. Income strong but irregular. Needs income documentation review.", last_update_hours: 22 },
  { customer_name: "Ibrahim Tahboub", company_name: "وزارة الداخلية", product: "Mortgage", financing_amount: 152000, net_income_jod: 2800, current_status: "Approved", deal_temperature: "N/A", appian_ticket: "RLM-307070", cc_notes: "Senior government employee. High-value. Smooth process expected.", last_update_hours: 4, outcome: "closed_won" },
  { customer_name: "Maysoon Daoud", company_name: "Jordan Hospital", product: "Mortgage", financing_amount: 56400, net_income_jod: 1700, current_status: "Approved", deal_temperature: "N/A", appian_ticket: "RLM-310013", cc_notes: "Customer cooperative throughout process. Straightforward application.", last_update_hours: 6, outcome: "closed_won" },
  { customer_name: "Tareq & Lina Halaby", company_name: "University of Jordan", product: "Mortgage", financing_amount: 94900, net_income_jod: 2600, current_status: "Approved", deal_temperature: "N/A", appian_ticket: "RLM-299842", cc_notes: "Joint application. Both applicants have clean credit history.", last_update_hours: 8, outcome: "closed_won" },
  { customer_name: "Sami Khoury", company_name: "Aramex", product: "Mortgage", financing_amount: 57000, net_income_jod: 1900, current_status: "Approved", deal_temperature: "N/A", appian_ticket: "RLM-318239", cc_notes: "Customer referred by existing client. Reliable profile.", last_update_hours: 10, outcome: "closed_won" },
  { customer_name: "Yara Salim", company_name: "MedLabs", product: "Personal Loan", financing_amount: 56000, net_income_jod: 1600, current_status: "Docs Pending", deal_temperature: "Hot", appian_ticket: "RLM-356359", closing_blocker: "Credit Score Issue", cc_notes: "Motivated customer. Has late payment flag — discuss with credit before calling.", last_update_hours: 14 },
];

const queueRaw: Partial<Lead>[] = [
  { customer_name: "Adel Karam", company_name: "وزارة التربية", product: "Mortgage", financing_amount: 95000, net_income_jod: 2200, current_status: "Queued", cc_notes: "Teacher with 15 years tenure. Wants to buy a flat in Amman. Has 20% down payment saved. Prefers afternoon calls.", channel: "Inbound Call" },
  { customer_name: "Nadia Hammad", company_name: "King Hussein Cancer Center", product: "Auto Loan", financing_amount: 28000, net_income_jod: 1700, current_status: "Queued", cc_notes: "Nurse, dual income with spouse. Needs car within 2 weeks. Has trade-in vehicle.", channel: "Web Chat" },
  { customer_name: "Fadi Sabbagh", company_name: "Cairo Amman Bank", product: "Buyout Personal Loan", financing_amount: 35000, net_income_jod: 2100, current_status: "Queued", cc_notes: "Wants to consolidate two credit cards plus an existing PL. Total outstanding JOD 28K. Lunch break works best.", channel: "Inbound Call" },
  { customer_name: "Maha Rifai", company_name: "PwC Jordan", product: "Credit Card", financing_amount: 8000, net_income_jod: 2500, current_status: "Queued", cc_notes: "Senior auditor. Wants platinum card with travel benefits. Asked about FX rates and lounge access.", channel: "Loan Calculator" },
];

let LEAD_COUNTER = 0;
const initialLeads: Lead[] = [
  ...seedRaw.map((p, i) => mk(p, i)),
  ...queueRaw.map((p, i) => mk(p, i + 100)),
];
LEAD_COUNTER = initialLeads.length + 1;

interface DataCtx {
  role: Role;
  setRole: (r: Role) => void;
  currentUser: { id: string; name: string };
  leads: Lead[];
  addLead: (l: Omit<Lead, "lead_id" | "ai_score" | "priority" | "lpw_multiplier" | "best_time_to_call" | "assigned_rlm" | "submitted_at" | "current_status" | "status_history" | "outcome" | "affiliate_redirect" | "group_salvage_status" | "last_update_hours" | "no_answer_attempts" | "next_call_window" | "deal_temperature" | "closing_blocker" | "days_in_pipeline" | "appian_ticket" | "rlm_notes">) => { lead: Lead; rlmName: string };
  updateLead: (id: string, patch: Partial<Lead>) => void;
  acknowledged: Set<string>;
  acknowledge: (id: string) => void;
}

const Ctx = createContext<DataCtx | null>(null);

export function ElipProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>("rlm");
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [acknowledged, setAck] = useState<Set<string>>(new Set());

  const currentUser = useMemo(() => {
    if (role === "cc") return { id: "cc-001", name: "Ahmad Hliessie" };
    if (role === "rlm") return { id: "rlm-001", name: "Omar Khaled" };
    return { id: "tl-001", name: "Haneen Qudah" };
  }, [role]);

  const value: DataCtx = {
    role,
    setRole,
    currentUser,
    leads,
    addLead: (input) => {
      const { score, priority } = calcAIScore(input);
      // pick lowest-load RLM
      const counts = new Map<string, number>();
      RLMS.forEach((r) => counts.set(r.id, 0));
      leads.forEach((l) => {
        if (!["Closed Won", "RLM-Reject", "RLM-Expired"].includes(l.current_status))
          counts.set(l.assigned_rlm, (counts.get(l.assigned_rlm) ?? 0) + 1);
      });
      const sorted = [...counts.entries()].sort((a, b) => a[1] - b[1]);
      const rlmId = sorted[0][0];
      const rlmName = RLMS.find((r) => r.id === rlmId)!.name;
      const lead: Lead = {
        ...input,
        lead_id: `L-${String(LEAD_COUNTER++).padStart(4, "0")}`,
        ai_score: score,
        priority,
        lpw_multiplier: LPW[input.product],
        best_time_to_call: calcBestTime(input.company_name),
        assigned_rlm: rlmId,
        submitted_at: new Date().toISOString(),
        current_status: "Queued",
        status_history: [],
        outcome: "",
        affiliate_redirect: false,
        group_salvage_status: "",
        last_update_hours: 0,
        no_answer_attempts: 0,
        next_call_window: "",
        deal_temperature: priority === "P1" ? "Hot" : priority === "P2" ? "Hot" : "Medium",
        closing_blocker: "",
        days_in_pipeline: 0,
        appian_ticket: "",
        rlm_notes: "",
      };
      setLeads((prev) => [lead, ...prev]);
      return { lead, rlmName };
    },
    updateLead: (id, patch) => {
      setLeads((prev) => prev.map((l) => (l.lead_id === id ? { ...l, ...patch, last_update_hours: 0 } : l)));
    },
    acknowledged,
    acknowledge: (id) => setAck((s) => new Set(s).add(id)),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useElip() {
  const v = useContext(Ctx);
  if (!v) throw new Error("ElipProvider missing");
  return v;
}

export function rlmName(id: string): string {
  return RLMS.find((r) => r.id === id)?.name ?? id;
}

export function priorityClass(p: Priority): string {
  return p === "P1"
    ? "bg-[var(--p1)] text-white"
    : p === "P2"
    ? "bg-[var(--p2)] text-white"
    : p === "P3"
    ? "bg-[var(--p3)] text-white"
    : "bg-[var(--p4)] text-white";
}

export function stageClass(s: Stage): string {
  switch (s) {
    case "No Answer": return "bg-muted text-foreground";
    case "Follow-up Scheduled": return "bg-blue-100 text-blue-900";
    case "Docs Pending": return "bg-orange-100 text-orange-900";
    case "Booked": return "bg-gold text-gold-foreground";
    case "Underwriting": return "bg-purple-100 text-purple-900";
    case "Approved": return "bg-green-100 text-green-900";
    case "Closed Won": return "bg-green-700 text-white font-semibold";
    case "RLM-Reject": return "bg-red-100 text-red-900";
    case "RLM-Expired": return "bg-zinc-200 text-zinc-700 italic";
    case "Rejected": return "bg-red-100 text-red-900";
    case "Queued": return "bg-zinc-100 text-zinc-800";
  }
}
