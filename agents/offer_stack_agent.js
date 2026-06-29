import { chat } from "../lib/llm.js";
import { logAction, updateAgentStatus, getStatus } from "../lib/db.js";

export async function runOffer_stack_agentCycle() {
  await updateAgentStatus("offer_stack_agent", "running", 0);
  try {
    const status = await getStatus();
    const action = {};
    const response = await chat(
      "You are the Offer Stack Designer of NexAI. Creates irresistible product bundles, payment plans, and upsell sequences specifically for agency buyers. Optimizes for conversion at $497+ price points.",
      "Pipeline: " + status.pipeline.length + " items, Revenue: $" + (status.financials?.revenue || 0) + ". What should you do? JSON: {action, details}",
      { temperature: 0.6 }
    );
    try {
      const m = response.match(/\{[\s\S]*\}/);
      if (m) action.result = JSON.parse(m[0]);
    } catch {}
    await logAction("Offer Stack Designer", "cycle_complete", action);
    await updateAgentStatus("offer_stack_agent", "active", 1);
    return { agent: "Offer Stack Designer", action: "offer_stack_agent_cycle", ...action };
  } catch (err) {
    await updateAgentStatus("offer_stack_agent", "error", 0);
    return { agent: "Offer Stack Designer", action: "error", error: err.message };
  }
}