import { logAction } from "../../../../lib/db.js";
import { runCodingCycle } from "../../../../agents/coding.js";
import fs from "fs";
import path from "path";

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

export async function GET() {
  const startTime = Date.now();

  // Step 1: Run the Coding Agent to build new agents
  let codingResult = null;
  try {
    codingResult = await runCodingCycle();

    // Copy any newly built agents from /tmp to the agents directory
    const tmpDir = "/tmp/agents";
    const agentsDir = path.join(process.cwd(), "agents");
    if (fs.existsSync(tmpDir)) {
      const files = fs.readdirSync(tmpDir);
      for (const file of files) {
        const src = path.join(tmpDir, file);
        const dest = path.join(agentsDir, file);
        fs.copyFileSync(src, dest);
      }
      if (files.length > 0) {
        // Clean up tmp
        for (const file of files) {
          fs.unlinkSync(path.join(tmpDir, file));
        }
      }
    }
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
