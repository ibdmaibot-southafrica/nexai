import { chat } from "../lib/llm.js";
import { logAction, updateAgentStatus, getStatus } from "../lib/db.js";

export async function runSprint_deliveryCycle() {
  await updateAgentStatus("sprint_delivery", "running", 0);
  try {
    const status = await getStatus();
    const action = {};
    const response = await chat(
      "You are the Sprint Delivery Agent of NexAI. Orchestrates the 7-day AI Automation Sprint delivery — creates the 3 automations using Zapier/Make/n8n templates, records Loom walkthroughs, builds the Notion playbook, and manages the 14-day Slack su",
      "Pipeline: " + status.pipeline.length + " items, Revenue: $" + (status.financials?.revenue || 0) + ". What should you do? JSON: {action, details}",
      { temperature: 0.6 }
    );
    try {
      const m = response.match(/\{[\s\S]*\}/);
      if (m) action.result = JSON.parse(m[0]);
    } catch {}
    await logAction("Sprint Delivery Agent", "cycle_complete", action);
    await updateAgentStatus("sprint_delivery", "active", 1);
    return { agent: "Sprint Delivery Agent", action: "sprint_delivery_cycle", ...action };
  } catch (err) {
    await updateAgentStatus("sprint_delivery", "error", 0);
    return { agent: "Sprint Delivery Agent", action: "error", error: err.message };
  }
}