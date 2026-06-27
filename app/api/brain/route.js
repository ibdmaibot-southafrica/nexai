import { chat } from "../../../lib/llm.js";
import { getState, getLogs } from "../../../lib/database.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const { message } = await request.json();

    if (!message || !message.trim()) {
      return Response.json({ error: "Message is required" }, { status: 400 });
    }

    const state = getState();
    const logs = getLogs(10);

    // Build context from real state
    const pipeline = state.pipeline || [];
    const invoices = state.invoices || [];
    const agents = state.agents || {};
    const financials = state.financials || { revenue: 0, costs: 0 };

    const systemPrompt = `You are the NexAI Brain — the central intelligence for NexAI, an autonomous AI company run by 5 AI agents.

Current Company State:
- Strategy: ${state.strategy || "Build and launch AI products"}
- Revenue: $${financials.revenue || 0}
- Costs: $${financials.costs || 0}
- Growth: ${financials.growth || "+0%"}

Pipeline (${pipeline.length} items):
${pipeline.map((p) => `- ${p.idea?.name || p.name}: ${p.status} (quality: ${p.qualityScore || "N/A"})`).join("\n") || "Empty"}

Invoices (${invoices.length}):
${invoices.map((i) => `- ${i.id}: ${i.customer} - $${i.amount} (${i.status})`).join("\n") || "None"}

Agents:
${Object.values(agents).map((a) => `- ${a.name}: ${a.status}, ${a.tasksCompleted || 0} tasks completed`).join("\n") || "5 agents active"}

Recent Activity:
${logs.slice(0, 5).map((l) => `- [${l.agent}] ${l.action}`).join("\n") || "No recent activity"}

You can help the user understand the company status, direct agents, or answer questions about the business. Be concise and data-driven. Use real numbers from the state above.`;

    const response = await chat(systemPrompt, message, { temperature: 0.7, maxTokens: 1024 });

    return Response.json({ response });
  } catch (error) {
    console.error("[Brain] Error:", error.message);
    return Response.json(
      { error: "Failed to process message", details: error.message },
      { status: 500 }
    );
  }
}
