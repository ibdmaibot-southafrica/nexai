import { chat } from "../lib/llm.js";
import { logAction, updateAgentStatus } from "../lib/db.js";

export async function runFinanceCycle() {
  await updateAgentStatus("finance", "running", 0);
  try {
    await chat("You are CFO of NexAI.", "Review finances.", { temperature: 0.3 });
    await logAction("Finance", "review_complete", null);
    await updateAgentStatus("finance", "active", 1);
    return { agent: "Finance", action: "finance_cycle" };
  } catch (err) {
    await logAction("Finance", "error", err.message);
    return { agent: "Finance", action: "error", error: err.message };
  }
}
