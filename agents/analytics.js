import { chat } from "../lib/llm.js";
import { logAction, updateAgentStatus } from "../lib/db.js";

export async function runAnalyticsCycle() {
  await updateAgentStatus("analytics", "running", 0);
  try {
    await chat("You are Head of Analytics at NexAI.", "Generate report.", { temperature: 0.4 });
    await logAction("Analytics", "report_complete", null);
    await updateAgentStatus("analytics", "active", 1);
    return { agent: "Analytics", action: "analytics_cycle" };
  } catch (err) {
    await logAction("Analytics", "error", err.message);
    return { agent: "Analytics", action: "error", error: err.message };
  }
}
