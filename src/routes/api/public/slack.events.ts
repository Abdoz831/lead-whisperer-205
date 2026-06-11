// Slack Events API receiver for the Hermes Agent integration.
//
// Slack will POST events to:
//   https://project--9796db2b-2f6a-4606-bca9-f91b618447ab.lovable.app/api/public/slack/events
//
// Required secrets:
//   SLACK_SIGNING_SECRET   from Slack app "Basic Information"
//   SLACK_BOT_TOKEN        xoxb-... from "OAuth & Permissions"
//   HERMES_API_URL         your self-hosted Hermes endpoint
//   HERMES_API_KEY         bearer token Hermes expects
//
// Handles:
//   1. url_verification challenge (one-time, when you save the URL in Slack)
//   2. event_callback → app_mention / message.im → forward to Hermes →
//      reply in the same thread.

import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

export const Route = createFileRoute("/api/public/slack/events")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const signingSecret = process.env.SLACK_SIGNING_SECRET;
        if (!signingSecret) {
          return new Response("SLACK_SIGNING_SECRET not set", { status: 500 });
        }

        const rawBody = await request.text();
        const timestamp = request.headers.get("x-slack-request-timestamp") ?? "";
        const slackSig = request.headers.get("x-slack-signature") ?? "";

        // Reject replays > 5 min old
        const ts = Number(timestamp);
        if (!ts || Math.abs(Date.now() / 1000 - ts) > 60 * 5) {
          return new Response("stale", { status: 401 });
        }

        // Verify signature
        const base = `v0:${timestamp}:${rawBody}`;
        const mySig =
          "v0=" + createHmac("sha256", signingSecret).update(base).digest("hex");
        const a = Buffer.from(mySig);
        const b = Buffer.from(slackSig);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return new Response("bad signature", { status: 401 });
        }

        const payload = JSON.parse(rawBody) as
          | { type: "url_verification"; challenge: string }
          | { type: "event_callback"; event: SlackEvent };

        if (payload.type === "url_verification") {
          return new Response(payload.challenge, {
            status: 200,
            headers: { "Content-Type": "text/plain" },
          });
        }

        if (payload.type === "event_callback") {
          // ACK immediately and process async so Slack does not retry.
          handleSlackEvent(payload.event).catch((err) => {
            console.error("[hermes/slack] handler error", err);
          });
          return new Response("ok", { status: 200 });
        }

        return new Response("ignored", { status: 200 });
      },
    },
  },
});

type SlackEvent = {
  type: "app_mention" | "message";
  user?: string;
  text?: string;
  channel: string;
  ts: string;
  thread_ts?: string;
  bot_id?: string;
  channel_type?: string;
};

async function handleSlackEvent(event: SlackEvent) {
  // Ignore bot echoes and edits
  if (event.bot_id) return;
  if (!event.text) return;

  // For plain `message` events only react to DMs to avoid spamming channels
  if (event.type === "message" && event.channel_type !== "im") return;

  const { callHermes, postSlackMessage } = await import("@/lib/hermes.server");

  const cleanPrompt = event.text.replace(/<@[^>]+>\s*/g, "").trim();
  if (!cleanPrompt) return;

  try {
    const reply = await callHermes(cleanPrompt, {
      source: "slack",
      user: event.user,
      channel: event.channel,
      metadata: { ts: event.ts, thread_ts: event.thread_ts },
    });
    await postSlackMessage({
      channel: event.channel,
      text: reply.text,
      thread_ts: event.thread_ts ?? event.ts,
    });
  } catch (err) {
    await postSlackMessage({
      channel: event.channel,
      text: `:warning: Hermes error: ${(err as Error).message}`,
      thread_ts: event.thread_ts ?? event.ts,
    }).catch(() => {});
  }
}
