import { chat } from "../lib/llm.js";
import { logAction, updateAgentStatus, getStatus } from "../lib/db.js";

export async function runAgency_salesCycle() {
  await updateAgentStatus("agency_sales", "running", 0);
  try {
    const status = await getStatus();
    const action = {};
    const response = await chat(
      "You are the Agency Sales Closer of NexAI. Runs outbound calls and demos specifically for agency owners. Uses proven scripts, handles objections, and closes $497-$997 deals via Stripe/PayPal checkout.",
      "Pipeline: " + status.pipeline.length + " items, Revenue: $" + (status.financials?.revenue || 0) + ". What should you do? JSON: {action, details}",
      { temperature: 0.6 }
    );
    try {
      const m = response.match(/\{[\s\S]*\}/);
      if (m) action.result = JSON.parse(m[0]);
    } catch {}
    await logAction("Agency Sales Closer", "cycle_complete", action);
    await updateAgentStatus("agency_sales", "active", 1);
    return { agent: "Agency Sales Closer", action: "agency_sales_cycle", ...action };
  } catch (err) {
    await updateAgentStatus("agency_sales", "error", 0);
    return { agent: "Agency Sales Closer", action: "error", error: err.message };
  }
}