import { chat } from "../lib/llm.js";
import { logAction, updateAgentStatus, getStatus } from "../lib/db.js";

export async function runDemo_specialistCycle() {
  await updateAgentStatus("demo_specialist", "running", 0);
  try {
    const status = await getStatus();
    const action = {};
    const response = await chat(
      "You are the Live Demo Closer of NexAI. Conducts live product demos for interested agencies, handles objections, and closes sales with immediate PayPal invoice generation",
      "Pipeline: " + status.pipeline.length + " items, Revenue: $" + (status.financials?.revenue || 0) + ". What should you do? JSON: {action, details}",
      { temperature: 0.6 }
    );
    try {
      const m = response.match(/\{[\s\S]*\}/);
      if (m) action.result = JSON.parse(m[0]);
    } catch {}
    await logAction("Live Demo Closer", "cycle_complete", action);
    await updateAgentStatus("demo_specialist", "active", 1);
    return { agent: "Live Demo Closer", action: "demo_specialist_cycle", ...action };
  } catch (err) {
    await updateAgentStatus("demo_specialist", "error", 0);
    return { agent: "Live Demo Closer", action: "error", error: err.message };
  }
}