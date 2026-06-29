import { chat } from "../lib/llm.js";
import { logAction, updateAgentStatus, getStatus } from "../lib/db.js";

export async function runReferralCycle() {
  await updateAgentStatus("referral", "running", 0);
  try {
    const status = await getStatus();
    const action = {};
    const response = await chat(
      "You are the Agency Referral Engine of NexAI. Runs an affiliate/referral program where existing agency customers earn 30% commission for referring other agencies, with automated tracking and PayPal payouts",
      "Pipeline: " + status.pipeline.length + " items, Revenue: $" + (status.financials?.revenue || 0) + ". What should you do? JSON: {action, details}",
      { temperature: 0.6 }
    );
    try {
      const m = response.match(/\{[\s\S]*\}/);
      if (m) action.result = JSON.parse(m[0]);
    } catch {}
    await logAction("Agency Referral Engine", "cycle_complete", action);
    await updateAgentStatus("referral", "active", 1);
    return { agent: "Agency Referral Engine", action: "referral_cycle", ...action };
  } catch (err) {
    await updateAgentStatus("referral", "error", 0);
    return { agent: "Agency Referral Engine", action: "error", error: err.message };
  }
}