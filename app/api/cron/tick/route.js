import { logAction } from "../../../../lib/db.js";
import { runCodingCycle } from "../../../../agents/coding.js";
import { requireSecret } from "../../../../lib/auth.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CORE_AGENTS = [
  { key: "ceo", fn: "runCEOCycle", file: "ceo.js" },
  { key: "marketing", fn: "runMarketingCycle", file: "marketing.js" },
  { key: "tech", fn: "runTechCycle", file: "tech.js" },
  { key: "product", fn: "runProductCycle", file: "product.js" },
  { key: "sales", fn: "runSalesCycle", file: "sales.js" },
  { key: "finance", fn: "runFinanceCycle", file: "finance.js" },
  { key: "analytics", fn: "runAnalyticsCycle", file: "analytics.js" },
];

export async function GET(request) {
  const denied = requireSecret(request);
  if (denied) return denied;

  const startTime = Date.now();

  // Step 1: Run the Coding Agent to generate code for any new agents.
  // Generated code is persisted to the agent_code table and shipped to the repo
  // via POST /api/agents/deploy (GitHub API) -> Vercel auto-deploy. We do NOT
  // write to the local filesystem here: Vercel's runtime FS is read-only outside
  // /tmp and any copy would not persist across invocations.
  let codingResult = null;
  try {
    codingResult = await runCodingCycle();
  } catch (err) {
    codingResult = { agent: "Coding", error: err.message };
  }

  // Step 2: Run all core agents in parallel
  const results = await Promise.allSettled(
    CORE_AGENTS.map(async (agent) => {
      try {
        const mod = await import(`../../../../agents/${agent.file}`);
        const result = await mod[agent.fn]();
        return { agent: agent.key, success: true, action: result?.action };
      } catch (err) {
        return { agent: agent.key, success: false, error: err.message };
      }
    })
  );

  const output = results.map((r) =>
    r.status === "fulfilled" ? r.value : { agent: "unknown", success: false, error: r.reason?.message }
  );
  const successCount = output.filter((o) => o.success).length;
  const duration = Date.now() - startTime;

  await logAction("System", "autonomous_cycle", {
    agentsRun: CORE_AGENTS.length,
    success: successCount,
    codingBuilt: codingResult?.built || 0,
    duration,
  });

  return Response.json({
    success: true,
    agentsRun: CORE_AGENTS.length,
    successCount,
    duration: `${duration}ms`,
    codingAgent: codingResult,
    results: output,
    timestamp: new Date().toISOString(),
  });
}
