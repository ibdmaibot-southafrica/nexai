import { runCEOCycle } from "../../../../agents/ceo.js";
import { runMarketingCycle } from "../../../../agents/marketing.js";
import { runTechCycle } from "../../../../agents/tech.js";
import { runFinanceCycle } from "../../../../agents/finance.js";
import { runAnalyticsCycle } from "../../../../agents/analytics.js";
import { logAgentAction, updateAgentStatus } from "../../../../lib/database.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const AGENT_MAP = {
  ceo: { name: "CEO", fn: runCEOCycle },
  marketing: { name: "Marketing", fn: runMarketingCycle },
  tech: { name: "Tech", fn: runTechCycle },
  finance: { name: "Finance", fn: runFinanceCycle },
  analytics: { name: "Analytics", fn: runAnalyticsCycle },
};

export async function POST(request, { params }) {
  const agentName = params.agentName?.toLowerCase();

  if (!agentName || !AGENT_MAP[agentName]) {
    return Response.json(
      { error: `Unknown agent: ${agentName}. Valid agents: ${Object.keys(AGENT_MAP).join(", ")}` },
      { status: 400 }
    );
  }

  const agent = AGENT_MAP[agentName];
  const startTime = Date.now();

  try {
    try { updateAgentStatus(agentName, "running", 0); } catch {}
    logAgentAction(agentName, "manual_run_start", { triggeredBy: "user" });

    const result = await agent.fn();
    const duration = Date.now() - startTime;

    // Increment task count on success
    try {
      const currentTasks = (getState().agents?.[agentName]?.tasksCompleted || 0) + 1;
      updateAgentStatus(agentName, "active", currentTasks);
    } catch {}

    logAgentAction(agentName, "manual_run_complete", {
      duration,
      action: result.action,
      product: result.product || null,
    });

    return Response.json({
      success: true,
      agent: agent.name,
      duration: `${duration}ms`,
      result: {
        agent: result.agent,
        action: result.action,
        product: result.product || null,
        parsed: result.parsed || null,
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    try { updateAgentStatus(agentName, "error", 0); } catch {}
    logAgentAction(agentName, "manual_run_error", { error: error.message, duration });

    return Response.json(
      {
        success: false,
        agent: agent.name,
        duration: `${duration}ms`,
        error: error.message,
      },
      { status: 500 }
    );
  }
}

export async function GET(request, { params }) {
  // GET returns agent status info
  const agentName = params.agentName?.toLowerCase();
  if (!agentName || !AGENT_MAP[agentName]) {
    return Response.json(
      { error: `Unknown agent: ${agentName}. Valid agents: ${Object.keys(AGENT_MAP).join(", ")}` },
      { status: 400 }
    );
  }

  const { getState, getAgentLogs } = await import("../../../../lib/state.js");
  const state = getState();
  const agentState = state.agents?.[agentName] || {};
  const agentLogs = getAgentLogs(100).filter((l) => l.agent?.toLowerCase() === agentName);

  return Response.json({
    key: agentName,
    name: AGENT_MAP[agentName].name,
    status: agentState.status || "active",
    lastRun: agentState.lastRun || null,
    tasksCompleted: agentState.tasksCompleted || 0,
    recentLogs: agentLogs.slice(0, 10),
  });
}
