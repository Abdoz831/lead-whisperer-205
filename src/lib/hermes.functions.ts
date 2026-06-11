// Internal Hermes invocation used by ELIP surfaces (CC Assistant, Sales
// pipeline actions, Audit explanations). Not part of /api/public/* — auth
// is "logged-in ELIP user" via the normal app session.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  prompt: z.string().min(1).max(8000),
  source: z.enum(["elip-cc", "elip-sales", "elip-audit", "elip-reactivation"]),
  lead_id: z.string().max(64).optional(),
});

export const invokeHermes = createServerFn({ method: "POST" })
  .inputValidator((data) => Input.parse(data))
  .handler(async ({ data }) => {
    const { callHermes } = await import("@/lib/hermes.server");
    const reply = await callHermes(data.prompt, {
      source: data.source,
      lead_id: data.lead_id,
    });
    return { text: reply.text, reasoning: reply.reasoning ?? null };
  });

export const hermesHealth = createServerFn({ method: "GET" }).handler(async () => {
  const url = process.env.HERMES_API_URL;
  const haveKey = !!process.env.HERMES_API_KEY;
  const haveSlackBot = !!process.env.SLACK_BOT_TOKEN;
  const haveSlackSign = !!process.env.SLACK_SIGNING_SECRET;
  let reachable = false;
  if (url) {
    try {
      const res = await fetch(url.replace(/\/$/, "") + "/healthz", {
        method: "GET",
        signal: AbortSignal.timeout(4000),
      });
      reachable = res.ok;
    } catch {
      reachable = false;
    }
  }
  return {
    hermesConfigured: !!url && haveKey,
    hermesReachable: reachable,
    slackConfigured: haveSlackBot && haveSlackSign,
  };
});
