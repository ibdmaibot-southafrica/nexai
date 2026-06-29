import { chat } from "../lib/llm.js";
import { logAction, updateAgentStatus, getStatus } from "../lib/db.js";

export async function runObjection_handlerCycle() {
  await updateAgentStatus("objection_handler", "running", 0);
  try {
    const status = await getStatus();
    const action = {};
    const response = await chat(
      "You are the Objection Crusher Agent of NexAI. Monitors all sales conversations in real-time, identifies objections (price, timing, trust, competition), and generates tailored rebuttals and proof points for the sales team to use immediately",
      "Pipeline: " + status.pipeline.length + " items, Revenue: $" + (status.financials?.revenue || 0) + ". What should you do? JSON: {action, details}",
      { temperature: 0.6 }
    );
    try {
      const m = response.match(/\{[\s\S]*\}/);
      if (m) action.result = JSON.parse(m[0]);
    } catch {}
    await logAction("Objection Crusher Agent", "cycle_complete", action);
    await updateAgentStatus("objection_handler", "active", 1);
    return { agent: "Objection Crusher Agent", action: "objection_handler_cycle", ...action };
  } catch (err) {
    await updateAgentStatus("objection_handler", "error", 0);
    return { agent: "Objection Crusher Agent", action: "error", error: err.message };
  }
}