import { runCEOCycle } from "../../../../agents/ceo.js";
import { runMarketingCycle } from "../../../../agents/marketing.js";
import { runTechCycle } from "../../../../agents/tech.js";
import { runFinanceCycle } from "../../../../agents/finance.js";
import { runAnalyticsCycle } from "../../../../agents/analytics.js";
import { runSalesCycle } from "../../../../agents/sales.js";
import { runProductCycle } from "../../../../agents/product.js";
import { logAction, updateAgentStatus } from "../../../../lib/db.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const AGENT_MAP = {
  ceo: { name: "CEO", fn: runCEOCycle },
  marketing: { name: "Marketing", fn: runMarketingCycle },
  tech: { name: "Tech", fn: runTechCycle },
  product: { name: "Product", fn: runProductCycle },
  finance: { name: "Finance", fn: runFinanceCycle },
  analytics: { name: "Analytics", fn: runAnalyticsCycle },
  sales: { name: "Sales", fn: runSalesCycle },
};

export async function POST(request, { params }) {
  const agentName = params.agentName?.toLowerCase();
  if (!agentName || !AGENT_MAP[agentName]) return Response.json({ error: "Unknown agent" }, { status: 400 });
  const agent = AGENT_MAP[agentName];
  try {
    await updateAgentStatus(agentName, "running", 0);
    const result = await agent.fn();
    await updateAgentStatus(agentName, "active", 1);
    return Response.json({ success: true, agent: agent.name, result });
  } catch (error) {
    await updateAgentStatus(agentName, "error", 0);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return Response.json({ agents: Object.keys(AGENT_MAP) });
}
