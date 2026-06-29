import { getPool } from "../../../../lib/db.js";
import { requireSecret } from "../../../../lib/auth.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/admin/clear-invoices — remove demo/non-real invoices.
// Keeps credit top-ups (invoices with an api_key — those are real funding) and
// recomputes revenue from actual orders, so nothing genuine is lost.
export async function POST(request) {
  const denied = requireSecret(request);
  if (denied) return denied;
  const pool = getPool();
  try {
    const del = await pool.query("DELETE FROM invoices WHERE api_key IS NULL RETURNING id");
    // Purge the seeded real-company "leads" (Anthropic, Coveo, etc.) — anything
    // not from the prospector's AI-venue discovery. They were the source of the
    // bogus company invoices; nothing should be billing real companies.
    let leadsDeleted = 0;
    try {
      const l = await pool.query("DELETE FROM leads WHERE source IS DISTINCT FROM 'ai_discovery' RETURNING id");
      leadsDeleted = l.rowCount;
    } catch {}
    // Recompute revenue from real sales (orders), not demo invoices.
    const { rows } = await pool.query("SELECT COALESCE(SUM(amount),0)::float AS r FROM orders");
    const realRevenue = Number(rows[0]?.r || 0);
    await pool.query("UPDATE financials SET revenue = $1 WHERE id = 1", [realRevenue]);
    return Response.json({ success: true, deletedInvoices: del.rowCount, leadsDeleted, revenueReset: realRevenue });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request) {
  const denied = requireSecret(request);
  if (denied) return denied;
  const pool = getPool();
  const { rows } = await pool.query("SELECT COUNT(*)::int AS demo FROM invoices WHERE api_key IS NULL");
  return Response.json({ demoInvoices: rows[0]?.demo || 0 });
}
