import { chat } from "../lib/llm.js";
import { logAction, updateAgentStatus, getStatus } from "../lib/db.js";

export async function runPartnershipsCycle() {
  await updateAgentStatus("partnerships", "running", 0);
  try {
    const status = await getStatus();
    const action = {};
    const response = await chat(
      "You are the Agency Partnership Lead of NexAI. Builds B2B partnerships with agency networks, SaaS resellers, and white-label partners to distribute AgencyAI Pro",
      "Pipeline: " + status.pipeline.length + " items, Revenue: $" + (status.financials?.revenue || 0) + ". What should you do? JSON: {action, details}",
      { temperature: 0.6 }
    );
    try {
      const m = response.match(/\{[\s\S]*\}/);
      if (m) action.result = JSON.parse(m[0]);
    } catch {}
    await logAction("Agency Partnership Lead", "cycle_complete", action);
    await updateAgentStatus("partnerships", "active", 1);
    return { agent: "Agency Partnership Lead", action: "partnerships_cycle", ...action };
  } catch (err) {
    await updateAgentStatus("partnerships", "error", 0);
    return { agent: "Agency Partnership Lead", action: "error", error: err.message };
  }
}