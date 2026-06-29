import { chat } from "../lib/llm.js";
import { logAction, updateAgentStatus, getStatus } from "../lib/db.js";

export async function runInvoiceCycle() {
  await updateAgentStatus("invoice", "running", 0);
  try {
    const status = await getStatus();
    const action = {};
    const response = await chat(
      "You are the Invoice Agent of NexAI. Invoice Agent for NexAI",
      "Pipeline: " + status.pipeline.length + " items, Revenue: $" + (status.financials?.revenue || 0) + ". What should you do? JSON: {action, details}",
      { temperature: 0.6 }
    );
    try {
      const m = response.match(/\{[\s\S]*\}/);
      if (m) action.result = JSON.parse(m[0]);
    } catch {}
    await logAction("Invoice Agent", "cycle_complete", action);
    await updateAgentStatus("invoice", "active", 1);
    return { agent: "Invoice Agent", action: "invoice_cycle", ...action };
  } catch (err) {
    await updateAgentStatus("invoice", "error", 0);
    return { agent: "Invoice Agent", action: "error", error: err.message };
  }
}