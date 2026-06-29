import { chat } from "../lib/llm.js";
import { logAction, updateAgentStatus, getStatus, updatePipelineItem } from "../lib/db.js";

export async function runTechCycle() {
  await updateAgentStatus("tech", "running", 0);
  try {
    const status = await getStatus();
    const ideationItems = status.pipeline.filter(p => p.status === "ideation");
    const buildingItems = status.pipeline.filter(p => p.status === "building");
    
    let action = {};
    
    // WORK: Move ideation items to building
    for (const item of ideationItems.slice(0, 2)) {
      await updatePipelineItem(item.id, { status: "building" });
      action.built = (action.built || 0) + 1;
      await logAction("Tech", "started_building", { name: item.name });
    }
    
    // WORK: Complete building items
    for (const item of buildingItems) {
      const devNotes = await chat(
        "You are Lead Developer at NexAI building: " + item.name,
        "Describe the key technical features and architecture for this product in 2-3 sentences.",
        { temperature: 0.7 }
      );
      await updatePipelineItem(item.id, { status: "built", description: (item.description || "") + " | Tech: " + devNotes.substring(0,200) });
      action.completed = (action.completed || 0) + 1;
      await logAction("Tech", "build_complete", { name: item.name });
    }
    
    // SELF-IMPROVEMENT: If nothing to build, study new tech
    if (ideationItems.length === 0 && buildingItems.length === 0) {
      const study = await chat(
        "You are a senior developer studying to improve your skills. No tasks are waiting.",
        "What is the most valuable programming skill, framework, or technology you should learn next to build better AI products? Give a specific topic and 3 key insights.",
        { temperature: 0.7 }
      );
      action.selfImprovement = study.substring(0, 200);
      await logAction("Tech", "self_study", { topic: action.selfImprovement });
    }
    
    await updateAgentStatus("tech", "active", 1);
    return { agent: "Tech", action: "build_cycle", ...action };
  } catch (err) {
    await updateAgentStatus("tech", "error", 0);
    return { agent: "Tech", action: "error", error: err.message };
  }
}
