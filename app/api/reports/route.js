import { getReports } from "../../../lib/db.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const type = url.searchParams.get("type") || null;
    const limit = parseInt(url.searchParams.get("limit")) || 20;
    
    const reports = await getReports(type, limit);
    return Response.json({ reports, total: reports.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
