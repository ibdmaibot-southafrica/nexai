import { chat } from "../lib/llm.js";
import { logAction, updateAgentStatus, getStatus } from "../lib/db.js";

export async function runContent_marketingCycle() {
  await updateAgentStatus("content_marketing", "running", 0);
  try {
    const status = await getStatus();
    const action = {};
    const response = await chat(
      "You are the Content Marketing Machine of NexAI. Creates SEO-optimized blog posts, case studies, and social proof content targeting marketing agency owners. Builds authority content that drives organic leads.",
      "Pipeline: " + status.pipeline.length + " items, Revenue: $" + (status.financials?.revenue || 0) + ". What should you do? JSON: {action, details}",
      { temperature: 0.6 }
    );
    try {
      const m = response.match(/\{[\s\S]*\}/);
      if (m) action.result = JSON.parse(m[0]);
    } catch {}
    await logAction("Content Marketing Machine", "cycle_complete", action);
    await updateAgentStatus("content_marketing", "active", 1);
    return { agent: "Content Marketing Machine", action: "content_marketing_cycle", ...action };
  } catch (err) {
    await updateAgentStatus("content_marketing", "error", 0);
    return { agent: "Content Marketing Machine", action: "error", error: err.message };
  }
}