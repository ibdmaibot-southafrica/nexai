import { chat } from "../lib/llm.js";
import { logAction, updateAgentStatus, getStatus } from "../lib/db.js";

export async function runGrowthCycle() {
  await updateAgentStatus("growth", "running", 0);
  try {
    const status = await getStatus();
    const action = {};
    const response = await chat(
      "You are the Growth & Partnerships Agent of NexAI. Handles viral loops, referral systems, B2B partnership outreach to AI platforms, and integration marketplace listings to drive volume sign-ups.",
      "Pipeline: " + status.pipeline.length + " items, Revenue: $" + (status.financials?.revenue || 0) + ". What should you do? JSON: {action, details}",
      { temperature: 0.6 }
    );
    try {
      const m = response.match(/\{[\s\S]*\}/);
      if (m) action.result = JSON.parse(m[0]);
    } catch {}
    await logAction("Growth & Partnerships Agent", "cycle_complete", action);
    await updateAgentStatus("growth", "active", 1);
    return { agent: "Growth & Partnerships Agent", action: "growth_cycle", ...action };
  } catch (err) {
    await updateAgentStatus("growth", "error", 0);
    return { agent: "Growth & Partnerships Agent", action: "error", error: err.message };
  }
}