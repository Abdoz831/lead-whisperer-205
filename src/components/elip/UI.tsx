import { type ReactNode } from "react";

export function PageHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="px-6 pt-5 pb-4 border-b bg-card">
      <h1 className="text-xl font-bold text-navy">{title}</h1>
      <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
    </div>
  );
}

export function Section({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="mb-6">
      <div className="flex items-end justify-between mb-3">
        <div>
          <h2 className="text-base font-bold text-navy">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="elip-card overflow-hidden">{children}</div>
    </section>
  );
}

export function KPICard({
  label, value, sub, status, accent,
}: {
  label: string; value: string; sub?: string; status?: { text: string; tone: "ok" | "warn" | "danger" | "muted" }; accent?: "navy" | "green" | "orange" | "blue" | "gold";
}) {
  const accentBar =
    accent === "green" ? "bg-green-600"
    : accent === "orange" ? "bg-orange-500"
    : accent === "blue" ? "bg-blue-600"
    : accent === "gold" ? "bg-gold"
    : "bg-navy";
  const toneCls = status?.tone === "ok"
    ? "bg-green-100 text-green-800"
    : status?.tone === "warn"
    ? "bg-amber-100 text-amber-900"
    : status?.tone === "danger"
    ? "bg-red-100 text-red-800"
    : "bg-zinc-100 text-zinc-700";
  return (
    <div className="elip-card p-4 relative overflow-hidden">
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${accentBar}`} />
      <div className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{label}</div>
      <div className="text-2xl font-bold text-navy mt-1">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      {status && (
        <div className={`mt-2 inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${toneCls}`}>{status.text}</div>
      )}
    </div>
  );
}

export function Badge({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${className}`}>
      {children}
    </span>
  );
}

export function ScoreCircle({ score, priority }: { score: number; priority: string }) {
  const bg = priority === "P1" ? "var(--p1)" : priority === "P2" ? "var(--p2)" : priority === "P3" ? "var(--p3)" : "var(--p4)";
  return (
    <div className="inline-flex items-center justify-center w-9 h-9 rounded-full text-white text-xs font-bold" style={{ background: bg }}>
      {score}
    </div>
  );
}
