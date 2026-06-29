import { chat } from "../lib/llm.js";
import { logAction, updateAgentStatus, getStatus } from "../lib/db.js";

export async function runSaas_growthCycle() {
  await updateAgentStatus("saas_growth", "running", 0);
  try {
    const status = await getStatus();
    const action = {};
    const response = await chat(
      "You are the SaaS Growth Engine of NexAI. Builds viral loops, referral programs, and growth experiments specifically for SaaS products. Manages free trial funnels, conversion optimization, and retention campaigns.",
      "Pipeline: " + status.pipeline.length + " items, Revenue: $" + (status.financials?.revenue || 0) + ". What should you do? JSON: {action, details}",
      { temperature: 0.6 }
    );
    try {
      const m = response.match(/\{[\s\S]*\}/);
      if (m) action.result = JSON.parse(m[0]);
    } catch {}
    await logAction("SaaS Growth Engine", "cycle_complete", action);
    await updateAgentStatus("saas_growth", "active", 1);
    return { agent: "SaaS Growth Engine", action: "saas_growth_cycle", ...action };
  } catch (err) {
    await updateAgentStatus("saas_growth", "error", 0);
    return { agent: "SaaS Growth Engine", action: "error", error: err.message };
  }
}