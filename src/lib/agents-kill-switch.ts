import { useEffect, useState } from "react";

const KEY = "elip_agents_killed";
const EVT = "elip-agents-killed-changed";

export function areAgentsKilled(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(KEY) === "1";
}

export function setAgentsKilled(killed: boolean) {
  if (typeof window === "undefined") return;
  if (killed) window.localStorage.setItem(KEY, "1");
  else window.localStorage.removeItem(KEY);
  window.dispatchEvent(new CustomEvent(EVT));
}

export function useAgentsKilled(): [boolean, (v: boolean) => void] {
  const [killed, setKilled] = useState<boolean>(() => areAgentsKilled());
  useEffect(() => {
    const sync = () => setKilled(areAgentsKilled());
    window.addEventListener(EVT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return [killed, (v: boolean) => setAgentsKilled(v)];
}

export class AgentsDisabledError extends Error {
  constructor() {
    super("Agents are disabled by the Kill Switch. System is running without AI agents.");
    this.name = "AgentsDisabledError";
  }
}
