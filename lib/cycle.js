/**
 * The single canonical autonomous cycle, driven by the existing heartbeat
 * (cron-job.org every ~5 min + Vercel daily cron). Both cron routes delegate here
 * so there is one source of truth.
 *
 *   kill-switch check -> advance build-gate -> generate code -> run all agents
 *
 * Every stage is isolated: one stage failing never aborts the others.
 */

import { getSetting, logAction, syncLaunchedToStore } from "./db.js";
import { advanceDeploy } from "./deploy.js";
import { runCodingCycle } from "../agents/coding.js";
import { runAllAgents, runAgentByKey } from "./agents-runner.js";

export async function runAutonomousCycle() {
  const start = Date.now();

  const enabled = (await getSetting("autonomy_enabled", "true")) !== "false";
  if (!enabled) {
    return { skipped: true, reason: "autonomy_disabled", timestamp: new Date().toISOString() };
  }

  const result = { skipped: false };

  // 1. Move the build-gate state machine forward one step (push / poll / merge).
  try {
    result.deploy = await advanceDeploy();
  } catch (err) {
    result.deploy = { state: "error", error: err.message };
    await logAction("System", "deploy_error", { error: err.message });
  }

  // 2. CEO runs FIRST and dispatches the cycle — it decides which agents run and
  //    what each should do (written to ceo_dispatch). This replaces blind
  //    round-robin and cuts redundant work.
  try {
    result.ceo = await runAgentByKey("ceo");
  } catch (err) {
    result.ceo = { error: err.message };
    await logAction("System", "ceo_error", { error: err.message });
  }

  // 3. Generate code for any newly appointed agents (queues into agent_code).
  try {
    result.coding = await runCodingCycle();
  } catch (err) {
    result.coding = { error: err.message };
    await logAction("System", "coding_error", { error: err.message });
  }

  // 4. Run the agents the CEO dispatched (falls back to round-robin if none).
  try {
    result.agents = await runAllAgents({ skip: ["coding", "ceo"] });
  } catch (err) {
    result.agents = { error: err.message };
    await logAction("System", "agents_error", { error: err.message });
  }

  // 4. Publish any newly launched pipeline items to the storefront.
  try {
    result.productsPublished = await syncLaunchedToStore();
  } catch (err) {
    result.productsPublished = 0;
    await logAction("System", "store_sync_error", { error: err.message });
  }

  result.duration = Date.now() - start;
  result.timestamp = new Date().toISOString();

  await logAction("System", "autonomous_cycle", {
    deploy: result.deploy?.state,
    codingBuilt: result.coding?.built || 0,
    agentsRan: result.agents?.ran || 0,
    agentsOk: result.agents?.succeeded || 0,
    duration: result.duration,
  });

  return result;
}
