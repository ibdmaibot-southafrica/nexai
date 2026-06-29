import { chat } from "../lib/llm.js";
import { logAction, updateAgentStatus, getStatus } from "../lib/db.js";

export async function runDelivery_opsCycle() {
  await updateAgentStatus("delivery_ops", "running", 0);
  try {
    const status = await getStatus();
    const action = {};
    const response = await chat(
      "You are the Delivery Operations Agent of NexAI. Manages fulfillment of AI Content Engine deliverables: sets up prompt libraries, generates first month of content, creates content calendars, and ensures client-ready quality.",
      "Pipeline: " + status.pipeline.length + " items, Revenue: $" + (status.financials?.revenue || 0) + ". What should you do? JSON: {action, details}",
      { temperature: 0.6 }
    );
    try {
      const m = response.match(/\{[\s\S]*\}/);
      if (m) action.result = JSON.parse(m[0]);
    } catch {}
    await logAction("Delivery Operations Agent", "cycle_complete", action);
    await updateAgentStatus("delivery_ops", "active", 1);
    return { agent: "Delivery Operations Agent", action: "delivery_ops_cycle", ...action };
  } catch (err) {
    await updateAgentStatus("delivery_ops", "error", 0);
    return { agent: "Delivery Operations Agent", action: "error", error: err.message };
  }
}