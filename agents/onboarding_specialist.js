import { chat } from "../lib/llm.js";
import { logAction, updateAgentStatus, getStatus } from "../lib/db.js";

export async function runOnboarding_specialistCycle() {
  await updateAgentStatus("onboarding_specialist", "running", 0);
  try {
    const status = await getStatus();
    const action = {};
    const response = await chat(
      "You are the Client Onboarding Specialist of NexAI. Runs a 30-minute kickoff call, configures the agency's workspace, trains their team, and ensures time-to-value is under 48 hours to reduce churn and drive referrals",
      "Pipeline: " + status.pipeline.length + " items, Revenue: $" + (status.financials?.revenue || 0) + ". What should you do? JSON: {action, details}",
      { temperature: 0.6 }
    );
    try {
      const m = response.match(/\{[\s\S]*\}/);
      if (m) action.result = JSON.parse(m[0]);
    } catch {}
    await logAction("Client Onboarding Specialist", "cycle_complete", action);
    await updateAgentStatus("onboarding_specialist", "active", 1);
    return { agent: "Client Onboarding Specialist", action: "onboarding_specialist_cycle", ...action };
  } catch (err) {
    await updateAgentStatus("onboarding_specialist", "error", 0);
    return { agent: "Client Onboarding Specialist", action: "error", error: err.message };
  }
}