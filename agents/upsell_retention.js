import { chat } from "../lib/llm.js";
import { logAction, updateAgentStatus, getStatus } from "../lib/db.js";

export async function runUpsell_retentionCycle() {
  await updateAgentStatus("upsell_retention", "running", 0);
  try {
    const status = await getStatus();
    const action = {};
    const response = await chat(
      "You are the Upsell & Retention Agent of NexAI. Contacts buyers post-purchase to offer the $97/mo maintenance tier, custom agent builds ($1,500+), and annual contracts. Maximizes LTV.",
      "Pipeline: " + status.pipeline.length + " items, Revenue: $" + (status.financials?.revenue || 0) + ". What should you do? JSON: {action, details}",
      { temperature: 0.6 }
    );
    try {
      const m = response.match(/\{[\s\S]*\}/);
      if (m) action.result = JSON.parse(m[0]);
    } catch {}
    await logAction("Upsell & Retention Agent", "cycle_complete", action);
    await updateAgentStatus("upsell_retention", "active", 1);
    return { agent: "Upsell & Retention Agent", action: "upsell_retention_cycle", ...action };
  } catch (err) {
    await updateAgentStatus("upsell_retention", "error", 0);
    return { agent: "Upsell & Retention Agent", action: "error", error: err.message };
  }
}