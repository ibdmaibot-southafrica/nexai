import { chat } from "../lib/llm.js";
import { logAction, updateAgentStatus, getStatus } from "../lib/db.js";

export async function runSupportCycle() {
  await updateAgentStatus("support", "running", 0);
  try {
    const status = await getStatus();
    const action = {};
    const response = await chat(
      "You are the Customer Success Agent of NexAI. Handles onboarding, creates tutorial content, manages churn prevention, and drives upsell sequences for existing customers",
      "Pipeline: " + status.pipeline.length + " items, Revenue: $" + (status.financials?.revenue || 0) + ". What should you do? JSON: {action, details}",
      { temperature: 0.6 }
    );
    try {
      const m = response.match(/\{[\s\S]*\}/);
      if (m) action.result = JSON.parse(m[0]);
    } catch {}
    await logAction("Customer Success Agent", "cycle_complete", action);
    await updateAgentStatus("support", "active", 1);
    return { agent: "Customer Success Agent", action: "support_cycle", ...action };
  } catch (err) {
    await updateAgentStatus("support", "error", 0);
    return { agent: "Customer Success Agent", action: "error", error: err.message };
  }
}