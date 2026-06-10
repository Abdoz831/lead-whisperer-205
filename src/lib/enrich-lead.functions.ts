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
  date_of_birth: z.string().max(20).optional().default(""),
  phone_number: z.string().max(40).optional().default(""),
  work_duration: z.string().max(40).optional().default(""),
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

    // Build several targeted queries combining every piece of initial info we have
    // so Tavily can distinguish the right person from common-name matches.
    const birthYear = data.date_of_birth?.match(/^(\d{4})/)?.[1] ?? "";
    const ageHint = birthYear ? `born ${birthYear}` : "";
    const titleAndCompany = [data.job_title, data.company_name].filter(Boolean).join(" ");

    const queries = [
      // 1. Strongest combined query
      [data.customer_name, data.job_title, data.company_name, ageHint, "Jordan"].filter(Boolean).join(" "),
      // 2. LinkedIn-focused with company
      `${data.customer_name} ${data.company_name || ""} site:linkedin.com`.trim(),
      // 3. LinkedIn-focused with title
      data.job_title ? `${data.customer_name} ${data.job_title} site:linkedin.com` : "",
      // 4. Company press / news mentions
      data.company_name ? `"${data.customer_name}" "${data.company_name}"` : "",
    ].filter((q) => q.length > 3);

    const searchResults = await Promise.all(queries.map((q) => tavilySearch(q, tavilyKey)));
    const merged = searchResults.flat();
    const dedup = Array.from(new Map(merged.map((r) => [r.url, r])).values()).slice(0, 12);
    const sources = dedup.map((r) => ({ title: r.title, url: r.url }));
    const evidence = dedup
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
        "MATCHING RULES — be strict: a snippet only matches the CRM person if name + (company OR job title OR location 'Jordan' OR birth year) line up. " +
        "If matches are weak or ambiguous (common name, different country, different employer, age mismatch), set confidence='low' and explicitly say the public footprint is unclear; do NOT fabricate biography. " +
        "Tailor talking points to the client's company, seniority, life stage (age from DOB) and the specific product/amount. Use a respectful Jordanian business tone. Keep everything actionable, concrete, no fluff.",
      prompt:
        `CRM FACTS (use ALL of these to match the right person):\n` +
        `- Name: ${data.customer_name}\n` +
        `- Date of birth: ${data.date_of_birth || "(unknown)"}\n` +
        `- Phone: ${data.phone_number || "(unknown)"}\n` +
        `- Company: ${data.company_name || "(unknown)"}\n` +
        `- Job title: ${data.job_title || "(unknown)"}\n` +
        `- Work tenure: ${data.work_duration || "(unknown)"}\n` +
        `- Title+Company combined: ${titleAndCompany || "(unknown)"}\n` +
        `- Product interest: ${data.product || "(unknown)"}\n` +
        `- Requested amount: JOD ${data.financing_amount || 0}\n` +
        `- Monthly income: JOD ${data.net_income_jod || 0}\n` +
        `- Contact-centre notes: ${data.cc_notes || "(none)"}\n\n` +
        `PUBLIC/SOCIAL SEARCH RESULTS (Jordan-targeted, Tavily over LinkedIn/Twitter/news):\n${evidence || "(no results returned by web search)"}\n`,
    });

    return {
      ...object,
      sources,
      fetched_at: new Date().toISOString(),
    };
  });

export type LeadEnrichment = Awaited<ReturnType<typeof enrichLead>>;
