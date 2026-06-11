import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { findOutboundProspects, type OutboundProspectResult } from "@/lib/outbound-prospect.functions";

type Prospect = OutboundProspectResult["prospects"][number];

const DEFAULTS = {
  titles: "CEO, Managing Director, CFO, Partner, General Manager",
  locations: "Amman, Aqaba, Irbid",
  industries: "Banking, Telecom, Pharma, Real Estate, Tech",
  product: "Private Wealth Account & Premium Mortgage",
  priorities: "Long-tenure executives, recent promotions, family-stage life events, low existing leverage",
  min_salary: 8000,
  count: 10,
};

export function GrowthOutboundPanel() {
  const run = useServerFn(findOutboundProspects);
  const [titles, setTitles] = useState(DEFAULTS.titles);
  const [locations, setLocations] = useState(DEFAULTS.locations);
  const [industries, setIndustries] = useState(DEFAULTS.industries);
  const [product, setProduct] = useState(DEFAULTS.product);
  const [priorities, setPriorities] = useState(DEFAULTS.priorities);
  const [minSalary, setMinSalary] = useState<number>(DEFAULTS.min_salary);
  const [count, setCount] = useState<number>(DEFAULTS.count);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OutboundProspectResult | null>(null);

  async function search() {
    setLoading(true);
    try {
      const r = await run({
        data: {
          titles: titles.split(",").map((s) => s.trim()).filter(Boolean),
          locations: locations.split(",").map((s) => s.trim()).filter(Boolean),
          industries: industries.split(",").map((s) => s.trim()).filter(Boolean),
          product,
          priorities,
          min_salary_jod: minSalary,
          target_count: count,
        },
      });
      setResult(r);
      toast.success(`Found ${r.prospects.length} prospects, ranked by fit`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  const sorted = result ? [...result.prospects].sort((a, b) => b.fit_score - a.fit_score) : [];

  return (
    <div className="space-y-4">
      <div className="elip-card p-4 border-l-4 border-purple-500">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h2 className="text-sm font-bold text-navy">🚀 Growth Outbound — AI Prospect Finder</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Tavily searches LinkedIn, news and financial press for elite individuals matching your criteria.
              Lovable AI then ranks them by fit-to-sell for Bank al Etihad's product.
            </p>
          </div>
          <button
            onClick={search}
            disabled={loading}
            className="bg-purple-600 disabled:bg-zinc-400 text-white px-4 py-2 rounded text-xs font-bold whitespace-nowrap"
          >{loading ? "Searching…" : "🔎 Find prospects"}</button>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <Field label="Target titles (comma-separated)">
            <input value={titles} onChange={(e) => setTitles(e.target.value)} className="input" />
          </Field>
          <Field label="Locations (comma-separated)">
            <input value={locations} onChange={(e) => setLocations(e.target.value)} className="input" />
          </Field>
          <Field label="Industries (optional)">
            <input value={industries} onChange={(e) => setIndustries(e.target.value)} className="input" />
          </Field>
          <Field label="Product to sell">
            <input value={product} onChange={(e) => setProduct(e.target.value)} className="input" />
          </Field>
          <Field label="Minimum monthly salary (JOD)">
            <input type="number" value={minSalary} onChange={(e) => setMinSalary(Number(e.target.value))} className="input" />
          </Field>
          <Field label="Target list size">
            <input type="number" min={3} max={25} value={count} onChange={(e) => setCount(Number(e.target.value))} className="input" />
          </Field>
          <Field label="Priority preferences (free text)" full>
            <textarea value={priorities} onChange={(e) => setPriorities(e.target.value)} rows={2} className="input" />
          </Field>
        </div>
        <style>{`.input{width:100%;border:1px solid #d4d4d8;border-radius:6px;padding:6px 8px;font-size:11px;background:hsl(var(--card))}`}</style>
      </div>

      {result && (
        <div className="elip-card p-3 text-[11px] text-zinc-700 bg-amber-50 border-l-4 border-amber-400">
          <strong>Run summary:</strong> {result.search_summary}
          <div className="text-[10px] text-zinc-500 mt-1">
            {result.sources_count} sources analysed · {new Date(result.fetched_at).toLocaleString()} ·
            Salary figures are AI estimates from public role/seniority benchmarks. Personal mobile/email are only shown when found in public sources.
          </div>
        </div>
      )}

      {sorted.length > 0 && (
        <div className="elip-card overflow-hidden">
          <div className="px-4 py-3 border-b bg-card">
            <h3 className="text-sm font-bold text-navy">Prioritised prospects ({sorted.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-zinc-50 text-zinc-600 text-[11px] uppercase tracking-wider">
                <tr>
                  {["Fit", "Name", "Title / Company", "Location", "Est. Salary (JOD)", "Email", "Mobile", "Why now", "Pitch", "Conf."].map((h) => (
                    <th key={h} className="text-left px-2 py-2 font-semibold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((p, i) => <ProspectRow key={i} p={p} />)}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!result && !loading && (
        <div className="elip-card p-6 text-center text-xs text-muted-foreground">
          Set your criteria above, then click <strong>Find prospects</strong> to let the AI surface elite candidates.
        </div>
      )}
    </div>
  );
}

function Field({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold mb-1">{label}</div>
      {children}
    </div>
  );
}

function ProspectRow({ p }: { p: Prospect }) {
  const fitColor = p.fit_score >= 80 ? "bg-emerald-600" : p.fit_score >= 60 ? "bg-amber-500" : "bg-zinc-500";
  const confColor = p.confidence === "high" ? "bg-emerald-600" : p.confidence === "medium" ? "bg-amber-500" : "bg-zinc-400";
  return (
    <tr className="border-t hover:bg-zinc-50 align-top">
      <td className="px-2 py-2">
        <span className={`text-white text-[10px] font-bold px-2 py-1 rounded ${fitColor}`}>{p.fit_score}</span>
      </td>
      <td className="px-2 py-2 font-semibold text-navy">
        {p.name}
        {p.linkedin_url && (
          <a href={p.linkedin_url} target="_blank" rel="noreferrer" className="ml-1 text-blue-600 text-[10px] underline">in</a>
        )}
      </td>
      <td className="px-2 py-2">
        <div className="font-medium">{p.title}</div>
        <div className="text-[10px] text-zinc-500">{p.company}</div>
      </td>
      <td className="px-2 py-2">{p.location}</td>
      <td className="px-2 py-2 tabular-nums font-semibold">{p.estimated_salary_jod.toLocaleString()}</td>
      <td className="px-2 py-2 text-[10px]">{p.email}</td>
      <td className="px-2 py-2 text-[10px]">{p.mobile}</td>
      <td className="px-2 py-2 max-w-[200px] text-[11px] text-zinc-700">{p.why_now}</td>
      <td className="px-2 py-2 max-w-[260px] text-[11px] italic text-purple-900 bg-purple-50/40">"{p.recommended_pitch}"</td>
      <td className="px-2 py-2">
        <span className={`text-white text-[9px] font-bold px-1.5 py-0.5 rounded ${confColor}`}>{p.confidence.toUpperCase()}</span>
      </td>
    </tr>
  );
}
