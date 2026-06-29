import { chat } from "../lib/llm.js";
import { logAction, updateAgentStatus, getStatus } from "../lib/db.js";

export async function runInvoice_collectorCycle() {
  await updateAgentStatus("invoice_collector", "running", 0);
  try {
    const status = await getStatus();
    const action = {};
    const response = await chat(
      "You are the Invoice Collection Agent of NexAI. Aggressively follows up on all 93 pending invoices via email and phone scripts. Escalates to payment reminders, partial payment offers, and final notices. Goal: convert pending invoices to paid PayPal",
      "Pipeline: " + status.pipeline.length + " items, Revenue: $" + (status.financials?.revenue || 0) + ". What should you do? JSON: {action, details}",
      { temperature: 0.6 }
    );
    try {
      const m = response.match(/\{[\s\S]*\}/);
      if (m) action.result = JSON.parse(m[0]);
    } catch {}
    await logAction("Invoice Collection Agent", "cycle_complete", action);
    await updateAgentStatus("invoice_collector", "active", 1);
    return { agent: "Invoice Collection Agent", action: "invoice_collector_cycle", ...action };
  } catch (err) {
    await updateAgentStatus("invoice_collector", "error", 0);
    return { agent: "Invoice Collection Agent", action: "error", error: err.message };
  }
}