import { getPool } from "../../../../lib/db.js";
import { requireSecret } from "../../../../lib/auth.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/admin/purge-saas — remove every non-IP product.
//
// NexAI sells digital IP only: a product is legitimate ONLY if it carries a
// finished deliverable (delivery_type='digital' with a non-empty deliverable).
// Everything else — the old per-call API micro-services and any SaaS-style
// pipeline placeholders that synced through with nothing to hand over — is SaaS
// and gets deleted here, along with the pipeline items that fed them.
export async function POST(request) {
  const denied = requireSecret(request);
  if (denied) return denied;

  const pool = getPool();
  const client = await pool.connect();
  try {
    // 1. Delete products that are NOT a delivered digital IP asset.
    const isIp = "(delivery_type = 'digital' AND deliverable IS NOT NULL AND length(trim(deliverable)) > 0)";
    const delProducts = await client.query(
      `DELETE FROM products WHERE NOT ${isIp} RETURNING id, name, category, delivery_type`
    );

    // 2. Delete pipeline items that aren't IP (the SaaS build/launch lifecycle).
    const delPipeline = await client.query(
      `DELETE FROM pipeline WHERE category IS NULL OR category NOT IN ('ip','prompt-pack','mcp-config','system-prompts','template-kit','resource-list','dataset') RETURNING id, name, category`
    );

    return Response.json({
      success: true,
      productsDeleted: delProducts.rowCount,
      deletedProducts: delProducts.rows,
      pipelineItemsDeleted: delPipeline.rowCount,
      message: `Purged ${delProducts.rowCount} SaaS/service products and ${delPipeline.rowCount} non-IP pipeline items. Only delivered digital IP remains.`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

// GET /api/admin/purge-saas — preview what WOULD be deleted (no writes).
export async function GET(request) {
  const denied = requireSecret(request);
  if (denied) return denied;

  const pool = getPool();
  const client = await pool.connect();
  try {
    const isIp = "(delivery_type = 'digital' AND deliverable IS NOT NULL AND length(trim(deliverable)) > 0)";
    const saas = await client.query(
      `SELECT id, name, category, delivery_type, status FROM products WHERE NOT ${isIp} ORDER BY created_at DESC`
    );
    const ip = await client.query(
      `SELECT COUNT(*)::int AS n FROM products WHERE ${isIp}`
    );
    return Response.json({ wouldDelete: saas.rowCount, saasProducts: saas.rows, ipProductsKept: ip.rows[0].n });
  } finally {
    client.release();
  }
}
