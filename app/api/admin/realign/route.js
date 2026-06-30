import { getPool } from "../../../../lib/db.js";
import { requireSecret } from "../../../../lib/auth.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lean, on-mission roster for an AI-sells-to-AI company on a free LLM.
const KEEP = ["ceo", "coding", "product", "viability", "prospector", "analytics", "finance"];

// NexAI sells digital IP only. The catalog is filled by the product agent, which
// produces complete, deliverable IP assets in-cycle — we no longer seed
// SaaS-style per-call API services here (that contradicts the IP-only model).

export async function POST(request) {
  const denied = requireSecret(request);
  if (denied) return denied;
  const pool = getPool();
  let body = {};
  try { body = await request.json(); } catch {}
  const keep = Array.isArray(body.keep) && body.keep.length ? body.keep : KEEP;
  // Default behaviour: just delete the disabled zombie agents, leaving the CEO's
  // active roster intact. Pass { hard: true } to also fire everything not in `keep`.
  const hard = body.hard === true;

  try {
    let removed;
    if (hard) {
      removed = await pool.query("DELETE FROM agents WHERE key <> ALL($1::text[]) RETURNING key", [keep]);
      try { await pool.query("DELETE FROM agent_code WHERE agent_key <> ALL($1::text[])", [keep]); } catch {}
      await pool.query("UPDATE agents SET status = 'active' WHERE key = ANY($1::text[])", [keep]);
    } else {
      // Purge benched zombies only (status disabled).
      removed = await pool.query("DELETE FROM agents WHERE status = 'disabled' RETURNING key", []);
      const keys = removed.rows.map((r) => r.key);
      if (keys.length) { try { await pool.query("DELETE FROM agent_code WHERE agent_key = ANY($1::text[])", [keys]); } catch {} }
    }
    const firedKeys = removed.rows.map((r) => r.key);

    return Response.json({
      success: true,
      kept: keep,
      agentsFired: firedKeys.length,
      firedKeys,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
