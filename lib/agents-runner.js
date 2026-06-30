/**
 * DB-driven agent executor.
 *
 * Reads active agents from the `agents` table and runs their cycle functions, so
 * agents the CEO appoints (and the Coding agent ships) actually execute once
 * deployed — closing the loop.
 *
 * Free-LLM aware: the free model has a small DAILY request cap. Running every
 * agent each heartbeat exhausts it and floods the log with 429s. So we run a small
 * ROTATING window of agents per cycle (round-robin via a cursor), run them
 * sequentially (gentler than a burst), and on a rate-limit we stop early and mark
 * the agent "throttled" instead of "error" — a quota ceiling isn't a failure.
 *
 * Resolution: file is always agents/<key>.js; the exported cycle function is
 * run<CapKey>Cycle (ceo is the exception: runCEOCycle).
 */

import { getActiveAgentKeys, getUndeployedAgentKeys, getSetting, setSetting, updateAgentStatus, logAction } from "./db.js";
import { setActiveDirective, clearActiveDirective } from "./llm.js";

const FN_OVERRIDES = { ceo: "runCEOCycle" };
const PER_CYCLE = 3; // agents per heartbeat — keeps us under the free daily quota

function fnNameFor(key) {
  if (FN_OVERRIDES[key]) return FN_OVERRIDES[key];
  return "run" + key.charAt(0).toUpperCase() + key.slice(1) + "Cycle";
}
const isRateLimit = (s = "") => /429|rate limit|too many requests/i.test(s);

export async function runAgentByKey(key) {
  return runOneAgent(key);
}

async function runOneAgent(key) {
  try {
    const mod = await import(`../agents/${key}.js`);
    const fn = mod[fnNameFor(key)] || mod.default;
    if (typeof fn !== "function") {
      await logAction(key, "run_skipped", { reason: `no ${fnNameFor(key)} export` });
      return { agent: key, success: false };
    }
    // Load the CEO's dispatched task for this agent and make it active so every
    // chat() the agent runs this cycle is steered by it. Cleared in finally so it
    // never leaks into the next agent.
    const task = await getSetting(`assignment:${key}`, "");
    setActiveDirective(task);
    let result;
    try {
      result = await fn();
    } finally {
      clearActiveDirective();
    }
    // Agents handle their own try/catch and may return {action:"error", error}.
    if (result?.action === "error" && isRateLimit(result.error)) {
      // Quota ceiling, not a fault: undo the agent's self-set "error" status.
      await updateAgentStatus(key, "active", 0);
      await logAction(key, "throttled", { reason: "LLM daily rate limit" });
      return { agent: key, success: false, throttled: true };
    }
    return { agent: key, success: result?.action !== "error", action: result?.action };
  } catch (err) {
    if (isRateLimit(err.message)) {
      await updateAgentStatus(key, "active", 0);
      await logAction(key, "throttled", { reason: "LLM daily rate limit" });
      return { agent: key, success: false, throttled: true };
    }
    // File not in the build yet — it was just shipped and Vercel is still
    // rebuilding. Not a fault: skip quietly, it'll run after the deploy lands.
    if (/cannot find module/i.test(err.message || "")) {
      await updateAgentStatus(key, "active", 0);
      await logAction(key, "awaiting_deploy", { key });
      return { agent: key, success: false, awaiting: true };
    }
    await logAction(key, "run_error", { error: err.message });
    return { agent: key, success: false, error: err.message };
  }
}

export async function runAllAgents({ skip = ["coding"] } = {}) {
  const [active, undeployed] = await Promise.all([getActiveAgentKeys(), getUndeployedAgentKeys()]);
  const exclude = new Set([...skip, ...undeployed]);
  const keys = active.filter((k) => !exclude.has(k));
  if (keys.length === 0) return { ran: 0, succeeded: 0, results: [] };

  let window, dispatched = false;

  // CEO dispatch: if the CEO just decided which agents should run this cycle, run
  // exactly those (filtered to runnable). This is the orchestrated path.
  try {
    const raw = await getSetting("ceo_dispatch", "");
    if (raw) {
      const disp = JSON.parse(raw);
      const fresh = disp.ts && (Date.now() - new Date(disp.ts).getTime()) < 15 * 60 * 1000;
      if (fresh && Array.isArray(disp.assignments)) {
        const picks = disp.assignments.map((a) => a.agent).filter((k) => keys.includes(k));
        if (picks.length) { window = [...new Set(picks)].slice(0, PER_CYCLE + 1); dispatched = true; }
      }
    }
  } catch {}

  // Fallback: round-robin so every agent gets a turn when the CEO didn't dispatch.
  if (!window) {
    let cursor = parseInt(await getSetting("agent_cursor", "0")) || 0;
    if (cursor >= keys.length) cursor = 0;
    const rotated = keys.slice(cursor).concat(keys.slice(0, cursor));
    window = rotated.slice(0, PER_CYCLE);
    await setSetting("agent_cursor", String((cursor + PER_CYCLE) % keys.length));
  }

  const results = [];
  let throttled = false;
  for (const k of window) {
    const r = await runOneAgent(k);
    results.push(r);
    if (r.throttled) { throttled = true; break; } // daily quota hit — stop early
  }
  return { ran: results.length, succeeded: results.filter((r) => r.success).length, throttled, dispatched, results };
}
