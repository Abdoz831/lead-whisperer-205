import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

const InputSchema = z.object({
  leads: z
    .array(
      z.object({
        lead_id: z.string(),
        customer_name: z.string(),
        product: z.string(),
        financing_amount: z.number(),
        current_status: z.string(),
        last_update_hours: z.number(),
        no_answer_attempts: z.number().optional(),
        deal_temperature: z.string().optional(),
        closing_blocker: z.string().optional(),
        cc_notes: z.string().optional(),
        rlm_notes: z.string().optional(),
        best_time_to_call: z.string().optional(),
      })
    )
    .max(40),
});

const AdviceSchema = z.object({
  items: z.array(
    z.object({
      lead_id: z.string(),
      urgency: z.enum(["critical", "high", "medium", "low"]),
      next_action: z.string(),
      channel: z.enum(["call", "sms", "whatsapp", "email", "visit"]),
      timing: z.string(),
      reasoning: z.string(),
      script: z.string(),
      risk_if_delayed: z.string(),
    })
  ),
  summary: z.string(),
});

export type FollowupAdvice = z.infer<typeof AdviceSchema>;

export const getFollowupAdvice = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const gateway = createLovableAiGatewayProvider(key);

    const system = `You are a senior sales coach for Bank al Etihad's retail finance team. For each lead, produce ONE concrete next follow-up action tailored to its stage:

- "No Answer": vary channel & timing per attempt count; never call same time twice. After 3+ attempts suggest SMS/WhatsApp with soft CTA.
- "Follow-up Scheduled": confirm the appointment, send reminder, prep value-prop.
- "Docs Pending": chase exact missing documents, offer to collect, set deadline.
- "Booked": pre-call briefing, anticipate objections.
- "Underwriting": status check with RLM, manage customer expectation.
- "Approved": closing call, push to disbursement.

Urgency rules: >72h no update = critical. >48h = high. 24-48h = medium. <24h = low.
Be specific to Jordan market (JOD, local etiquette, prayer times — avoid calls during Friday prayer 12-2pm).
Scripts must be ≤2 sentences, in plain English, ready to read.`;

    const prompt = `Leads needing follow-up (JSON):\n${JSON.stringify(data.leads, null, 2)}\n\nReturn one advice item per lead, plus a 1-sentence summary of the queue.`;

    const { output } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      system,
      prompt,
      output: Output.object({ schema: AdviceSchema }),
    });

    return output as FollowupAdvice;
  });
