import { chat } from "../lib/llm.js";
import { logAction, updateAgentStatus, getStatus } from "../lib/db.js";

export async function runOnboardingCycle() {
  await updateAgentStatus("onboarding", "running", 0);
  try {
    const status = await getStatus();
    const action = {};
    const response = await chat(
      "You are the Agency Onboarding Specialist of NexAI. Handles new agency customer setup, white-label configuration, and first-week success. Converts trial users to paid.",
      "Pipeline: " + status.pipeline.length + " items, Revenue: $" + (status.financials?.revenue || 0) + ". What should you do? JSON: {action, details}",
      { temperature: 0.6 }
    );
    try {
      const m = response.match(/\{[\s\S]*\}/);
      if (m) action.result = JSON.parse(m[0]);
    } catch {}
    await logAction("Agency Onboarding Specialist", "cycle_complete", action);
    await updateAgentStatus("onboarding", "active", 1);
    return { agent: "Agency Onboarding Specialist", action: "onboarding_cycle", ...action };
  } catch (err) {
    await updateAgentStatus("onboarding", "error", 0);
    return { agent: "Agency Onboarding Specialist", action: "error", error: err.message };
  }
}