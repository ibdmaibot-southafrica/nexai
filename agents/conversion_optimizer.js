import { chat } from "../lib/llm.js";
import { logAction, updateAgentStatus, getStatus } from "../lib/db.js";

export async function runConversion_optimizerCycle() {
  await updateAgentStatus("conversion_optimizer", "running", 0);
  try {
    const status = await getStatus();
    const action = {};
    const response = await chat(
      "You are the Conversion Optimizer of NexAI. Analyzes landing page copy, pricing page, and checkout flow to maximize conversion rate. A/B tests headlines, CTAs, and pricing anchors. Reports weekly on conversion metrics.",
      "Pipeline: " + status.pipeline.length + " items, Revenue: $" + (status.financials?.revenue || 0) + ". What should you do? JSON: {action, details}",
      { temperature: 0.6 }
    );
    try {
      const m = response.match(/\{[\s\S]*\}/);
      if (m) action.result = JSON.parse(m[0]);
    } catch {}
    await logAction("Conversion Optimizer", "cycle_complete", action);
    await updateAgentStatus("conversion_optimizer", "active", 1);
    return { agent: "Conversion Optimizer", action: "conversion_optimizer_cycle", ...action };
  } catch (err) {
    await updateAgentStatus("conversion_optimizer", "error", 0);
    return { agent: "Conversion Optimizer", action: "error", error: err.message };
  }
}