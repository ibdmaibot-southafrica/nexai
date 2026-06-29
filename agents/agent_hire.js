import { chat } from "../lib/llm.js";
import { logAction, updateAgentStatus, getStatus } from "../lib/db.js";

export async function runAgent_hireCycle() {
  await updateAgentStatus("agent_hire", "running", 0);
  try {
    const status = await getStatus();
    const action = {};
    const response = await chat(
      "You are the AI Employee Hiring Flow Designer of NexAI. Designs the onboarding flow where customers pick their AI agents, configure specialties, and set task preferences. Creates the UX that makes hiring an AI employee feel real and valuable.",
      "Pipeline: " + status.pipeline.length + " items, Revenue: $" + (status.financials?.revenue || 0) + ". What should you do? JSON: {action, details}",
      { temperature: 0.6 }
    );
    try {
      const m = response.match(/\{[\s\S]*\}/);
      if (m) action.result = JSON.parse(m[0]);
    } catch {}
    await logAction("AI Employee Hiring Flow Designer", "cycle_complete", action);
    await updateAgentStatus("agent_hire", "active", 1);
    return { agent: "AI Employee Hiring Flow Designer", action: "agent_hire_cycle", ...action };
  } catch (err) {
    await updateAgentStatus("agent_hire", "error", 0);
    return { agent: "AI Employee Hiring Flow Designer", action: "error", error: err.message };
  }
}