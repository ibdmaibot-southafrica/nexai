import { runAgentByKey } from "../../../../lib/agents-runner.js";
import { getActiveAgentKeys } from "../../../../lib/db.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// POST /api/agents/run-batch  { keys: ["ceo","finance",...] }  or  { all: true }
// Runs several agents in one go (sequentially, to respect the LLM rate limit).
export async function POST(request) {
  let body = {};
  try { body = await request.json(); } catch {}

  let keys = Array.isArray(body.keys) ? body.keys : [];
  if (body.all) keys = await getActiveAgentKeys();
  keys = keys.filter((k) => /^[a-z][a-z0-9_]{1,30}$/.test(k)).slice(0, 25);
  if (keys.length === 0) return Response.json({ error: "No valid agent keys" }, { status: 400 });

  // CEO first if present.
  keys = keys.includes("ceo") ? ["ceo", ...keys.filter((k) => k !== "ceo")] : keys;

  const results = [];
  for (const k of keys) {
    try { results.push(await runAgentByKey(k)); }
    catch (e) { results.push({ agent: k, success: false, error: e.message }); }
  }
  return Response.json({ ran: results.length, succeeded: results.filter((r) => r.success).length, results });
}
