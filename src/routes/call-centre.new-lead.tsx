import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/elip/UI";
import { useElip, PRODUCTS, CHANNELS, WORK_DURATIONS, type Product } from "@/lib/elip-data";

export const Route = createFileRoute("/call-centre/new-lead")({
  component: NewLead,
});

const blank = {
  channel: "Inbound Call",
  customer_name: "",
  customer_cif: "",
  phone_number: "",
  net_income_jod: "",
  company_name: "",
  product: "Mortgage" as Product,
  financing_amount: "",
  work_duration: "1–2 years",
  job_title: "",
  cc_notes: "",
};

export function NewLead() {
  const { addLead, currentUser } = useElip();
  const [f, setF] = useState({ ...blank });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (k: keyof typeof blank, v: string) => setF((p) => ({ ...p, [k]: v }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (f.customer_name.trim().length < 3) errs.customer_name = "Min 3 characters";
    if (!/^[+\d][\d\s+()-]{6,}$/.test(f.phone_number)) errs.phone_number = "Invalid phone";
    if (!f.net_income_jod || isNaN(Number(f.net_income_jod))) errs.net_income_jod = "Number required";
    if (f.company_name.trim().length < 2) errs.company_name = "Min 2 characters";
    if (!f.financing_amount || isNaN(Number(f.financing_amount))) errs.financing_amount = "Number required";
    if (f.job_title.trim().length < 2) errs.job_title = "Min 2 characters";
    if (f.cc_notes.trim().length < 20) errs.cc_notes = "Min 20 characters — describe customer's situation";
    setErrors(errs);
    if (Object.keys(errs).length) {
      toast.error("Please fix the highlighted fields");
      return;
    }
    const { lead, rlmName } = addLead({
      channel: f.channel,
      customer_name: f.customer_name.trim(),
      customer_cif: f.customer_cif.trim() || "NA",
      phone_number: f.phone_number.trim(),
      net_income_jod: Number(f.net_income_jod),
      company_name: f.company_name.trim(),
      product: f.product,
      financing_amount: Number(f.financing_amount),
      work_duration: f.work_duration,
      job_title: f.job_title.trim(),
      cc_notes: f.cc_notes.trim(),
      submitted_by_agent: currentUser.id,
    });
    toast.success(
      `Lead ${lead.lead_id} submitted. AI Score: ${lead.priority} — ${lead.ai_score}/100. Assigned to: ${rlmName}.`,
      { description: "Your call notes are ready for the Sales agent." }
    );
    setF({ ...blank });
    setErrors({});
  }

  const F = ({ label, k, type = "text", required, options }: { label: string; k: keyof typeof blank; type?: string; required?: boolean; options?: readonly string[] }) => (
    <div>
      <label className="block text-xs font-semibold text-zinc-700 mb-1">
        {label} {required && <span className="text-red-600">*</span>}
      </label>
      {options ? (
        <select
          value={f[k]}
          onChange={(e) => set(k, e.target.value)}
          className={`w-full border rounded px-3 py-2 text-sm bg-white ${errors[k] ? "border-red-500" : "border-zinc-300"}`}
        >
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input
          type={type}
          value={f[k]}
          onChange={(e) => set(k, e.target.value)}
          className={`w-full border rounded px-3 py-2 text-sm ${errors[k] ? "border-red-500" : "border-zinc-300"}`}
        />
      )}
      {errors[k] && <div className="text-[11px] text-red-600 mt-1">{errors[k]}</div>}
    </div>
  );

  return (
    <>
      <PageHeader
        title="Call Centre — New Lead Entry"
        subtitle="Capture new leads from all channels. Write detailed call notes. Sales handles all follow-up."
      />
      <div className="p-6 max-w-5xl">
        <div className="elip-card p-6">
          <h2 className="text-base font-bold text-navy mb-1">New Lead Entry</h2>
          <p className="text-xs text-muted-foreground mb-5">
            Your call notes go directly to the Sales agent. Write everything the customer told you — their situation, their needs, any commitments. The Sales agent reads your notes before making the first call.
          </p>

          <form onSubmit={submit} className="grid grid-cols-2 gap-4">
            <F label="Channel" k="channel" required options={CHANNELS} />
            <F label="Agent ID" k="customer_cif" required={false} />
            <F label="Customer Name" k="customer_name" required />
            <F label="Customer CIF" k="customer_cif" />
            <F label="Phone Number" k="phone_number" type="tel" required />
            <F label="Net Income (JOD)" k="net_income_jod" type="number" required />
            <F label="Company Name" k="company_name" required />
            <F label="Product" k="product" required options={PRODUCTS} />
            <F label="Financing Amount (JOD)" k="financing_amount" type="number" required />
            <F label="Work Duration" k="work_duration" required options={WORK_DURATIONS} />
            <div className="col-span-2">
              <F label="Job Title" k="job_title" required />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-zinc-700 mb-1">
                Call Notes <span className="text-red-600">*</span>
                <span className="ml-2 font-normal text-muted-foreground">
                  What did the customer tell you? Write everything — their goals, existing loans, commitments, urgency, preferred call times. The Sales agent reads this before calling.
                </span>
              </label>
              <textarea
                value={f.cc_notes}
                onChange={(e) => set("cc_notes", e.target.value.slice(0, 500))}
                rows={6}
                className={`w-full border rounded px-3 py-2 text-sm ${errors.cc_notes ? "border-red-500" : "border-zinc-300"}`}
                placeholder="Customer told me they want a buyout from Housing Bank for JOD 45,000. Salary top-up coming next month. Prefers calls after 4 PM..."
              />
              <div className="flex justify-between mt-1">
                <span className="text-[11px] text-red-600">{errors.cc_notes ?? ""}</span>
                <span className="text-[11px] text-muted-foreground">{f.cc_notes.length} / 500</span>
              </div>
            </div>

            <div className="col-span-2 flex items-center justify-between pt-2 border-t">
              <div className="text-xs text-muted-foreground">
                Submitting as <strong>{currentUser.name}</strong>
              </div>
              <button
                type="submit"
                className="bg-navy text-navy-foreground px-5 py-2 rounded text-sm font-semibold hover:opacity-90"
              >
                Submit Lead & Send to Sales →
              </button>
            </div>
          </form>
        </div>

        <div className="mt-6 text-xs text-muted-foreground">
          Your job is data accuracy and detailed call notes. The AI engine handles scoring, prioritisation, and routing.
        </div>
      </div>
    </>
  );
}
