import { chat } from "../lib/llm.js";
import { logAction, updateAgentStatus, getStatus } from "../lib/db.js";

export async function runAgent_opsCycle() {
  await updateAgentStatus("agent_ops", "running", 0);
  try {
    const status = await getStatus();
    const action = {};
    const response = await chat(
      "You are the AI Employee Operations Lead of NexAI. Manages the backend logic for agent task routing, output quality scoring, and the results ledger. Ensures agents produce work the customer can actually use.",
      "Pipeline: " + status.pipeline.length + " items, Revenue: $" + (status.financials?.revenue || 0) + ". What should you do? JSON: {action, details}",
      { temperature: 0.6 }
    );
    try {
      const m = response.match(/\{[\s\S]*\}/);
      if (m) action.result = JSON.parse(m[0]);
    } catch {}
    await logAction("AI Employee Operations Lead", "cycle_complete", action);
    await updateAgentStatus("agent_ops", "active", 1);
    return { agent: "AI Employee Operations Lead", action: "agent_ops_cycle", ...action };
  } catch (err) {
    await updateAgentStatus("agent_ops", "error", 0);
    return { agent: "AI Employee Operations Lead", action: "error", error: err.message };
  }
}