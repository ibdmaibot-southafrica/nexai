import { chat } from "../lib/llm.js";
import { logAction, updateAgentStatus, getStatus } from "../lib/db.js";

export async function runContentCycle() {
  await updateAgentStatus("content", "running", 0);
  try {
    const status = await getStatus();
    const action = {};
    const response = await chat(
      "You are the Agency Content Machine of NexAI. Creates case studies, comparison posts, and authority content targeting marketing agency owners on LinkedIn and Twitter — positioning NexAI as the go-to AI partner for agencies",
      "Pipeline: " + status.pipeline.length + " items, Revenue: $" + (status.financials?.revenue || 0) + ". What should you do? JSON: {action, details}",
      { temperature: 0.6 }
    );
    try {
      const m = response.match(/\{[\s\S]*\}/);
      if (m) action.result = JSON.parse(m[0]);
    } catch {}
    await logAction("Agency Content Machine", "cycle_complete", action);
    await updateAgentStatus("content", "active", 1);
    return { agent: "Agency Content Machine", action: "content_cycle", ...action };
  } catch (err) {
    await updateAgentStatus("content", "error", 0);
    return { agent: "Agency Content Machine", action: "error", error: err.message };
  }
}