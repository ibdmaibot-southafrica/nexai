import { chat } from "../lib/llm.js";
import { logAction, updateAgentStatus } from "../lib/db.js";

export async function runCEOCycle() {
  await updateAgentStatus("ceo", "running", 0);
  try {
    await chat("You are CEO of NexAI.", "Review the pipeline and set strategy.", { temperature: 0.4 });
    await logAction("CEO", "review_complete", null);
    await updateAgentStatus("ceo", "active", 1);
    return { agent: "CEO", action: "review_cycle" };
  } catch (err) {
    await logAction("CEO", "error", err.message);
    return { agent: "CEO", action: "error", error: err.message };
  }
}
