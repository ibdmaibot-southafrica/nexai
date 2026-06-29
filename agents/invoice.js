import { chat } from "../lib/llm.js";
import { logAction, updateAgentStatus, getStatus, getPool } from "../lib/db.js";

export async function runInvoiceCycle() {
  await updateAgentStatus("invoice", "running", 0);
  const action = {};

  try {
    const pool = getPool();
    const status = await getStatus();

    // Get all pending invoices
    const { rows: pendingInvoices } = await pool.query(
      "SELECT * FROM invoices WHERE status = 'pending' ORDER BY created_at ASC LIMIT 10"
    );

    action.pendingInvoicesFound = pendingInvoices.length;
    action.totalPendingAmount = pendingInvoices.reduce((s, i) => s + Number(i.amount), 0);

    let followUps = 0;
    let markedOverdue = 0;

    for (const inv of pendingInvoices) {
      const daysSinceCreated = Math.floor((Date.now() - new Date(inv.created_at).getTime()) / (1000 * 60 * 60 * 24));

      // Generate a follow-up message for each invoice
      const followUp = await chat(
        "You are a persistent but professional invoice collections agent for NexAI. Your job is to get paid.",
        `Invoice details:
- Customer: ${inv.customer}
- Product: ${inv.product}
- Amount: $${inv.amount}
- Days since sent: ${daysSinceCreated}
- PayPal link: ${inv.paypal_me_link || 'https://www.paypal.com/paypalme/hjr/' + Number(inv.amount).toFixed(2)}

Write a short, direct follow-up message that urges payment. Include the PayPal link. Keep it under 100 words. Professional but firm.`,
        { temperature: 0.7 }
      );

      // Log the follow-up
      await logAction("Invoice", "follow_up_sent", {
        invoiceId: inv.id,
        customer: inv.customer,
        amount: inv.amount,
        daysOutstanding: daysSinceCreated,
        message: followUp.substring(0, 300),
      });

      followUps++;

      // Mark as overdue if > 7 days
      if (daysSinceCreated > 7 && inv.status === "pending") {
        await pool.query("UPDATE invoices SET status = 'overdue' WHERE id = $1", [inv.id]);
        markedOverdue++;
        await logAction("Invoice", "marked_overdue", { invoiceId: inv.id, customer: inv.customer, days: daysSinceCreated });
      }
    }

    // Generate a collections summary
    const summary = await chat(
      "You are the CFO of NexAI. Summarize the invoice collections status in 2-3 sentences.",
      `Status: ${pendingInvoices.length} pending invoices totaling $${action.totalPendingAmount}. ${followUps} follow-ups sent. ${markedOverdue} marked overdue. Total revenue: $${status.financials?.revenue || 0}.`,
      { temperature: 0.5 }
    );

    action.followUpsSent = followUps;
    action.markedOverdue = markedOverdue;
    action.summary = summary.substring(0, 300);

    await logAction("Invoice", "cycle_complete", action);
    await updateAgentStatus("invoice", "active", 1);
    return { agent: "Invoice", action: "invoice_cycle", ...action };
  } catch (err) {
    await updateAgentStatus("invoice", "error", 0);
    await logAction("Invoice", "error", { error: err.message });
    return { agent: "Invoice", action: "error", error: err.message };
  }
}
