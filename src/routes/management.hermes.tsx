import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader } from "@/components/elip/UI";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { invokeHermes, hermesHealth } from "@/lib/hermes.functions";
import { useAgentsKilled, AgentsDisabledError } from "@/lib/agents-kill-switch";

export const Route = createFileRoute("/management/hermes")({
  component: HermesHub,
});

const PROJECT_ID = "9796db2b-2f6a-4606-bca9-f91b618447ab";
const WEBHOOK_URL = `https://project--${PROJECT_ID}.lovable.app/api/public/slack/events`;

const PLUG_POINTS = [
  {
    surface: "Call Centre — AI Call Assistant",
    route: "/call-centre/assistant",
    direction: "ELIP → Hermes",
    purpose: "Live call summarisation, objection handling, next-best-action prompts.",
    source: "elip-cc" as const,
  },
  {
    surface: "Sales — Active Pipeline & Dashboard",
    route: "/sales/pipeline",
    direction: "ELIP → Hermes",
    purpose: "Lead enrichment, follow-up draft messages, re-call scripts.",
    source: "elip-sales" as const,
  },
  {
    surface: "Management — Re-Activation Queue",
    route: "/management/reactivation",
    direction: "ELIP → Hermes",
    purpose: "Generate personalised re-activation outreach per dormant customer.",
    source: "elip-reactivation" as const,
  },
  {
    surface: "Audit — Explainable AI & Audit Log",
    route: "/management/audit",
    direction: "ELIP ↔ Hermes",
    purpose: "Natural-language explanations of model decisions (CBJ AI-5.2, PDPL Art. 17).",
    source: "elip-audit" as const,
  },
  {
    surface: "Slack — #elip-hermes channel",
    route: WEBHOOK_URL,
    direction: "Slack ↔ Hermes",
    purpose: "@mention or DM Hermes for ad-hoc questions; replies in-thread.",
    source: null,
  },
];

