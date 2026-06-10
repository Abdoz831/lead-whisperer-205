import { createServerFn } from "@tanstack/react-start";
import { generateObject } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const Input = z.object({ transcript: z.string().min(1).max(20000) });

const Schema = z.object({
  customer_name: z.string().describe("Full client name as spoken; empty if not stated"),
  phone_number: z.string().describe("Jordan phone, normalised digits e.g. 0791234567 or +962791234567; empty if none"),
  net_income_jod: z.string().describe("Monthly net income in JOD as bare integer string; empty if not stated"),
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
      system:
        "You extract structured retail-banking lead data from a transcript of a call between a Bank al Etihad agent and a client. " +
        "The transcript may mix English and Jordanian Arabic / any spoken dialect. Read carefully — clients often state details in passing. " +
        "Extract every field you can confidently infer (name, phone in any country format, employer/government body, job title, product type, amount, tenure). " +
        "Leave optional string fields as an empty string if truly not stated. Never invent values. " +
        "Convert spoken numbers (e.g. 'twenty thousand dollars' → 20000, 'one hundred and twenty thousand dinars' → 120000) to bare integers.",
      prompt: `Transcript:\n${data.transcript}`,
    });

    return object;
  });
