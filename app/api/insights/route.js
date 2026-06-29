import { getPool } from "../../../lib/db.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/insights — returns live strategic insights generated from real data
export async function GET() {
  try {
    const pool = getPool();

    // Get latest insights from database
    const { rows: insights } = await pool.query(
      "SELECT * FROM insights WHERE status = 'active' ORDER BY created_at DESC LIMIT 10"
    );

    // Get current strategy
    const { rows: strategyRes } = await pool.query(
      "SELECT * FROM strategy ORDER BY updated_at DESC LIMIT 1"
    );

    // Compute live metrics
    const { rows: pipelineStats } = await pool.query(`
      SELECT status, COUNT(*) as count FROM pipeline GROUP BY status
    `);
    const { rows: invoiceStats } = await pool.query(`
      SELECT status, COUNT(*) as count, COALESCE(SUM(amount), 0) as total FROM invoices GROUP BY status
    `);
    const { rows: agentStats } = await pool.query(`
      SELECT status, COUNT(*) as count FROM agents GROUP BY status
    `);
    const { rows: recentLogs } = await pool.query(`
      SELECT agent, action, details, created_at FROM logs ORDER BY created_at DESC LIMIT 20
    `);
    const { rows: financials } = await pool.query(`
      SELECT * FROM financials ORDER BY id DESC LIMIT 1
    `);

    // Generate live insights from actual data
    const liveInsights = [];

    // Revenue insight
    const totalInvoices = invoiceStats.reduce((s, i) => s + Number(i.count), 0);
    const pendingAmount = invoiceStats.find(i => i.status === "pending")?.total || 0;
    const paidAmount = invoiceStats.find(i => i.status === "paid")?.total || 0;
    
    if (totalInvoices > 0) {
      liveInsights.push({
        category: "revenue",
        title: `Revenue Pipeline: $${Number(pendingAmount).toLocaleString()} pending from ${invoiceStats.find(i => i.status === "pending")?.count || 0} invoices`,
        content: paidAmount > 0 
          ? `$${Number(paidAmount).toLocaleString()} collected. Conversion rate: ${((Number(invoiceStats.find(i => i.status === "paid")?.count || 0) / totalInvoices) * 100).toFixed(1)}%`
          : `No payments collected yet. ${totalInvoices} invoices sent. Follow-up required.`,
        priority: paidAmount === 0 ? "high" : "medium",
        live: true,
      });
    }

    // Pipeline insight
    const launched = pipelineStats.find(p => p.status === "launched")?.count || 0;
    const building = pipelineStats.find(p => p.status === "building")?.count || 0;
    const validated = pipelineStats.find(p => p.status === "validated")?.count || 0;
    const ideation = pipelineStats.find(p => p.status === "ideation")?.count || 0;
    const totalProducts = pipelineStats.reduce((s, p) => s + Number(p.count), 0);

    liveInsights.push({
      category: "pipeline",
      title: `${totalProducts} products tracked — ${launched} launched, ${building} building, ${validated} ready`,
      content: validated > 0 
        ? `${validated} products ready to launch. Revenue opportunity: $${validated * 49}/mo estimated.`
        : building > 0 
          ? `${building} products in development. Next launch expected soon.`
          : `${ideation} products in ideation phase.`,
      priority: validated > 0 ? "high" : "medium",
      live: true,
    });

    // Agent activity insight
    const activeAgents = agentStats.find(a => a.status === "active")?.count || 0;
    const runningAgents = agentStats.find(a => a.status === "running")?.count || 0;
    liveInsights.push({
      category: "operations",
      title: `${activeAgents} agents active, ${runningAgents} currently executing`,
      content: runningAgents > 0 
        ? `Active work in progress. Last action: ${recentLogs[0]?.action || "N/A"} by ${recentLogs[0]?.agent || "System"}`
        : `All agents idle. Next cron cycle will trigger autonomous operations.`,
      priority: "low",
      live: true,
    });

    // Recent activity insight
    const recentActions = recentLogs.slice(0, 5).map(l => `${l.agent}: ${l.action}`).join(" → ");
    liveInsights.push({
      category: "activity",
      title: "Recent Agent Activity",
      content: recentActions || "No recent activity",
      priority: "low",
      live: true,
    });

    return Response.json({
      success: true,
      strategy: strategyRes[0]?.content || "Strategy being developed...",
      insights: [...insights.map(i => ({ ...i, live: false })), ...liveInsights],
      metrics: {
        pipeline: pipelineStats,
        invoices: invoiceStats,
        agents: agentStats,
        financials: financials[0] || { revenue: 0, costs: 0 },
        totalProducts,
        totalInvoices,
        pendingAmount: Number(pendingAmount),
        paidAmount: Number(paidAmount),
      },
      recentActivity: recentLogs.slice(0, 10),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
