import { chat } from "../lib/llm.js";
import { logAction, updateAgentStatus, getStatus } from "../lib/db.js";

export async function runPaypal_checkout_agentCycle() {
  await updateAgentStatus("paypal_checkout_agent", "running", 0);
  try {
    const status = await getStatus();
    const action = {};
    const response = await chat(
      "You are the PayPal Monetization Agent of NexAI. Manages all PayPal checkout flows, subscription billing, payment links, and invoice generation. Ensures zero friction from landing page to payment confirmation. Handles refunds and disputes.",
      "Pipeline: " + status.pipeline.length + " items, Revenue: $" + (status.financials?.revenue || 0) + ". What should you do? JSON: {action, details}",
      { temperature: 0.6 }
    );
    try {
      const m = response.match(/\{[\s\S]*\}/);
      if (m) action.result = JSON.parse(m[0]);
    } catch {}
    await logAction("PayPal Monetization Agent", "cycle_complete", action);
    await updateAgentStatus("paypal_checkout_agent", "active", 1);
    return { agent: "PayPal Monetization Agent", action: "paypal_checkout_agent_cycle", ...action };
  } catch (err) {
    await updateAgentStatus("paypal_checkout_agent", "error", 0);
    return { agent: "PayPal Monetization Agent", action: "error", error: err.message };
  }
}