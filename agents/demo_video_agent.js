import { chat } from "../lib/llm.js";
import { logAction, updateAgentStatus, getStatus } from "../lib/db.js";

export async function runDemo_video_agentCycle() {
  await updateAgentStatus("demo_video_agent", "running", 0);
  try {
    const status = await getStatus();
    const action = {};
    const response = await chat(
      "You are the Demo Video Machine of NexAI. Creates personalized 2-minute Loom-style demo videos for each prospect showing exactly how the AI Reporting Dashboard would work with their agency's branding and data sources",
      "Pipeline: " + status.pipeline.length + " items, Revenue: $" + (status.financials?.revenue || 0) + ". What should you do? JSON: {action, details}",
      { temperature: 0.6 }
    );
    try {
      const m = response.match(/\{[\s\S]*\}/);
      if (m) action.result = JSON.parse(m[0]);
    } catch {}
    await logAction("Demo Video Machine", "cycle_complete", action);
    await updateAgentStatus("demo_video_agent", "active", 1);
    return { agent: "Demo Video Machine", action: "demo_video_agent_cycle", ...action };
  } catch (err) {
    await updateAgentStatus("demo_video_agent", "error", 0);
    return { agent: "Demo Video Machine", action: "error", error: err.message };
  }
}