import os

content = '''import { chat } from "../lib/llm.js";
import { logAction, updateAgentStatus, getStatus, updatePipelineItem } from "../lib/db.js";

export async function runTechCycle() {
  await updateAgentStatus("tech", "running", 0);
  try {
    const status = await getStatus();
    const researchItems = status.pipeline.filter(p => p.status === "research_complete");
    const buildingItems = status.pipeline.filter(p => p.status === "building");
    const advanced = [];
    for (const item of researchItems) {
      await updatePipelineItem(item.id, { status: "building" });
      advanced.push({ id: item.id, name: item.name, to: "building" });
    }
    for (const item of buildingItems) {
      await updatePipelineItem(item.id, { status: "built" });
      advanced.push({ id: item.id, name: item.name, to: "built" });
    }
    if (advanced.length > 0) await logAction("Tech", "advanced_items", { count: advanced.length });
    await updateAgentStatus("tech", "active", 1);
    return { agent: "Tech", action: "build_cycle", count: advanced.length };
  } catch (err) {
    await updateAgentStatus("tech", "error", 0);
    return { agent: "Tech", action: "error", error: err.message };
  }
}
'''

with open('agents/tech.js', 'w', encoding='utf-8') as f:
    f.write(content)
print('tech.js updated')
