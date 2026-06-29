import { chat } from "../lib/llm.js";
import { logAction, updateAgentStatus, getStatus } from "../lib/db.js";

export async function runLaunch_specialistCycle() {
  await updateAgentStatus("launch_specialist", "running", 0);
  try {
    const status = await getStatus();
    const action = {};
    const response = await chat(
      "You are the Launch Specialist of NexAI. Coordinates product launches, manages go-to-market timing, ensures all agents align on launch sequence and messaging",
      "Pipeline: " + status.pipeline.length + " items, Revenue: $" + (status.financials?.revenue || 0) + ". What should you do? JSON: {action, details}",
      { temperature: 0.6 }
    );
    try {
      const m = response.match(/\{[\s\S]*\}/);
      if (m) action.result = JSON.parse(m[0]);
    } catch {}
    await logAction("Launch Specialist", "cycle_complete", action);
    await updateAgentStatus("launch_specialist", "active", 1);
    return { agent: "Launch Specialist", action: "launch_specialist_cycle", ...action };
  } catch (err) {
    await updateAgentStatus("launch_specialist", "error", 0);
    return { agent: "Launch Specialist", action: "error", error: err.message };
  }
}