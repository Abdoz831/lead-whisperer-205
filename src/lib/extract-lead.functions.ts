import { createServerFn } from "@tanstack/react-start";
import { generateObject } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const Input = z.object({ transcript: z.string().min(1).max(20000) });

const Schema = z.object({
  customer_name: z.string().describe("Full client name as spoken; empty if not stated"),
  phone_number: z.string().describe("Phone number exactly/normalised from speech, including international formats like 0097150219044 or +97150219044; empty if none"),
  net_income_jod: z.string().describe("Monthly net SALARY in JOD as bare integer string; empty if not stated"),
  other_income_jod: z.string().describe("Any ADDITIONAL monthly income in JOD (rental, business, spouse, freelance) as bare integer string; empty if none stated"),
  existing_obligations_jod: z.string().describe("Total monthly debt obligations / existing loan instalments / credit card payments in JOD as bare integer string; empty if none stated"),
  years_in_current_job: z.string().describe("How long the client has been at the current employer, in years as a decimal string (e.g. '0.5', '2', '7'); empty if not stated"),
  dependents: z.string().describe("Number of dependents (spouse, children, parents financially supported) as bare integer string; empty if not stated"),
  financial_notes: z.string().describe("Free-text summary of any extra financial-status details the client mentioned: assets, property owned, other bank relationships, savings, side business, credit history, prior rejections, anything relevant to underwriting. Empty if nothing extra."),
  company_name: z.string().describe("Current employer / company name; empty if none"),
  job_title: z.string().describe("Job title/role; empty if none"),
  product: z.enum([
    "Personal Loan",
    "Mortgage",
    "Housing Loan",
    "Auto Loan",
    "Credit Card",
    "PLCC",
    "Buyout Personal Loan",
    "Buyout Credit Card",
    "Buyout Housing Loan",
  ]).describe("Best-fit product from this list"),
  financing_amount: z.string().describe("Amount requested in JOD as bare integer string; convert '120 thousand' to 120000; empty if not stated"),
  work_duration: z.enum([
    "Less than 3 months",
    "3–6 months",
    "6–12 months",
    "1–2 years",
    "2–3 years",
    "More than 3 years",
  ]).describe("Best-fit work tenure bucket; default '1–2 years' only if explicitly unclear"),
  channel: z.enum([
    "Inbound Call",
    "Web Chat",
    "Loan Calculator",
    "Contact-Us Form",
    "Branch Walk-in",
    "WhatsApp",
  ]).describe("How the client reached the bank; default 'Inbound Call'"),
});

export const extractLeadFromTranscript = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const gateway = createLovableAiGatewayProvider(key);
    const { object } = await generateObject({
      model: gateway("google/gemini-3-flash-preview"),
      schema: Schema,
      maxOutputTokens: 2048,
      system:
        "You extract structured retail-banking lead data from a transcript of a call between a Bank al Etihad agent and a client. " +
        "The transcript may mix English and Jordanian Arabic / any spoken dialect. Read carefully — clients often state details in passing. " +
        "Extract every field you can confidently infer: name, phone (any country format), employer/government body, job title, product type, requested financing amount, work tenure bucket, AND the client's full financial picture. " +
        "Financial picture means: monthly SALARY (net_income_jod), any OTHER monthly income such as rental/business/freelance/spouse (other_income_jod), existing monthly debt obligations / loan instalments / credit card payments (existing_obligations_jod), years at current job (years_in_current_job, decimal), number of dependents (dependents), and a free-text financial_notes summarising anything else relevant to underwriting (owns property, has savings, has accounts at other banks, prior loan history, side business, recent rejection, etc.). " +
        "For phrases like 'working as a Secretary General of Global AI Award in Dubai Quality Group', job_title is 'Secretary General' and company_name is 'Global AI Award in Dubai Quality Group'. " +
        "Leave optional string fields as an empty string if truly not stated. Never invent values. " +
        "Convert spoken numbers (e.g. 'twenty thousand dollars' → 20000, 'one hundred and twenty thousand dinars' → 120000) to bare integers.",
      prompt: `Transcript:\n${data.transcript}`,
    });

    return object;
  });
