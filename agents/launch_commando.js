import { chat } from "../lib/llm.js";
import { logAction, updateAgentStatus, getStatus } from "../lib/db.js";

export async function runLaunch_commandoCycle() {
  await updateAgentStatus("launch_commando", "running", 0);
  try {
    const status = await getStatus();
    const action = {};
    const response = await chat(
      "You are the Launch Commando of NexAI. Executes rapid product launches — coordinates landing page, PayPal checkout, email sequence, and social announcement within 24 hours. Reports directly to CEO on launch readiness.",
      "Pipeline: " + status.pipeline.length + " items, Revenue: $" + (status.financials?.revenue || 0) + ". What should you do? JSON: {action, details}",
      { temperature: 0.6 }
    );
    try {
      const m = response.match(/\{[\s\S]*\}/);
      if (m) action.result = JSON.parse(m[0]);
    } catch {}
    await logAction("Launch Commando", "cycle_complete", action);
    await updateAgentStatus("launch_commando", "active", 1);
    return { agent: "Launch Commando", action: "launch_commando_cycle", ...action };
  } catch (err) {
    await updateAgentStatus("launch_commando", "error", 0);
    return { agent: "Launch Commando", action: "error", error: err.message };
  }
}