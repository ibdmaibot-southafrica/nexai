import { getAnalytics, generateReport } from "../../../lib/db.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const analytics = await getAnalytics();
    
    // Also save this as a report
    await generateReport(
      "dashboard_snapshot",
      "Dashboard Analytics Snapshot",
      analytics,
      `Revenue: $${analytics.financials.total_revenue} | Pipeline: ${analytics.pipeline.total} items | Leads: ${analytics.leads.total}`,
      "realtime"
    );
    
    return Response.json(analytics);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
