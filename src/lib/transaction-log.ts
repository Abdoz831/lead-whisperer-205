// Lightweight cross-system transaction log. Persists to localStorage so any
// surface (Hermes Hub, sales pipeline, call assistant, audit) can append
// without a backend round-trip.

import { useEffect, useState } from "react";

export type TxKind =
  | "lead.created"
  | "lead.status_changed"
  | "lead.enriched"
  | "call.started"
  | "call.completed"
  | "call.extracted"
  | "hermes.invoked"
  | "hermes.error"
  | "followup.advice"
  | "outbound.search"
  | "outbound.prospect_added"
  | "audit.explain"
  | "agents.killed"
  | "agents.enabled"
  | "system";

export type TxStatus = "success" | "error" | "info" | "warning";

export interface Transaction {
  id: string;
  ts: string; // ISO
  kind: TxKind;
  status: TxStatus;
  source: string; // surface / module
  actor?: string; // user or agent
  subject?: string; // entity id (lead id, call id, etc)
  summary: string;
  meta?: Record<string, unknown>;
}

const KEY = "elip_tx_log_v1";
const MAX = 500;
const EVT = "elip:tx-log";

function read(): Transaction[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Transaction[]) : [];
  } catch {
    return [];
  }
}

function write(list: Transaction[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
    window.dispatchEvent(new CustomEvent(EVT));
  } catch {
    /* ignore */
  }
}

export function logTransaction(tx: Omit<Transaction, "id" | "ts"> & { ts?: string }) {
  if (typeof window === "undefined") return;
  const next: Transaction = {
    id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ts: tx.ts ?? new Date().toISOString(),
    ...tx,
  };
  write([next, ...read()]);
}

export function clearTransactionLog() {
  write([]);
}

export function useTransactionLog(): Transaction[] {
  const [list, setList] = useState<Transaction[]>(() => read());
  useEffect(() => {
    const sync = () => setList(read());
    window.addEventListener(EVT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return list;
}

// Seed sample / synthetic baseline so the tab is never empty on first load.
export function seedTransactionLogIfEmpty() {
  if (typeof window === "undefined") return;
  if (read().length > 0) return;
  const now = Date.now();
  const mk = (mins: number, t: Omit<Transaction, "id" | "ts">): Transaction => ({
    id: `tx_seed_${mins}_${Math.random().toString(36).slice(2, 6)}`,
    ts: new Date(now - mins * 60_000).toISOString(),
    ...t,
  });
  const seed: Transaction[] = [
    mk(2, { kind: "hermes.invoked", status: "success", source: "elip-sales", actor: "Omar Khaled", summary: "Hermes drafted re-call script for L-0142", subject: "L-0142" }),
    mk(7, { kind: "lead.status_changed", status: "info", source: "sales.pipeline", actor: "Omar Khaled", subject: "L-0141", summary: "L-0141: Docs Pending → Underwriting" }),
    mk(11, { kind: "call.extracted", status: "success", source: "call-centre.assistant", actor: "Ahmad Hliessie", subject: "call_8821", summary: "AI extracted 7 fields from call_8821 (income, employer, product)" }),
    mk(18, { kind: "followup.advice", status: "success", source: "sales.pipeline.followup", actor: "Hermes", subject: "L-0138", summary: "Follow-up advice: Waiting Documents → send reminder + checklist" }),
    mk(25, { kind: "outbound.search", status: "success", source: "sales.pipeline.outbound", actor: "Hermes/Tavily", summary: "Outbound search: 12 elite prospects matched (Amman, >2.5k JOD, Director+)" }),
    mk(32, { kind: "lead.enriched", status: "success", source: "sales.pipeline", subject: "L-0140", actor: "Hermes", summary: "L-0140 enriched: LinkedIn profile + 3 talking points" }),
    mk(44, { kind: "audit.explain", status: "info", source: "management.audit", subject: "L-0119", summary: "XAI X-2 counterfactual generated for declined lead L-0119" }),
    mk(58, { kind: "hermes.error", status: "error", source: "elip-reactivation", summary: "Hermes /healthz unreachable (timeout 8s) — retrying", meta: { http: 504 } }),
    mk(70, { kind: "lead.created", status: "success", source: "call-centre.assistant", actor: "Ahmad Hliessie", subject: "L-0143", summary: "New lead L-0143 captured via AI Call Assistant" }),
    mk(95, { kind: "agents.enabled", status: "info", source: "management.hermes", actor: "Haneen Qudah", summary: "Kill switch released — agents back online" }),
  ];
  write(seed);
}

export const TX_KIND_LABEL: Record<TxKind, string> = {
  "lead.created": "Lead Created",
  "lead.status_changed": "Status Change",
  "lead.enriched": "Lead Enriched",
  "call.started": "Call Started",
  "call.completed": "Call Completed",
  "call.extracted": "Call Extracted",
  "hermes.invoked": "Hermes Invoked",
  "hermes.error": "Hermes Error",
  "followup.advice": "Follow-up Advice",
  "outbound.search": "Outbound Search",
  "outbound.prospect_added": "Prospect Added",
  "audit.explain": "XAI Explain",
  "agents.killed": "Agents Killed",
  "agents.enabled": "Agents Enabled",
  "system": "System",
};
