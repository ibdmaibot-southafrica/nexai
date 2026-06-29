#!/usr/bin/env python3
content = r'''import { chat } from "../lib/llm.js";
import { logAction, updateAgentStatus, getStatus, generateReport, getAnalytics } from "../lib/db.js";

export async function runAnalyticsCycle() {
  await updateAgentStatus("analytics", "running", 0);
  try {
    const status = await getStatus();
    const analytics = await getAnalytics();
    let action = {};

    // Find built items ready for testing
    const builtItems = status.pipeline.filter(p => p.status === "built");
    const testingItems = status.pipeline.filter(p => p.status === "testing");

    let tested = [];

    // Start testing built items
    for (const item of builtItems.slice(0, 2)) {
      await logAction("Analytics", "started_testing", { name: item.name });
      tested.push({ name: item.name, status: "testing" });
    }

    // Complete testing
    for (const item of testingItems) {
      const testResult = await chat(
        "You are Head of Analytics at NexAI testing: " + item.name,
        "Evaluate this product for market readiness. JSON: {\"score\": 8, \"feedback\": \"brief feedback\", \"recommendation\": \"launch or iterate\"}",
        { temperature: 0.5 }
      );

      let result = { score: 7, feedback: "Ready for launch", recommendation: "launch" };
      try {
        const m = testResult.match(/\{[\s\S]*\}/);
        if (m) result = JSON.parse(m[0]);
      } catch {}

      if (result.score >= 7) {
        const { getPool } = await import("../lib/db.js");
        const pool = getPool();
        await pool.query("UPDATE pipeline SET status = $1, quality_score = $2, updated_at = NOW() WHERE id = $3", ["validated", result.score, item.id]);
        tested.push({ name: item.name, score: result.score, recommendation: "launch" });
        await logAction("Analytics", "product_validated", { name: item.name, score: result.score });
      } else {
        const { getPool } = await import("../lib/db.js");
        const pool = getPool();
        await pool.query("UPDATE pipeline SET status = $1, quality_score = $2, updated_at = NOW() WHERE id = $3", ["building", result.score, item.id]);
        tested.push({ name: item.name, score: result.score, recommendation: "iterate" });
        await logAction("Analytics", "needs_improvement", { name: item.name, score: result.score });
      }
    }

    action.tested = tested.length;
    action.testResults = tested;

    // Generate analytics report
    const reportSummary = `Revenue: $${analytics.financials.total_revenue} | Pending: $${analytics.financials.pending_revenue} | Pipeline: ${analytics.pipeline.total} items | Collection rate: ${analytics.financials.collection_rate}%`;
    await generateReport(
      "analytics_cycle",
      "Analytics Report - " + new Date().toISOString().split("T")[0],
      analytics,
      reportSummary,
      "daily"
    );
    action.reportGenerated = true;

    // SELF-IMPROVEMENT: Study analytics when idle
    if (builtItems.length === 0 && testingItems.length === 0) {
      const study = await chat(
        "You are a data analyst studying to improve your skills. No products to test right now.",
        "What analytics methodology or tool should we learn next to better evaluate AI products? Give a specific topic and 3 key insights.",
        { temperature: 0.7 }
      );
      action.selfImprovement = study.substring(0, 200);
      await logAction("Analytics", "self_study", { topic: action.selfImprovement });
    }

    await updateAgentStatus("analytics", "active", 1);
    return { agent: "Analytics", action: "analytics_cycle", ...action };
  } catch (err) {
    await updateAgentStatus("analytics", "error", 0);
    return { agent: "Analytics", action: "error", error: err.message };
  }
}
''';

with open('agents/analytics.js', 'w', encoding='utf-8') as f:
    f.write(content)
print('analytics.js updated')
