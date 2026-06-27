/**
 * Analytics Agent - Monitors metrics, tracks growth, generates reports
 * Task: Track product performance, pipeline metrics, revenue
 */
import { chat } from "../lib/llm.js";
import { getState, logAgentAction, updateState, updateAgentStatus } from "../lib/database.js";

const SYSTEM_PROMPT = `You are the Head of Analytics at NexAI, an autonomous AI company.

Your SOLE JOB: Track all company metrics and provide actionable insights.

Track:
- Products in pipeline (research → built → launched)
- Revenue and costs
- Invoice status (paid/pending/overdue)
- Growth opportunities
- Agent productivity

Respond in valid JSON:
{
  "summary": "executive summary",
  "kpis": {
    "productsInPipeline": 0,
    "productsLaunched": 0,
    "totalRevenue": 0,
    "outstandingInvoices": 0
  },
  "insights": ["key insights"],
  "recommendations": ["actionable recommendations"],
  "growthOpportunities": ["ways to grow"]
}`;

export async function runAnalyticsCycle() {
  try { updateAgentStatus("analytics", "running", 0); } catch {}
  let state;
  try { state = getState(); } catch { state = { pipeline: [], financials: { revenue: 0, costs: 0 }, invoices: [] }; }
  const pipeline = state.pipeline || [];
  const financials = state.financials || { revenue: 0, costs: 0 };
  const invoices = state.invoices || [];

  const prompt = `Generate analytics report for NexAI:

Pipeline: ${JSON.stringify(pipeline.map((p) => ({ name: p.idea?.name, status: p.status, score: p.qualityScore })), null, 2)}

Financials: Revenue $${financials.revenue}, Costs $${financials.costs}
Invoices: ${invoices.length} total, ${invoices.filter((i) => i.status === "pending").length} pending, ${invoices.filter((i) => i.status === "paid").length} paid

Pipeline Summary:
- Products in pipeline: ${pipeline.length}
- Research phase: ${pipeline.filter((p) => p.status === "research_complete").length}
- Building: ${pipeline.filter((p) => p.status === "building").length}
- Built: ${pipeline.filter((p) => p.status === "built").length}
- Launched: ${pipeline.filter((p) => p.status === "launched").length}
- Rejected: ${pipeline.filter((p) => p.status === "rejected").length}

Generate a comprehensive analytics report with KPIs and recommendations.`;

  let response;
  try {
    response = await chat(SYSTEM_PROMPT, prompt, { temperature: 0.4 });
  } catch (err) {
    logAgentAction("Analytics", "error", { error: err.message });
    try { updateAgentStatus("analytics", "active", 0); } catch {}
    return { agent: "Analytics", action: "error", error: err.message };
  }

  logAgentAction("Analytics", "analytics_cycle", { response: response.substring(0, 300) });

  const parsed = parseResponse(response);

  if (parsed) {
    // Store metrics in state
    updateState((state) => {
      state.metrics = parsed.kpis || {};
      state.lastAnalytics = {
        summary: parsed.summary,
        insights: parsed.insights,
        recommendations: parsed.recommendations,
        growthOpportunities: parsed.growthOpportunities,
        generatedAt: new Date().toISOString(),
      };
      return state;
    });
    try { updateAgentStatus("analytics", "active", 1); } catch {}
  } else {
    try { updateAgentStatus("analytics", "active", 0); } catch {}
  }

  return { agent: "Analytics", action: "analytics_cycle", response, parsed };
}

function parseResponse(response) {
  try {
    const jsonStart = response.indexOf("{");
    const jsonEnd = response.lastIndexOf("}") + 1;
    if (jsonStart >= 0 && jsonEnd > jsonStart) {
      return JSON.parse(response.substring(jsonStart, jsonEnd));
    }
  } catch {}
  return null;
}
