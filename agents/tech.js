import { chat } from "../lib/llm.js";
import { logAction, updateAgentStatus } from "../lib/db.js";

export async function runTechCycle() {
  await updateAgentStatus("tech", "running", 0);
  try {
    await chat("You are Lead Developer at NexAI.", "Build the product.", { temperature: 0.7 });
    await logAction("Tech", "build_complete", null);
    await updateAgentStatus("tech", "active", 1);
    return { agent: "Tech", action: "build_cycle" };
  } catch (err) {
    await logAction("Tech", "error", err.message);
    return { agent: "Tech", action: "error", error: err.message };
  }
}
