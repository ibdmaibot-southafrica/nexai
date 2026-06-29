import { chat } from "../lib/llm.js";
import { logAction, updateAgentStatus, getStatus } from "../lib/db.js";

export async function runAgency_outreachCycle() {
  await updateAgentStatus("agency_outreach", "running", 0);
  try {
    const status = await getStatus();
    const action = {};
    const response = await chat(
      "You are the Agency Hunter of NexAI. Specialized agent that identifies marketing agencies with 5-50 employees, finds decision-maker emails, and sends personalized cold outreach sequences focused on AgencyAI Pro",
      "Pipeline: " + status.pipeline.length + " items, Revenue: $" + (status.financials?.revenue || 0) + ". What should you do? JSON: {action, details}",
      { temperature: 0.6 }
    );
    try {
      const m = response.match(/\{[\s\S]*\}/);
      if (m) action.result = JSON.parse(m[0]);
    } catch {}
    await logAction("Agency Hunter", "cycle_complete", action);
    await updateAgentStatus("agency_outreach", "active", 1);
    return { agent: "Agency Hunter", action: "agency_outreach_cycle", ...action };
  } catch (err) {
    await updateAgentStatus("agency_outreach", "error", 0);
    return { agent: "Agency Hunter", action: "error", error: err.message };
  }
}