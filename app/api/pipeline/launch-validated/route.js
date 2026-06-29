import { getPool } from "../../../../lib/db.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/pipeline/launch-validated — Launch all validated items
export async function POST() {
  try {
    const pool = getPool();
    
    // Find all validated items
    const result = await pool.query("SELECT id, name FROM pipeline WHERE status = 'validated'");
    const items = result.rows;
    
    if (items.length === 0) {
      return Response.json({ success: true, launched: 0, message: "No validated items to launch" });
    }
    
    // Launch them all
    for (const item of items) {
      await pool.query("UPDATE pipeline SET status = 'launched', updated_at = NOW() WHERE id = $1", [item.id]);
    }
    
    return Response.json({
      success: true,
      launched: items.length,
      items: items.map(i => i.name),
      message: `Launched ${items.length} products`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// GET /api/pipeline/launch-validated — Count validated items
export async function GET() {
  try {
    const pool = getPool();
    const result = await pool.query("SELECT id, name FROM pipeline WHERE status = 'validated'");
    return Response.json({ validated: result.rows.length, items: result.rows });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
