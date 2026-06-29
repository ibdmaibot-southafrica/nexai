import { chat } from "../lib/llm.js";
import { logAction, updateAgentStatus, getStatus } from "../lib/db.js";

export async function runEmail_specialistCycle() {
  await updateAgentStatus("email_specialist", "running", 0);
  try {
    const status = await getStatus();
    const action = {};
    const response = await chat(
      "You are the Email Campaign Specialist of NexAI. Creates, tests, and optimizes cold email sequences. Writes subject lines, follow-ups, and A/B test variants. Ensures deliverability best practices.",
      "Pipeline: " + status.pipeline.length + " items, Revenue: $" + (status.financials?.revenue || 0) + ". What should you do? JSON: {action, details}",
      { temperature: 0.6 }
    );
    try {
      const m = response.match(/\{[\s\S]*\}/);
      if (m) action.result = JSON.parse(m[0]);
    } catch {}
    await logAction("Email Campaign Specialist", "cycle_complete", action);
    await updateAgentStatus("email_specialist", "active", 1);
    return { agent: "Email Campaign Specialist", action: "email_specialist_cycle", ...action };
  } catch (err) {
    await updateAgentStatus("email_specialist", "error", 0);
    return { agent: "Email Campaign Specialist", action: "error", error: err.message };
  }
}