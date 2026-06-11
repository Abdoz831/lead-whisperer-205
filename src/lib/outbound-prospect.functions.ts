import { createServerFn } from "@tanstack/react-start";
import { generateObject } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const Input = z.object({
  titles: z.array(z.string().min(1).max(120)).min(1).max(8),
  locations: z.array(z.string().min(1).max(120)).min(1).max(8),
  min_salary_jod: z.number().min(0).max(1_000_000).default(0),
  industries: z.array(z.string().max(120)).max(8).default([]),
  product: z.string().min(1).max(120),
  priorities: z.string().max(800).default(""),
  target_count: z.number().min(3).max(25).default(10),
});

const Prospect = z.object({
  name: z.string().describe("Full name of the prospect"),
  title: z.string().describe("Current job title"),
  company: z.string().describe("Current employer"),
  location: z.string().describe("City, country"),
  email: z.string().describe("Public business email if found; otherwise 'Not public'"),
  mobile: z.string().describe("Public mobile/phone if found; otherwise 'Not public'"),
  linkedin_url: z.string().describe("LinkedIn profile URL if found; else ''"),
  estimated_salary_jod: z.number().describe("Estimated monthly salary in JOD based on title/company/seniority"),
  fit_score: z.number().min(0).max(100).describe("0-100 priority score for selling the product"),
  why_now: z.string().describe("1-2 sentence reason this prospect is a high-priority target right now"),
  recommended_pitch: z.string().describe("3-4 sentence opening pitch tailored to this person and the product"),
  evidence_urls: z.array(z.string()).max(4).describe("URLs from Tavily snippets backing this profile"),
  confidence: z.enum(["high", "medium", "low"]),
});

const OutSchema = z.object({
  prospects: z.array(Prospect),
  search_summary: z.string().describe("1-2 sentence summary of how the list was built and any caveats (e.g. salaries are estimates, contact info often gated)"),
});

type TavilyResult = { title: string; url: string; content: string };

async function tavilySearch(query: string, key: string): Promise<TavilyResult[]> {
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        query,
        search_depth: "advanced",
        max_results: 8,
        include_domains: ["linkedin.com", "bloomberg.com", "forbes.com", "zawya.com", "jordantimes.com", "wamda.com", "crunchbase.com"],
      }),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { results?: TavilyResult[] };
    return json.results ?? [];
  } catch {
    return [];
  }
}

export const findOutboundProspects = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const lovableKey = process.env.LOVABLE_API_KEY;
    const tavilyKey = process.env.TAVILY_API_KEY;
    if (!lovableKey) throw new Error("Missing LOVABLE_API_KEY");
    if (!tavilyKey) throw new Error("Missing TAVILY_API_KEY");

    const queries: string[] = [];
    for (const title of data.titles) {
      for (const loc of data.locations) {
        queries.push(`"${title}" ${loc} site:linkedin.com/in`);
        if (data.industries.length) {
          queries.push(`"${title}" ${data.industries.join(" OR ")} ${loc} site:linkedin.com/in`);
        }
      }
    }
    queries.push(
      `top earning executives ${data.locations.join(" OR ")} ${data.titles[0]}`,
      `highest paid ${data.titles[0]} ${data.locations[0]} salary`,
    );

    const all = await Promise.all(queries.slice(0, 10).map((q) => tavilySearch(q, tavilyKey)));
    const merged = all.flat();
    const dedup = Array.from(new Map(merged.map((r) => [r.url, r])).values()).slice(0, 30);
    const evidence = dedup
      .map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${(r.content || "").slice(0, 500)}`)
      .join("\n\n");

    const gateway = createLovableAiGatewayProvider(lovableKey);

    const { object } = await generateObject({
      model: gateway("google/gemini-3-flash-preview"),
      schema: OutSchema,
      maxOutputTokens: 6000,
      system:
        "You are an elite B2C banking outbound prospecting analyst for Bank al Etihad in Jordan. " +
        "From public web/LinkedIn snippets, identify HIGH-NET-WORTH individuals who match the criteria and would be strong buyers of the product. " +
        "RULES: Only include real people who appear in the evidence with name + title + company. Never invent contact details — if email/mobile is not explicitly in the snippets, return 'Not public'. " +
        "Estimate salary using market benchmarks for the role/seniority/company in Jordan. " +
        "Score fit_score 0-100 weighting: salary above threshold, title match, location match, life-stage signals, and the user's stated priorities. Sort prospects by fit_score descending. " +
        "Set confidence=low for thin matches. Keep evidence_urls tied to the snippets you used.",
      prompt:
        `CRITERIA\n` +
        `- Titles: ${data.titles.join(", ")}\n` +
        `- Locations: ${data.locations.join(", ")}\n` +
        `- Minimum monthly salary (JOD): ${data.min_salary_jod}\n` +
        `- Industries: ${data.industries.join(", ") || "(any)"}\n` +
        `- Product to sell: ${data.product}\n` +
        `- Priority preferences: ${data.priorities || "(none)"}\n` +
        `- Target list size: ${data.target_count}\n\n` +
        `EVIDENCE (Tavily snippets, ${dedup.length} sources):\n${evidence || "(no results)"}\n`,
    });

    return {
      ...object,
      sources_count: dedup.length,
      fetched_at: new Date().toISOString(),
    };
  });

export type OutboundProspectResult = Awaited<ReturnType<typeof findOutboundProspects>>;
