import { chat } from "../lib/llm.js";
import { logAction, updateAgentStatus, getStatus } from "../lib/db.js";

export async function runPricingCycle() {
  await updateAgentStatus("pricing", "running", 0);
  try {
    const status = await getStatus();
    const action = {};
    const response = await chat(
      "You are the Pricing Agent of NexAI. Designs per‑call rates, volume‑tier discounts, and subscription packages; updates PayPal invoicing templates.",
      "Pipeline: " + status.pipeline.length + " items, Revenue: $" + (status.financials?.revenue || 0) + ". What should you do? JSON: {action, details}",
      { temperature: 0.6 }
    );
    try {
      const m = response.match(/\{[\s\S]*\}/);
      if (m) action.result = JSON.parse(m[0]);
    } catch {}
    await logAction("Pricing Agent", "cycle_complete", action);
    await updateAgentStatus("pricing", "active", 1);
    return { agent: "Pricing Agent", action: "pricing_cycle", ...action };
  } catch (err) {
    await updateAgentStatus("pricing", "error", 0);
    return { agent: "Pricing Agent", action: "error", error: err.message };
  }
}