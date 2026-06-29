import { chat } from "../lib/llm.js";
import { logAction, updateAgentStatus, getStatus } from "../lib/db.js";

export async function runCase_study_agentCycle() {
  await updateAgentStatus("case_study_agent", "running", 0);
  try {
    const status = await getStatus();
    const action = {};
    const response = await chat(
      "You are the Case Study & Testimonial Agent of NexAI. Interviews happy agency clients, writes ROI-focused case studies, and produces video testimonial scripts to feed the sales funnel with social proof",
      "Pipeline: " + status.pipeline.length + " items, Revenue: $" + (status.financials?.revenue || 0) + ". What should you do? JSON: {action, details}",
      { temperature: 0.6 }
    );
    try {
      const m = response.match(/\{[\s\S]*\}/);
      if (m) action.result = JSON.parse(m[0]);
    } catch {}
    await logAction("Case Study & Testimonial Agent", "cycle_complete", action);
    await updateAgentStatus("case_study_agent", "active", 1);
    return { agent: "Case Study & Testimonial Agent", action: "case_study_agent_cycle", ...action };
  } catch (err) {
    await updateAgentStatus("case_study_agent", "error", 0);
    return { agent: "Case Study & Testimonial Agent", action: "error", error: err.message };
  }
}