// Server-only helpers for talking to a self-hosted Hermes-Agent
// (https://github.com/NousResearch/hermes-agent) HTTPS endpoint.
//
// Required env vars (set as Lovable secrets):
//   HERMES_API_URL      e.g. https://hermes.your-host.fly.dev
//   HERMES_API_KEY      bearer token your Hermes deployment expects
//
// All ELIP → Hermes calls go through `callHermes`. Slack and the in-app
// Hermes Hub both reuse this so there is one place to swap models, add
// retries, or change the request schema.

export type HermesContext = {
  source: "slack" | "elip-cc" | "elip-sales" | "elip-audit" | "elip-reactivation";
  user?: string;
  channel?: string;
  lead_id?: string;
  metadata?: Record<string, unknown>;
};

export type HermesReply = {
  text: string;
  reasoning?: string;
  tool_calls?: { name: string; arguments: unknown }[];
  raw?: unknown;
};

export async function callHermes(
  prompt: string,
  context: HermesContext,
): Promise<HermesReply> {
  const url = process.env.HERMES_API_URL;
  const key = process.env.HERMES_API_KEY;
  if (!url) throw new Error("HERMES_API_URL is not configured");
  if (!key) throw new Error("HERMES_API_KEY is not configured");

  const endpoint = url.replace(/\/$/, "") + "/v1/agent/chat";
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      "X-Source": context.source,
    },
    body: JSON.stringify({
      messages: [{ role: "user", content: prompt }],
      context,
      stream: false,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Hermes ${res.status}: ${body.slice(0, 400)}`);
  }

  const data = (await res.json()) as {
    text?: string;
    choices?: { message?: { content?: string } }[];
    reasoning?: string;
    tool_calls?: { name: string; arguments: unknown }[];
  };

  const text =
    data.text ??
    data.choices?.[0]?.message?.content ??
    "(Hermes returned no text)";

  return {
    text,
    reasoning: data.reasoning,
    tool_calls: data.tool_calls,
    raw: data,
  };
}

export async function postSlackMessage(args: {
  channel: string;
  text: string;
  thread_ts?: string;
}): Promise<void> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) throw new Error("SLACK_BOT_TOKEN is not configured");

  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(args),
  });
  const data = (await res.json()) as { ok: boolean; error?: string };
  if (!data.ok) throw new Error(`Slack chat.postMessage: ${data.error}`);
}
