import { createServerFn } from "@tanstack/react-start";
import { generateObject } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const Input = z.object({
  customer_name: z.string().min(1).max(200),
  company_name: z.string().max(200).optional().default(""),
  job_title: z.string().max(200).optional().default(""),
  product: z.string().max(80).optional().default(""),
  financing_amount: z.number().optional().default(0),
  net_income_jod: z.number().optional().default(0),
  cc_notes: z.string().max(4000).optional().default(""),
});

const OutSchema = z.object({
  social_summary: z.string().describe("2-4 sentence summary of the person's public/social-media footprint (LinkedIn role, company, public posts, news mentions, professional background). If nothing credible was found, say so honestly."),
  professional_profile: z.string().describe("One-line professional positioning, e.g. 'Senior IT manager at Orange Telecom, 8+ years, active on LinkedIn about fintech'."),
  interests: z.array(z.string().max(60)).max(6).describe("Public interests, causes, hobbies hinted in their footprint"),
  insights: z.string().describe("Sales-coach analysis: who this person is, financial sophistication, decision style, risk profile, what likely matters most to them, what objections to expect"),
  talking_points: z.array(z.string().max(180)).min(3).max(6).describe("Specific opening lines and conversational hooks tailored to this client — reference their company, role, life stage, and the product"),
  objection_handlers: z.array(z.object({
    objection: z.string().max(120),
    response: z.string().max(280),
  })).min(2).max(4).describe("Likely objections from this profile and how to handle them"),
  recommended_pitch: z.string().describe("A 3-5 sentence recommended pitch a sales guru would open with on the call"),
  confidence: z.enum(["high", "medium", "low"]).describe("Confidence the public info actually matches this person"),
});

type TavilyResult = { title: string; url: string; content: string; score?: number };

async function tavilySearch(query: string, tavilyKey: string): Promise<TavilyResult[]> {
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: tavilyKey,
        query,
        search_depth: "advanced",
        max_results: 6,
        include_domains: ["linkedin.com", "twitter.com", "x.com", "facebook.com", "instagram.com", "youtube.com", "github.com", "medium.com"],
      }),
    });
    if (!res.ok) return [];
    const json = await res.json() as { results?: TavilyResult[] };
    return json.results ?? [];
  } catch {
    return [];
  }
}

export const enrichLead = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const lovableKey = process.env.LOVABLE_API_KEY;
    const tavilyKey = process.env.TAVILY_API_KEY;
    if (!lovableKey) throw new Error("Missing LOVABLE_API_KEY");
    if (!tavilyKey) throw new Error("Missing TAVILY_API_KEY");

    // Run a couple of targeted social/web searches in parallel.
    const baseQ = data.company_name
      ? `${data.customer_name} ${data.company_name} Jordan`
      : `${data.customer_name} Jordan`;
    const [generalHits, linkedinHits] = await Promise.all([
      tavilySearch(baseQ, tavilyKey),
      tavilySearch(`${data.customer_name} ${data.company_name || ""} site:linkedin.com`, tavilyKey),
    ]);

    const merged = [...linkedinHits, ...generalHits].slice(0, 10);
    const sources = merged.map((r) => ({ title: r.title, url: r.url }));
    const evidence = merged
      .map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${(r.content || "").slice(0, 600)}`)
      .join("\n\n");

    const gateway = createLovableAiGatewayProvider(lovableKey);
    const { object } = await generateObject({
      model: gateway("google/gemini-3-flash-preview"),
      schema: OutSchema,
      maxOutputTokens: 2048,
      system:
        "You are a world-class retail-banking sales coach for Bank al Etihad in Jordan. " +
        "You receive (a) basic CRM facts about a prospect and (b) raw public/social-media search snippets about them. " +
        "Your job: build a sharp profile and a sales playbook the RLM can use on the very next call. " +
        "Be honest — if the snippets clearly are NOT this person (common name, different country, no match), set confidence='low' and say the public footprint is unclear; do NOT fabricate biography. " +
        "Tailor talking points to the client's company, seniority and the specific product/amount. Use a respectful Jordanian business tone. Keep everything actionable, concrete, no fluff.",
      prompt:
        `CRM FACTS:\n` +
        `- Name: ${data.customer_name}\n` +
        `- Company: ${data.company_name || "(unknown)"}\n` +
        `- Job title: ${data.job_title || "(unknown)"}\n` +
        `- Product interest: ${data.product || "(unknown)"}\n` +
        `- Requested amount: JOD ${data.financing_amount || 0}\n` +
        `- Monthly income: JOD ${data.net_income_jod || 0}\n` +
        `- Contact-centre notes: ${data.cc_notes || "(none)"}\n\n` +
        `PUBLIC/SOCIAL SEARCH RESULTS:\n${evidence || "(no results returned by web search)"}\n`,
    });

    return {
      ...object,
      sources,
      fetched_at: new Date().toISOString(),
    };
  });

export type LeadEnrichment = Awaited<ReturnType<typeof enrichLead>>;
