import { chat } from "../lib/llm.js";
import { logAction, updateAgentStatus, getStatus, getPool } from "../lib/db.js";
import { getBestPaymentLink } from "../lib/paypal.js";

// Sales agent - ONLY works with real leads from the database
// No more fake invoices to random AI companies

export async function runSalesCycle() {
  await updateAgentStatus("sales", "running", 0);
  try {
    const pool = getPool();
    const status = await getStatus();
    const launchedProducts = status.pipeline.filter(p => p.status === "launched");
    let action = {};

    // Only work with real leads
    const { rows: leads } = await pool.query(
      "SELECT * FROM leads WHERE status = 'researching' ORDER BY created_at ASC LIMIT 5"
    );

    action.leadsFound = leads.length;

    if (leads.length === 0) {
      const study = await chat(
        "Sales expert studying market trends.",
        `NexAI has ${launchedProducts.length} products launched. ${status.pipeline.length} in pipeline. Best way to find real paying customers for AI tools? 3 specific strategies.`,
        { temperature: 0.7 }
      );
      action.selfImprovement = study.substring(0, 300);
      action.message = "No real leads. Studying market instead of creating fake invoices.";
      await logAction("Sales", "market_study", action);
      await updateAgentStatus("sales", "active", 1);
      return { agent: "Sales", action: "market_study", ...action };
    }

    let invoicesCreated = 0;
    for (const lead of leads) {
      try {
        const product = launchedProducts[0]?.name || "NexAI AI Tools Suite";
        const amount = launchedProducts[0]?.price || 49;
        const invoiceId = `inv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

        const payment = await getBestPaymentLink({
          customer: lead.company_name,
          product: product,
          amount: amount,
          invoiceId: invoiceId,
        });

        await pool.query(
          `INSERT INTO invoices (id, customer, product, amount, status, paypal_me_link, paypal_link, created_at) 
           VALUES ($1, $2, $3, $4, 'pending', $5, $6, NOW())`,
          [invoiceId, lead.company_name, product, amount, payment.paypal_me_link, payment.paypal_link]
        );

        await pool.query("UPDATE leads SET status = 'contacted', contacted_at = NOW() WHERE id = $1", [lead.id]);
        invoicesCreated++;
        await logAction("Sales", "real_lead_invoice", { lead: lead.company_name, invoiceId, amount });
      } catch (err) {
        action[`failed_${lead.company_name}`] = err.message;
      }
    }

    action.invoicesCreated = invoicesCreated;
    await updateAgentStatus("sales", "active", 1);
    return { agent: "Sales", action: "sales_cycle", ...action };
  } catch (err) {
    await updateAgentStatus("sales", "error", 0);
    return { agent: "Sales", action: "error", error: err.message };
  }
}
