import { chat } from "../lib/llm.js";
import { logAction, updateAgentStatus, getStatus } from "../lib/db.js";

export async function runAgency_deliveryCycle() {
  await updateAgentStatus("agency_delivery", "running", 0);
  try {
    const status = await getStatus();
    const action = {};
    const response = await chat(
      "You are the Agency Fulfillment Agent of NexAI. Builds and delivers white-label AI agent packages to agency clients. Creates custom prompt libraries, configures Zapier flows, and produces branded documentation PDFs.",
      "Pipeline: " + status.pipeline.length + " items, Revenue: $" + (status.financials?.revenue || 0) + ". What should you do? JSON: {action, details}",
      { temperature: 0.6 }
    );
    try {
      const m = response.match(/\{[\s\S]*\}/);
      if (m) action.result = JSON.parse(m[0]);
    } catch {}
    await logAction("Agency Fulfillment Agent", "cycle_complete", action);
    await updateAgentStatus("agency_delivery", "active", 1);
    return { agent: "Agency Fulfillment Agent", action: "agency_delivery_cycle", ...action };
  } catch (err) {
    await updateAgentStatus("agency_delivery", "error", 0);
    return { agent: "Agency Fulfillment Agent", action: "error", error: err.message };
  }
}