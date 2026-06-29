import { getPool } from "../../../../lib/db.js";
import { generatePayPalMeLink } from "../../../../lib/paypal.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/invoices/backfill-paypal — backfill PayPal links for all invoices missing them
export async function POST() {
  try {
    const pool = getPool();
    
    // Find all invoices without PayPal links
    const { rows } = await pool.query(
      "SELECT id, amount, product FROM invoices WHERE paypal_me_link IS NULL OR paypal_me_link = ''"
    );
    
    let updated = 0;
    for (const inv of rows) {
      const paypalMeLink = generatePayPalMeLink(inv.amount);
      await pool.query(
        "UPDATE invoices SET paypal_me_link = $1, paypal_link = $2 WHERE id = $3",
        [paypalMeLink, paypalMeLink, inv.id]
      );
      updated++;
    }
    
    return Response.json({
      success: true,
      message: `Backfilled PayPal links for ${updated} invoices`,
      totalFound: rows.length,
      updated,
      sampleLink: rows.length > 0 ? generatePayPalMeLink(rows[0].amount) : null,
    });
  } catch (error) {
    console.error("[Backfill] Error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
