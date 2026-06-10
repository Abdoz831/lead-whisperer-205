import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageHeader } from "@/components/elip/UI";

export const Route = createFileRoute("/management/workload")({
  component: Workload,
});

const rows = [
  { name: "Haneen", desk: "Inbound TL Desk 1", leads: 28, jod: 890000, index: 1.4 },
  { name: "Ghadeer", desk: "Inbound TL Desk 2", leads: 24, jod: 780000, index: 1.2 },
  { name: "Lubna", desk: "Inbound TL Desk 3", leads: 22, jod: 650000, index: 1.1 },
  { name: "Samhouri", desk: "Inbound TL Desk 4", leads: 20, jod: 540000, index: 1.0 },
  { name: "Fadi", desk: "Outbound TL", leads: 18, jod: 420000, index: 0.9 },
];

function indexTone(i: number) {
  if (i < 1.2) return { c: "bg-green-100 text-green-800", t: "🟢 BALANCED" };
  if (i < 2.0) return { c: "bg-amber-100 text-amber-900", t: "🟡 ELEVATED" };
  if (i < 2.5) return { c: "bg-orange-100 text-orange-900", t: "🟠 HIGH" };
  return { c: "bg-red-100 text-red-900", t: "🔴 CRITICAL" };
}

function Workload() {
  return (
    <>
      <PageHeader title="Team Workload Monitor" subtitle="Intelligence Engine maintaining balance within 2.0x ceiling." />
      <div className="p-6 space-y-4">
        <div className="elip-card overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-zinc-50 text-zinc-600 text-[11px] uppercase tracking-wider">
              <tr>
                {["Agent / TL Desk", "Active Leads", "Total JOD", "Avg Days", "Close Rate", "Workload Index", "Status", ""].map(h => (
                  <th key={h} className="text-left px-3 py-2 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const tone = indexTone(r.index);
                return (
                  <tr key={r.name} className="border-t hover:bg-zinc-50">
                    <td className="px-3 py-2"><div className="font-semibold text-navy">{r.name}</div><div className="text-[10px] text-muted-foreground">{r.desk}</div></td>
                    <td className="px-3 py-2 tabular-nums">{r.leads}</td>
                    <td className="px-3 py-2 tabular-nums font-semibold">JOD {r.jod.toLocaleString()}</td>
                    <td className="px-3 py-2 tabular-nums text-muted-foreground">{(18 + r.index * 2).toFixed(1)}d</td>
                    <td className="px-3 py-2 tabular-nums">{(60 + r.index * 5).toFixed(1)}%</td>
                    <td className="px-3 py-2 font-mono font-bold">{r.index.toFixed(1)}x</td>
                    <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${tone.c}`}>{tone.t}</span></td>
                    <td className="px-3 py-2">
                      <button onClick={() => toast.info(`Reassignment modal opened for ${r.name}`)} className="border border-zinc-300 px-3 py-1 rounded text-[11px] font-semibold hover:bg-zinc-50">Reassign</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="text-xs text-muted-foreground italic">
          Intelligence Engine note: Previous imbalance of 26x has been eliminated. The engine maintains continuous balance — no manual intervention required under normal operation.
        </div>
      </div>
    </>
  );
}
