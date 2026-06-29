const fs = require('fs');
const content = `import { chat } from "../lib/llm.js";
import { logAction, updateAgentStatus, getStatus, updatePipelineItem } from "../lib/db.js";

export async function runTechCycle() {
  await updateAgentStatus("tech", "running", 0);
  try {
    const status = await getStatus();
    
    // Find pipeline items that need advancing
    const researchItems = status.pipeline.filter(p => p.status === "research_complete");
    const buildingItems = status.pipeline.filter(p => p.status === "building");
    
    let advanced = null;
    
    // Advance research items to building
    if (researchItems.length > 0) {
      const item = researchItems[0];
      await updatePipelineItem(item.id, { status: "building" });
      advanced = { id: item.id, name: item.name, from: "research_complete", to: "building" };
      await logAction("Tech", "started_building", { itemId: item.id, name: item.name });
    }
    // Advance building items to built
    else if (buildingItems.length > 0) {
      const item = buildingItems[0];
      await updatePipelineItem(item.id, { status: "built" });
      advanced = { id: item.id, name: item.name, from: "building", to: "built" };
      await logAction("Tech", "build_complete", { itemId: item.id, name: item.name });
    }
    // If nothing to build, ask LLM for tech decisions
    else {
      const response = await chat(
        "You are Lead Developer at NexAI. All pipeline items are either launched or none exist.",
        "What technical infrastructure should NexAI invest in next?",
        { temperature: 0.7 }
      );
      await logAction("Tech", "tech_review", response.substring(0, 200));
    }

    await updateAgentStatus("tech", "active", 1);
    return { agent: "Tech", action: "build_cycle", advanced };
  } catch (err) {
    await logAction("Tech", "error", err.message);
    await updateAgentStatus("tech", "error", 0);
    return { agent: "Tech", action: "error", error: err.message };
  }
}
`;
fs.writeFileSync('agents/tech.js', content, 'utf8');
console.log('tech.js updated');
