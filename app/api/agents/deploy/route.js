import { getPool } from "../../../../lib/db.js";
import { requireSecret } from "../../../../lib/auth.js";
import { advanceDeploy } from "../../../../lib/deploy.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

// POST /api/agents/deploy — manual trigger: advance the build-gate one step.
// (The autonomous cycle calls advanceDeploy() on every heartbeat; this is for
// kicking it by hand. The full push -> build -> merge flow now lives in
// lib/deploy.js so generated code only reaches master if its preview build passes.)
export async function POST(request) {
  const denied = requireSecret(request);
  if (denied) return denied;
  try {
    const result = await advanceDeploy();
    return Response.json({ success: true, ...result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// GET /api/agents/deploy — inspector: pending code + in-flight deployment.
export async function GET(request) {
  const denied = requireSecret(request);
  if (denied) return denied;
  try {
    const pool = getPool();
    const { rows: items } = await pool.query(
      "SELECT id, agent_key, file_path, status, created_at FROM agent_code ORDER BY created_at DESC LIMIT 20"
    );
    const { rows: counts } = await pool.query(
      "SELECT status, COUNT(*)::int AS n FROM agent_code GROUP BY status"
    );
    const { rows: deployments } = await pool.query(
      "SELECT id, branch, head_sha, status, detail, created_at, updated_at FROM deployments ORDER BY id DESC LIMIT 5"
    );
    return Response.json({ success: true, counts, items, deployments });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
