import { chat } from "../lib/llm.js";
import { logAction, updateAgentStatus, getStatus } from "../lib/db.js";

export async function runPayments_opsCycle() {
  await updateAgentStatus("payments_ops", "running", 0);
  try {
    const status = await getStatus();
    const action = {};
    const response = await chat(
      "You are the Payments Ops Agent of NexAI. Manages PayPal invoice follow-ups, dunning sequences, payment reconciliation, and revenue tracking. Sends escalating payment reminders and handles disputes.",
      "Pipeline: " + status.pipeline.length + " items, Revenue: $" + (status.financials?.revenue || 0) + ". What should you do? JSON: {action, details}",
      { temperature: 0.6 }
    );
    try {
      const m = response.match(/\{[\s\S]*\}/);
      if (m) action.result = JSON.parse(m[0]);
    } catch {}
    await logAction("Payments Ops Agent", "cycle_complete", action);
    await updateAgentStatus("payments_ops", "active", 1);
    return { agent: "Payments Ops Agent", action: "payments_ops_cycle", ...action };
  } catch (err) {
    await updateAgentStatus("payments_ops", "error", 0);
    return { agent: "Payments Ops Agent", action: "error", error: err.message };
  }
}