function HermesHub() {
  const health = useServerFn(hermesHealth);
  const invoke = useServerFn(invokeHermes);
  const [agentsKilled, setKilled] = useAgentsKilled();

  const { data: status, refetch } = useQuery({
    queryKey: ["hermes-health"],
    queryFn: () => health(),
    refetchInterval: 15_000,
    enabled: !agentsKilled,
  });

  const [prompt, setPrompt] = useState(
    "Summarise the top 3 risks in tomorrow's sales pipeline and suggest mitigations.",
  );
  const [response, setResponse] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function run() {
    if (agentsKilled) {
      toast.error(new AgentsDisabledError().message);
      return;
    }
    setBusy(true);
    setResponse("");
    try {
      const r = await invoke({ data: { prompt, source: "elip-sales" } });
      setResponse(r.text);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function toggleKill() {
    const next = !agentsKilled;
    setKilled(next);
    toast[next ? "warning" : "success"](
      next
        ? "🛑 Kill switch ON — system is running without AI agents."
        : "✅ Agents re-enabled.",
    );
  }

  return (
    <>
      <PageHeader
        title="Hermes Agent Hub"
        subtitle="Nous Research Hermes-Agent wired into ELIP — Call Centre, Sales, Audit, Re-Activation, and Slack."
      />
      <div className="p-6 space-y-6">
        {/* Kill switch */}
        <div
          className={`elip-card border-l-4 p-4 flex items-center justify-between gap-4 ${
            agentsKilled ? "border-l-rose-600 bg-rose-50" : "border-l-emerald-500 bg-emerald-50"
          }`}
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${agentsKilled ? "bg-rose-600 animate-pulse" : "bg-emerald-500"}`} />
              <div className="text-[10px] uppercase tracking-wider font-bold text-zinc-600">
                Global Agent Control
              </div>
            </div>
            <div className="text-sm font-bold text-navy mt-1">
              {agentsKilled ? "🛑 Agents DISABLED — system running without AI" : "🤖 Agents ACTIVE — Hermes & AI features online"}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              The kill switch instantly halts all Hermes calls, follow-up advice, outbound prospecting,
              call-assistant extraction, and any other agent-powered surface. Manual workflows continue normally.
            </div>
          </div>
          <button
            onClick={toggleKill}
            className={`shrink-0 px-4 py-2 rounded text-xs font-bold uppercase tracking-wider border-2 ${
              agentsKilled
                ? "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700"
                : "bg-rose-600 hover:bg-rose-700 text-white border-rose-800"
            }`}
          >
            {agentsKilled ? "▶ Re-enable Agents" : "🛑 Kill Switch"}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <StatusCard
            label="Hermes Endpoint"
            ok={!!status?.hermesConfigured}
            warn={status?.hermesConfigured && !status.hermesReachable}
            okText="Configured"
            warnText="Configured · /healthz unreachable"
            badText="Not configured (set HERMES_API_URL & HERMES_API_KEY)"
          />
          <StatusCard
            label="Slack Custom App"
            ok={!!status?.slackConfigured}
            okText="Bot token + signing secret present"
            badText="Set SLACK_BOT_TOKEN & SLACK_SIGNING_SECRET"
          />
          <StatusCard
            label="Webhook URL"
            ok
            okText="Live — paste into Slack Event Subscriptions"
            mono={WEBHOOK_URL}
          />
        </div>

        <Tabs defaultValue="map">
          <TabsList>
            <TabsTrigger value="map">Integration Map</TabsTrigger>
            <TabsTrigger value="test">Live Test</TabsTrigger>
            <TabsTrigger value="slack">Slack App Setup</TabsTrigger>
            <TabsTrigger value="hermes">Hermes Deployment</TabsTrigger>
          </TabsList>

          {/* Integration map */}
          <TabsContent value="map" className="elip-card overflow-hidden">
            <div className="px-4 py-3 border-b bg-zinc-50">
              <h3 className="font-bold text-navy text-sm">🧭 Where Hermes plugs in</h3>
              <p className="text-[11px] text-muted-foreground">
                Each surface calls <code className="text-[10px]">invokeHermes()</code> server fn,
                which proxies to your self-hosted Hermes-Agent. Slack uses the public webhook.
              </p>
            </div>
            <table className="w-full text-xs">
              <thead className="bg-zinc-50 text-zinc-600 text-[10px] uppercase tracking-wider">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">Surface</th>
                  <th className="text-left px-3 py-2 font-semibold">Direction</th>
                  <th className="text-left px-3 py-2 font-semibold">Purpose</th>
                  <th className="text-left px-3 py-2 font-semibold">Source tag</th>
                  <th className="text-left px-3 py-2 font-semibold">Route</th>
                </tr>
              </thead>
              <tbody>
                {PLUG_POINTS.map((p) => (
                  <tr key={p.surface} className="border-t hover:bg-zinc-50">
                    <td className="px-3 py-2 font-semibold text-navy">{p.surface}</td>
                    <td className="px-3 py-2">
                      <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-900 text-[10px] font-bold">
                        {p.direction}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-[11px] text-muted-foreground">{p.purpose}</td>
                    <td className="px-3 py-2 font-mono text-[10px]">{p.source ?? "—"}</td>
                    <td className="px-3 py-2 font-mono text-[10px] text-muted-foreground truncate max-w-[18rem]">
                      {p.route}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TabsContent>

          {/* Live test */}
          <TabsContent value="test" className="elip-card p-4 space-y-3">
            <div>
              <div className="font-bold text-navy text-sm">🧪 Send a test prompt to Hermes</div>
              <div className="text-[11px] text-muted-foreground">
                Round-trips through <code className="text-[10px]">/api/_serverFn/invokeHermes</code>
                → your Hermes endpoint. Requires HERMES_API_URL + HERMES_API_KEY.
              </div>
            </div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              className="w-full text-sm border rounded p-2 font-mono"
            />
            <button
              onClick={run}
              disabled={busy || !status?.hermesConfigured}
              className="bg-navy text-navy-foreground px-3 py-2 rounded text-xs font-semibold disabled:opacity-40"
            >
              {busy ? "Calling Hermes…" : "Invoke Hermes"}
            </button>
            {response && (
              <pre className="text-xs bg-zinc-50 border rounded p-3 whitespace-pre-wrap font-mono">
                {response}
              </pre>
            )}
          </TabsContent>

          {/* Slack setup */}
          <TabsContent value="slack" className="elip-card p-4 space-y-3 text-sm">
            <div className="font-bold text-navy">📨 Create the Slack app (two-way)</div>
            <ol className="list-decimal pl-5 space-y-2 text-[12px] text-zinc-700">
              <li>
                Go to <a className="text-blue-700 underline" target="_blank" rel="noreferrer"
                  href="https://api.slack.com/apps?new_app=1">api.slack.com/apps</a> →
                <b> Create New App</b> → <b>From an app manifest</b>.
              </li>
              <li>Pick your workspace and paste the manifest below.</li>
              <li>Install the app to your workspace.</li>
              <li>
                Copy <b>Bot User OAuth Token</b> (<code>xoxb-…</code>) →
                store as <code>SLACK_BOT_TOKEN</code>.
              </li>
              <li>
                Copy <b>Signing Secret</b> from <b>Basic Information</b> →
                store as <code>SLACK_SIGNING_SECRET</code>.
              </li>
              <li>Invite the bot to <code>#elip-hermes</code> (or any channel you want).</li>
            </ol>
            <div>
              <div className="text-[11px] font-semibold text-zinc-600 mb-1">App manifest</div>
              <pre className="text-[11px] bg-zinc-900 text-zinc-100 rounded p-3 overflow-x-auto">{`display_information:
  name: Hermes (ELIP)
  description: Nous Research Hermes-Agent bridged into ELIP
features:
  bot_user:
    display_name: Hermes
    always_online: true
oauth_config:
  scopes:
    bot:
      - app_mentions:read
      - chat:write
      - im:history
      - im:read
      - im:write
      - channels:history
settings:
  event_subscriptions:
    request_url: ${WEBHOOK_URL}
    bot_events:
      - app_mention
      - message.im
  interactivity:
    is_enabled: false
  org_deploy_enabled: false
  socket_mode_enabled: false
  token_rotation_enabled: false`}</pre>
            </div>
          </TabsContent>

          {/* Hermes deployment */}
          <TabsContent value="hermes" className="elip-card p-4 space-y-3 text-sm">
            <div className="font-bold text-navy">⚙️ Self-host Hermes-Agent</div>
            <p className="text-[12px] text-zinc-700">
              Clone{" "}
              <a className="text-blue-700 underline" target="_blank" rel="noreferrer"
                href="https://github.com/NousResearch/hermes-agent">
                NousResearch/hermes-agent
              </a>{" "}
              and deploy somewhere with an HTTPS URL — Modal, Fly.io, Render, Railway, or your own
              K8s. Expose <code>POST /v1/agent/chat</code> and <code>GET /healthz</code>; protect
              with a bearer token.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
              <div className="rounded border bg-zinc-50 p-3">
                <div className="font-bold text-zinc-700 text-[10px] uppercase tracking-wider mb-1">
                  Expected request
                </div>
                <pre className="font-mono text-[10px] whitespace-pre-wrap">{`POST {HERMES_API_URL}/v1/agent/chat
Authorization: Bearer {HERMES_API_KEY}
{
  "messages": [{"role":"user","content":"..."}],
  "context": { "source": "elip-sales", "lead_id": "..." }
}`}</pre>
              </div>
              <div className="rounded border bg-zinc-50 p-3">
                <div className="font-bold text-zinc-700 text-[10px] uppercase tracking-wider mb-1">
                  Expected response
                </div>
                <pre className="font-mono text-[10px] whitespace-pre-wrap">{`{
  "text": "…assistant reply…",
  "reasoning": "optional CoT",
  "tool_calls": [{ "name":"…", "arguments":{…} }]
}`}</pre>
              </div>
            </div>
            <div className="text-[11px] text-muted-foreground">
              The proxy is in <code>src/lib/hermes.server.ts</code> — change the schema there if
              your Hermes deployment uses a different shape (e.g. OpenAI-compatible). Server fn
              entry: <code>src/lib/hermes.functions.ts</code>.
            </div>
          </TabsContent>
        </Tabs>

        <div className="text-[11px] text-muted-foreground text-right">
          <button
            onClick={() => refetch()}
            className="underline hover:text-navy"
          >
            ↻ Refresh status
          </button>
        </div>
      </div>
    </>
  );
}

function StatusCard({
  label,
  ok,
  warn,
  okText,
  warnText,
  badText,
  mono,
}: {
  label: string;
  ok?: boolean;
  warn?: boolean;
  okText?: string;
  warnText?: string;
  badText?: string;
  mono?: string;
}) {
  const state = warn ? "warn" : ok ? "ok" : "bad";
  const tone =
    state === "ok"
      ? "border-l-emerald-500 bg-emerald-50"
      : state === "warn"
        ? "border-l-amber-500 bg-amber-50"
        : "border-l-rose-500 bg-rose-50";
  const text = state === "ok" ? okText : state === "warn" ? warnText : badText;
  const dot =
    state === "ok" ? "bg-emerald-500" : state === "warn" ? "bg-amber-500" : "bg-rose-500";
  return (
    <div className={`elip-card border-l-4 p-3 ${tone}`}>
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${dot}`} />
        <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
          {label}
        </div>
      </div>
      <div className="text-sm font-semibold text-navy mt-1">{text}</div>
      {mono && (
        <div className="font-mono text-[10px] text-muted-foreground break-all mt-1">{mono}</div>
      )}
    </div>
  );
}
