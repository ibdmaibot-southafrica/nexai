import { chat } from "../lib/llm.js";
import { logAction, updateAgentStatus, addPipelineItem } from "../lib/db.js";

export async function runMarketingCycle() {
  await updateAgentStatus("marketing", "running", 0);
  try {
    const response = await chat(
      "You are Head of Marketing at NexAI. Suggest ONE AI product for solo founders.",
      "Date: 2026-06-27. Find a profitable AI product.",
      { temperature: 0.9 }
    );
    await logAction("Marketing", "research_complete", response.substring(0, 200));
    await updateAgentStatus("marketing", "active", 1);
    return { agent: "Marketing", action: "research_cycle", product: null };
  } catch (err) {
    await logAction("Marketing", "error", err.message);
    await updateAgentStatus("marketing", "error", 0);
    return { agent: "Marketing", action: "error", error: err.message };
  }
}
