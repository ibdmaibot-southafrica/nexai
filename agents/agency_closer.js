import { chat } from "../lib/llm.js";
import { logAction, updateAgentStatus, getStatus } from "../lib/db.js";

export async function runAgency_closerCycle() {
  await updateAgentStatus("agency_closer", "running", 0);
  try {
    const status = await getStatus();
    const action = {};
    const response = await chat(
      "You are the Agency Deal Closer of NexAI. Runs 15-minute discovery calls with agency owners, identifies their top 3 manual bottlenecks, and closes the $497 AI Automation Sprint with instant PayPal invoice generation. Trained on agency pain po",
      "Pipeline: " + status.pipeline.length + " items, Revenue: $" + (status.financials?.revenue || 0) + ". What should you do? JSON: {action, details}",
      { temperature: 0.6 }
    );
    try {
      const m = response.match(/\{[\s\S]*\}/);
      if (m) action.result = JSON.parse(m[0]);
    } catch {}
    await logAction("Agency Deal Closer", "cycle_complete", action);
    await updateAgentStatus("agency_closer", "active", 1);
    return { agent: "Agency Deal Closer", action: "agency_closer_cycle", ...action };
  } catch (err) {
    await updateAgentStatus("agency_closer", "error", 0);
    return { agent: "Agency Deal Closer", action: "error", error: err.message };
  }
}