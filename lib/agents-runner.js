/**
 * DB-driven agent executor.
 *
 * Replaces the old hardcoded CORE_AGENTS list. Reads every active agent from the
 * `agents` table and runs its cycle function, so agents the CEO appoints (and the
 * Coding agent ships) actually execute once deployed — closing the loop.
 *
 * Resolution: file is always agents/<key>.js; the exported cycle function is
 * run<CapKey>Cycle, matching what generateAgentCode() emits (lib/../agents/coding.js).
 * `ceo` is the one core agent whose export is upper-cased (runCEOCycle).
 *
 * Note on dynamic import: webpack builds a context module over agents/*.js at
 * build time. A newly merged agent file becomes importable on the NEXT Vercel
 * build (which the merge triggers) — exactly the loop cadence we want.
 */

import { getActiveAgentKeys, getUndeployedAgentKeys, logAction } from "./db.js";

const FN_OVERRIDES = { ceo: "runCEOCycle" };

function fnNameFor(key) {
  if (FN_OVERRIDES[key]) return FN_OVERRIDES[key];
  return "run" + key.charAt(0).toUpperCase() + key.slice(1) + "Cycle";
}

async function runOneAgent(key) {
  try {
    const mod = await import(`../agents/${key}.js`);
    const fn = mod[fnNameFor(key)] || mod.default;
    if (typeof fn !== "function") {
      await logAction(key, "run_skipped", { reason: `no ${fnNameFor(key)} export` });
      return { agent: key, success: false, error: "no cycle function" };
    }
    const result = await fn();
    return { agent: key, success: true, action: result?.action };
  } catch (err) {
    // Missing file (not yet deployed/built) or a throwing agent — log and move on.
    await logAction(key, "run_error", { error: err.message });
    return { agent: key, success: false, error: err.message };
  }
}

/**
 * Run all active agents. `coding` is excluded by default because the autonomous
 * cycle drives code generation + deploy explicitly (lib/cycle.js).
 */
export async function runAllAgents({ skip = ["coding"] } = {}) {
  const [active, undeployed] = await Promise.all([getActiveAgentKeys(), getUndeployedAgentKeys()]);
  // Skip the coding agent (driven separately) and any agent whose code hasn't
  // been deployed yet (its file isn't in the build, so importing it would throw).
  const exclude = new Set([...skip, ...undeployed]);
  const keys = active.filter((k) => !exclude.has(k));
  const settled = await Promise.allSettled(keys.map((k) => runOneAgent(k)));
  const results = settled.map((s, i) =>
    s.status === "fulfilled" ? s.value : { agent: keys[i], success: false, error: s.reason?.message }
  );
  return {
    ran: keys.length,
    succeeded: results.filter((r) => r.success).length,
    results,
  };
}
