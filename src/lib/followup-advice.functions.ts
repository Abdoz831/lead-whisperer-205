import { createServerFn } from "@tanstack/react-start";
import { generateObject } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const LeadInput = z.object({
  lead_id: z.string(),
  customer_name: z.string(),
  product: z.string(),
  financing_amount: z.number(),
  current_status: z.string(),
  closing_blocker: z.string().optional().default(""),
  last_update_hours: z.number().default(0),
  no_answer_attempts: z.number().default(0),
  next_call_window: z.string().optional().default(""),
  cc_notes: z.string().optional().default(""),
  rlm_notes: z.string().optional().default(""),
  enrichment_summary: z.string().optional().default(""),
});

const Input = z.object({
  leads: z.array(LeadInput).min(1).max(40),
});

const AdviceItem = z.object({
  lead_id: z.string(),
  urgency: z.enum(["critical", "high", "medium", "low"]),
  headline: z.string().describe("One-line situation summary tying status + age + history together"),
  next_action: z.string().describe("Exact next step the RLM should take in <=120 chars"),
  best_channel: z.enum(["call", "whatsapp", "sms", "email", "in_branch"]),
  best_time: z.string().describe("When to do it (e.g. 'today 6-8pm', 'tomorrow morning')"),
  script: z.string().describe("2-3 sentence script tailored to the stage and history"),
  risk_if_ignored: z.string().describe("What happens if no action is taken in 24-48h"),
});

const OutSchema = z.object({
  items: z.array(AdviceItem),
  stage_summary: z.string().describe("1-2 sentence overall coaching summary across all the leads"),
});

export const followupAdvice = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const gateway = createLovableAiGatewayProvider(key);

    const evidence = data.leads
      .map(
        (l) =>
          `- id=${l.lead_id} | ${l.customer_name} | ${l.product} JOD ${l.financing_amount.toLocaleString()} | stage=${l.current_status}` +
          ` | blocker=${l.closing_blocker || "none"} | age=${Math.round(l.last_update_hours)}h` +
          ` | no_answer_attempts=${l.no_answer_attempts}` +
          (l.next_call_window ? ` | window=${l.next_call_window}` : "") +
          (l.cc_notes ? ` | cc: ${l.cc_notes.slice(0, 180)}` : "") +
          (l.rlm_notes ? ` | rlm: ${l.rlm_notes.slice(0, 180)}` : "") +
          (l.enrichment_summary ? ` | profile: ${l.enrichment_summary.slice(0, 180)}` : ""),
      )
      .join("\n");

    const { object } = await generateObject({
      model: gateway("google/gemini-3-flash-preview"),
      schema: OutSchema,
      maxOutputTokens: 4500,
      system:
        "You are a senior retail-banking sales coach at Bank al Etihad in Jordan. " +
        "For each lead, produce a concrete, stage-aware follow-up plan an RLM can act on right now. " +
        "Stage-specific guidance: " +
        "• 'No Answer' → escalate channel after each attempt (call → WhatsApp → SMS → branch visit), respect best calling windows, never more than 2 calls/day. " +
        "• 'Follow-up Scheduled' → confirm slot 2h ahead via WhatsApp, prepare product pitch, anticipate top objection. " +
        "• 'Docs Pending' → list exactly which document is missing, offer in-person pickup or e-upload link, set 48h deadline. " +
        "• 'Booked' / 'Underwriting' → keep customer warm with status update, avoid silence >48h. " +
        "Urgency rules: critical if age>72h or no_answer_attempts>=3 or Docs Pending >48h; high if age>48h; medium 24-48h; low <24h. " +
        "Keep every field concrete and short. Return one item per lead in the same lead_id order.",
      prompt: `LEADS NEEDING FOLLOW-UP:\n${evidence}\n\nReturn one advice item per lead.`,
    });

    return { ...object, generated_at: new Date().toISOString() };
  });

export type FollowupAdvice = Awaited<ReturnType<typeof followupAdvice>>;
