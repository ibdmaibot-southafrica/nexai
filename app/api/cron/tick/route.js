import { requireSecret } from "../../../../lib/auth.js";
import { runAutonomousCycle } from "../../../../lib/cycle.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Vercel daily cron + optional manual trigger. Same canonical cycle as the
// public heartbeat, but behind the opt-in CRON_SECRET gate (dormant unless set).
export async function GET(request) {
  const denied = requireSecret(request);
  if (denied) return denied;

  const result = await runAutonomousCycle();
  return Response.json(result);
}
