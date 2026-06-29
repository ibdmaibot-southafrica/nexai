const fs = require('fs');
const content = `import { chat } from "../lib/llm.js";
import { logAction, updateAgentStatus, getStatus, updatePipelineItem } from "../lib/db.js";

export async function runAnalyticsCycle() {
  await updateAgentStatus("analytics", "running", 0);
  try {
    const status = await getStatus();
    
    // Find built items ready to launch
    const builtItems = status.pipeline.filter(p => p.status === "built");
    
    let launched = null;
    
    if (builtItems.length > 0) {
      const item = builtItems[0];
      await updatePipelineItem(item.id, { status: "launched" });
      launched = { id: item.id, name: item.name };
      await logAction("Analytics", "product_launched", { itemId: item.id, name: item.name });
    } else {
      // Analyze current performance
      const response = await chat(
        "You are Head of Analytics at NexAI.",
        \`Current state: \${status.pipeline.length} pipeline items, \${status.invoices.total} invoices, $\${status.financials.revenue} revenue. What insights can you provide?\`,
        { temperature: 0.5 }
      );
      await logAction("Analytics", "insights", response.substring(0, 200));
    }

    await updateAgentStatus("analytics", "active", 1);
    return { agent: "Analytics", action: "analytics_cycle", launched };
  } catch (err) {
    await logAction("Analytics", "error", err.message);
    await updateAgentStatus("analytics", "error", 0);
    return { agent: "Analytics", action: "error", error: err.message };
  }
}
`;
fs.writeFileSync('agents/analytics.js', content, 'utf8');
console.log('analytics.js updated');
