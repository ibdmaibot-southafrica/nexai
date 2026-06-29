import { runMarketingCycle } from "../../../../agents/marketing.js";
import { runAnalyticsCycle } from "../../../../agents/analytics.js";
import { runFinanceCycle } from "../../../../agents/finance.js";
import { runCEOCycle } from "../../../../agents/ceo.js";
import { runTechCycle } from "../../../../agents/tech.js";
import { runSalesCycle } from "../../../../agents/sales.js";
import { runProductCycle } from "../../../../agents/product.js";
import { logAction, updateAgentStatus, getState } from "../../../../lib/db.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET() { return await runAllAgents(); }
export async function POST() { return await runAllAgents(); }

async function runAllAgents() {
  const results = [];
  const startTime = Date.now();

  try {
    console.log("[Cron] Starting daily agent cycle...");

    // Run each agent independently - one failure shouldn't stop others
    const agentTasks = [
      { name: "CEO", key: "ceo", fn: runCEOCycle },
      { name: "Marketing", key: "marketing", fn: runMarketingCycle },
      { name: "Tech", key: "tech", fn: runTechCycle },
      { name: "Analytics", key: "analytics", fn: runAnalyticsCycle },
      { name: "Product", key: "product", fn: runProductCycle },
      { name: "Sales", key: "sales", fn: runSalesCycle },
      { name: "Finance", key: "finance", fn: runFinanceCycle },
    ];

    for (const task of agentTasks) {
      try {
        await updateAgentStatus(task.key, "running", 0);
        const result = await task.fn();
        results.push(result);
        await updateAgentStatus(task.key, "active", 1);
        await logAction("System", `cron_${task.key}_done`, {
          agent: task.name,
          action: result.action,
          product: result.product || null,
        });
      } catch (agentError) {
        console.error(`[Cron] ${task.name} agent failed: ${agentError.message}`);
        results.push({ agent: task.name, action: "error", error: agentError.message });
        await logAction("System", `cron_${task.key}_failed`, { agent: task.name, error: agentError.message });
        await updateAgentStatus(task.key, "error", 0);
      }
    }

    const duration = Date.now() - startTime;
    await logAction("System", "cron_cycle_complete", { duration, agentsRun: results.length });

    return Response.json({
      success: true,
      message: "Daily agent cycle complete",
      duration: `${duration}ms`,
      agentsRun: results.length,
      results: results.map((r) => ({
        agent: r.agent,
        action: r.action,
        success: r.action !== "error",
        product: r.product || null,
      })),
    });
  } catch (error) {
    await logAction("System", "cron_cycle_error", { error: error.message });
    return Response.json(
      { success: false, error: error.message, partialResults: results },
      { status: 500 }
    );
  }
}
