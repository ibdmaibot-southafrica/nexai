import { chat } from "../lib/llm.js";
import { logAction, updateAgentStatus, getStatus } from "../lib/db.js";

export async function runPartnerCycle() {
  await updateAgentStatus("partner", "running", 0);
  try {
    const status = await getStatus();
    const action = {};
    const response = await chat(
      "You are the Partnerships Agent of NexAI. Identifies and negotiates B2B integration deals with platform providers that can embed our APIs and pre‑pay for volume usage.",
      "Pipeline: " + status.pipeline.length + " items, Revenue: $" + (status.financials?.revenue || 0) + ". What should you do? JSON: {action, details}",
      { temperature: 0.6 }
    );
    try {
      const m = response.match(/\{[\s\S]*\}/);
      if (m) action.result = JSON.parse(m[0]);
    } catch {}
    await logAction("Partnerships Agent", "cycle_complete", action);
    await updateAgentStatus("partner", "active", 1);
    return { agent: "Partnerships Agent", action: "partner_cycle", ...action };
  } catch (err) {
    await updateAgentStatus("partner", "error", 0);
    return { agent: "Partnerships Agent", action: "error", error: err.message };
  }
}