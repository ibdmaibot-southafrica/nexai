import { runAutonomousCycle } from "../../../../lib/cycle.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Public heartbeat (cron-job.org hits this every ~5 min). Delegates to the single
// canonical autonomous cycle: kill-switch -> build-gate -> codegen -> run agents.
export async function GET() {
  const result = await runAutonomousCycle();
  return Response.json(result);
}

export async function POST() {
  const result = await runAutonomousCycle();
  return Response.json(result);
}
