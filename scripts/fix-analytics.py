content = '''import { chat } from "../lib/llm.js";
import { logAction, updateAgentStatus, getStatus, updatePipelineItem } from "../lib/db.js";

export async function runAnalyticsCycle() {
  await updateAgentStatus("analytics", "running", 0);
  try {
    const status = await getStatus();
    const builtItems = status.pipeline.filter(p => p.status === "built");
    const launched = [];
    for (const item of builtItems) {
      await updatePipelineItem(item.id, { status: "launched" });
      launched.push({ id: item.id, name: item.name });
    }
    if (launched.length > 0) {
      await logAction("Analytics", "launched_products", { count: launched.length });
    } else {
      const response = await chat(
        "You are Head of Analytics at NexAI.",
        `Current state: ${status.pipeline.length} pipeline items, ${status.invoices.total} invoices, $${status.financials.revenue} revenue. What insights can you provide?`,
        { temperature: 0.5 }
      );
      await logAction("Analytics", "insights", response.substring(0, 200));
    }
    await updateAgentStatus("analytics", "active", 1);
    return { agent: "Analytics", action: "analytics_cycle", launched, count: launched.length };
  } catch (err) {
    await updateAgentStatus("analytics", "error", 0);
    return { agent: "Analytics", action: "error", error: err.message };
  }
}
'''

with open('agents/analytics.js', 'w', encoding='utf-8') as f:
    f.write(content)
print('analytics.js updated')
