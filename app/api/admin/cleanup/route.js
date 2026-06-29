import { getPool } from "../../../../lib/db.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/admin/cleanup - Remove fake data and start fresh
export async function POST() {
  const pool = getPool();
  const client = await pool.connect();
  try {
    // Delete fake invoices (test data, placeholder customers)
    const fakeDeleted = await client.query(`
      DELETE FROM invoices 
      WHERE customer LIKE 'Test%' 
         OR customer LIKE 'Jane%' 
         OR customer LIKE 'John%'
         OR customer LIKE 'Pending%'
         OR customer LIKE 'Prospective%'
         OR customer LIKE 'AI Business%'
      RETURNING id
    `);

    // Delete old logs that are just test data
    const logsDeleted = await client.query(`
      DELETE FROM logs 
      WHERE agent = 'System' AND action LIKE 'cron_%'
      RETURNING id
    `);

    // Reset financials to 0 (since we have no real revenue)
    await client.query(`UPDATE financials SET revenue = 0, costs = 0, growth = '+0%' WHERE id = 1`);

    // Add real AI company leads for the sales agent to work with
    const realCompanies = [
      { name: 'Anthropic', website: 'https://anthropic.com', location: 'San Francisco, US', industry: 'AI Safety', score: 8 },
      { name: 'Cohere', website: 'https://cohere.com', location: 'Toronto, Canada', industry: 'Enterprise NLP', score: 9 },
      { name: 'Hugging Face', website: 'https://huggingface.co', location: 'New York, US', industry: 'ML Platform', score: 7 },
      { name: 'Scale AI', website: 'https://scale.com', location: 'San Francisco, US', industry: 'AI Training Data', score: 8 },
      { name: 'Databricks', website: 'https://databricks.com', location: 'San Francisco, US', industry: 'Data Platform', score: 6 },
      { name: 'Snowflake', website: 'https://snowflake.com', location: 'Montreal, Canada', industry: 'Data Warehouse', score: 5 },
      { name: 'Perplexity', website: 'https://perplexity.ai', location: 'San Francisco, US', industry: 'AI Search', score: 9 },
      { name: 'Groq', website: 'https://groq.com', location: 'Mountain View, US', industry: 'AI Hardware', score: 7 },
      { name: 'Mistral AI', website: 'https://mistral.ai', location: 'Montreal, Canada', industry: 'Open Source LLM', score: 8 },
      { name: 'Coveo', website: 'https://coveo.com', location: 'Montreal, Canada', industry: 'Enterprise Search', score: 6 },
      { name: 'Weights & Biases', website: 'https://wandb.ai', location: 'San Francisco, US', industry: 'ML Experiment Tracking', score: 7 },
      { name: 'Replicate', website: 'https://replicate.com', location: 'San Francisco, US', industry: 'AI Model Hosting', score: 8 },
    ];

    let leadsAdded = 0;
    for (const company of realCompanies) {
      try {
        await client.query(
          `INSERT INTO leads (company_name, website, location, industry, status, score, source) 
           VALUES ($1, $2, $3, $4, 'researching', $5, 'ceo_research')
           ON CONFLICT DO NOTHING`,
          [company.name, company.website, company.location, company.industry, company.score]
        );
        leadsAdded++;
      } catch {}
    }

    return Response.json({
      success: true,
      fakeInvoicesDeleted: fakeDeleted.rowCount,
      fakeLogsDeleted: logsDeleted.rowCount,
      realLeadsAdded: leadsAdded,
      message: `Cleaned ${fakeDeleted.rowCount} fake invoices, ${logsDeleted.rowCount} test logs. Added ${leadsAdded} real company leads.`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

// GET /api/admin/cleanup - Get cleanup stats
export async function GET() {
  const pool = getPool();
  const client = await pool.connect();
  try {
    const invoices = await client.query("SELECT COUNT(*) FROM invoices");
    const leads = await client.query("SELECT COUNT(*) FROM leads");
    const products = await client.query("SELECT COUNT(*) FROM products");
    const logs = await client.query("SELECT COUNT(*) FROM logs");
    
    return Response.json({
      invoices: parseInt(invoices.rows[0].count),
      leads: parseInt(leads.rows[0].count),
      products: parseInt(products.rows[0].count),
      logs: parseInt(logs.rows[0].count)
    });
  } finally {
    client.release();
  }
}
