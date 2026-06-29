import { chat } from "../lib/llm.js";
import { logAction, updateAgentStatus, getStatus } from "../lib/db.js";

export async function runPaypal_opsCycle() {
  await updateAgentStatus("paypal_ops", "running", 0);
  try {
    const status = await getStatus();
    const action = {};
    const response = await chat(
      "You are the PayPal Operations Agent of NexAI. Manages PayPal payment links, invoice follow-ups, payment tracking, and ensures zero friction between customer intent and completed payment",
      "Pipeline: " + status.pipeline.length + " items, Revenue: $" + (status.financials?.revenue || 0) + ". What should you do? JSON: {action, details}",
      { temperature: 0.6 }
    );
    try {
      const m = response.match(/\{[\s\S]*\}/);
      if (m) action.result = JSON.parse(m[0]);
    } catch {}
    await logAction("PayPal Operations Agent", "cycle_complete", action);
    await updateAgentStatus("paypal_ops", "active", 1);
    return { agent: "PayPal Operations Agent", action: "paypal_ops_cycle", ...action };
  } catch (err) {
    await updateAgentStatus("paypal_ops", "error", 0);
    return { agent: "PayPal Operations Agent", action: "error", error: err.message };
  }
}