import { useEffect, useMemo, useState } from "react";
import {
  TX_KIND_LABEL,
  clearTransactionLog,
  seedTransactionLogIfEmpty,
  useTransactionLog,
  type TxKind,
  type TxStatus,
} from "@/lib/transaction-log";

const STATUS_TONE: Record<TxStatus, string> = {
  success: "bg-emerald-100 text-emerald-900 border-emerald-300",
  error: "bg-rose-100 text-rose-900 border-rose-300",
  warning: "bg-amber-100 text-amber-900 border-amber-300",
  info: "bg-sky-100 text-sky-900 border-sky-300",
};

const STATUS_DOT: Record<TxStatus, string> = {
  success: "bg-emerald-500",
  error: "bg-rose-500",
  warning: "bg-amber-500",
  info: "bg-sky-500",
};

function fmtRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function TransactionLogPanel() {
  useEffect(() => {
    seedTransactionLogIfEmpty();
  }, []);

  const all = useTransactionLog();
  const [kind, setKind] = useState<TxKind | "all">("all");
  const [status, setStatus] = useState<TxStatus | "all">("all");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return all.filter((t) => {
      if (kind !== "all" && t.kind !== kind) return false;
      if (status !== "all" && t.status !== status) return false;
      if (term) {
        const hay = `${t.summary} ${t.source} ${t.actor ?? ""} ${t.subject ?? ""}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [all, kind, status, q]);

  const counts = useMemo(() => {
    const out = { success: 0, error: 0, warning: 0, info: 0 } as Record<TxStatus, number>;
    all.forEach((t) => (out[t.status] += 1));
    return out;
  }, [all]);

  function exportCsv() {
    const rows = [
      ["ts", "kind", "status", "source", "actor", "subject", "summary"],
      ...filtered.map((t) => [
        t.ts,
        t.kind,
        t.status,
        t.source,
        t.actor ?? "",
        t.subject ?? "",
        t.summary.replace(/"/g, '""'),
      ]),
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${String(c)}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `elip-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-3">
      {/* summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {(["success", "info", "warning", "error"] as TxStatus[]).map((s) => (
          <div key={s} className={`elip-card border-l-4 p-3 ${STATUS_TONE[s]}`}>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${STATUS_DOT[s]}`} />
              <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-600">
                {s}
              </span>
            </div>
            <div className="text-lg font-bold text-navy mt-1">{counts[s]}</div>
          </div>
        ))}
      </div>

      {/* controls */}
      <div className="elip-card p-3 flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search summary / source / actor / id…"
          className="text-xs border rounded px-2 py-1.5 flex-1 min-w-[200px]"
        />
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as TxKind | "all")}
          className="text-xs border rounded px-2 py-1.5"
        >
          <option value="all">All types</option>
          {(Object.keys(TX_KIND_LABEL) as TxKind[]).map((k) => (
            <option key={k} value={k}>
              {TX_KIND_LABEL[k]}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as TxStatus | "all")}
          className="text-xs border rounded px-2 py-1.5"
        >
          <option value="all">All statuses</option>
          <option value="success">Success</option>
          <option value="info">Info</option>
          <option value="warning">Warning</option>
          <option value="error">Error</option>
        </select>
        <button
          onClick={exportCsv}
          className="text-xs px-3 py-1.5 rounded border border-navy text-navy font-semibold hover:bg-navy hover:text-navy-foreground"
        >
          ⬇ Export CSV
        </button>
        <button
          onClick={() => {
            if (confirm("Clear the transaction log? This cannot be undone.")) clearTransactionLog();
          }}
          className="text-xs px-3 py-1.5 rounded border border-rose-500 text-rose-700 font-semibold hover:bg-rose-500 hover:text-white"
        >
          Clear
        </button>
      </div>

      {/* table */}
      <div className="elip-card overflow-hidden">
        <div className="px-4 py-3 border-b bg-zinc-50 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-navy text-sm">📜 System Transaction Log</h3>
            <p className="text-[11px] text-muted-foreground">
              Every Hermes call, lead change, call extraction, outbound search,
              follow-up advice, audit explanation, and kill-switch toggle —
              newest first. Showing {filtered.length} of {all.length}.
            </p>
          </div>
        </div>
        <div className="max-h-[520px] overflow-auto">
          <table className="w-full text-xs">
            <thead className="bg-zinc-50 text-zinc-600 text-[10px] uppercase tracking-wider sticky top-0">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">When</th>
                <th className="text-left px-3 py-2 font-semibold">Type</th>
                <th className="text-left px-3 py-2 font-semibold">Status</th>
                <th className="text-left px-3 py-2 font-semibold">Source</th>
                <th className="text-left px-3 py-2 font-semibold">Actor</th>
                <th className="text-left px-3 py-2 font-semibold">Subject</th>
                <th className="text-left px-3 py-2 font-semibold">Summary</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground text-[11px]">
                    No transactions match the current filters.
                  </td>
                </tr>
              )}
              {filtered.map((t) => (
                <tr key={t.id} className="border-t hover:bg-zinc-50 align-top">
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="font-semibold text-navy">{fmtRelative(t.ts)}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">
                      {new Date(t.ts).toLocaleTimeString()}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-900 text-[10px] font-bold whitespace-nowrap">
                      {TX_KIND_LABEL[t.kind]}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${STATUS_TONE[t.status]}`}>
                      {t.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground whitespace-nowrap">
                    {t.source}
                  </td>
                  <td className="px-3 py-2 text-[11px] whitespace-nowrap">{t.actor ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-[10px] whitespace-nowrap">{t.subject ?? "—"}</td>
                  <td className="px-3 py-2 text-[11px]">{t.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
