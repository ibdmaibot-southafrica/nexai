import { getLeads } from "../../../lib/db.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/leads — the Prospector's AI-venue discovery targets (where the catalog
// is being listed). These are NOT companies to bill; they're places to be found.
export async function GET() {
  const leads = await getLeads(50);
  return Response.json({ leads, count: leads.length });
}
