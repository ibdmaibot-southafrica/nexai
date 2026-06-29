import { runAgentByKey } from "../../../../lib/agents-runner.js";
import { getActiveAgentKeys } from "../../../../lib/db.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// POST /api/agent/<key> — run a single agent on demand (any agent, not a fixed list).
export async function POST(request, { params }) {
  const key = (params.agentName || "").toLowerCase();
  if (!/^[a-z][a-z0-9_]{1,30}$/.test(key)) {
    return Response.json({ error: "Invalid agent key" }, { status: 400 });
  }
  try {
    const result = await runAgentByKey(key);
    return Response.json({ success: result.success !== false, ...result });
  } catch (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return Response.json({ agents: await getActiveAgentKeys() });
}
