const fs = require('fs');
const content = `import { chat } from "../lib/llm.js";
import { logAction, updateAgentStatus, getInvoices, addInvoice, getStatus } from "../lib/db.js";

export async function runFinanceCycle() {
  await updateAgentStatus("finance", "running", 0);
  try {
    const status = await getStatus();
    const invoices = await getInvoices();
    const pendingInvoices = invoices.filter(i => i.status === "pending");
    const overdueInvoices = invoices.filter(i => i.status === "overdue");

    const response = await chat(
      \`You are CFO of NexAI. Current state:
- Revenue: $\${status.financials.revenue}
- Pending invoices: \${pendingInvoices.length}
- Overdue invoices: \${overdueInvoices.length}
- Pipeline items: \${status.pipeline.length}\`,
      "What financial action should NexAI take this week? Suggest one specific action.",
      { temperature: 0.3 }
    );

    const readyItems = status.pipeline.filter(p => p.status === "research_complete" || p.status === "built");
    let invoiceCreated = null;
    
    if (readyItems.length > 0 && pendingInvoices.length < 3) {
      const item = readyItems[0];
      const invoice = {
        id: \`inv-\${Date.now()}-\${Math.random().toString(36).substring(2, 6)}\`,
        customer: "Pending Customer",
        product: item.name,
        amount: item.price || 49,
        status: "pending",
        created_at: new Date().toISOString(),
        pipeline_item_id: item.id,
      };
      await addInvoice(invoice);
      invoiceCreated = invoice.id;
      await logAction("Finance", "auto_invoice_created", { invoiceId: invoice.id, product: item.name, amount: invoice.amount });
    }

    await logAction("Finance", "review_complete", response.substring(0, 200));
    await updateAgentStatus("finance", "active", 1);

    return {
      agent: "Finance",
      action: "finance_cycle",
      strategy: response.substring(0, 200),
      invoiceCreated,
      pendingInvoices: pendingInvoices.length,
    };
  } catch (err) {
    await logAction("Finance", "error", err.message);
    await updateAgentStatus("finance", "error", 0);
    return { agent: "Finance", action: "error", error: err.message };
  }
}
`;
fs.writeFileSync('agents/finance.js', content, 'utf8');
console.log('finance.js updated - length:', content.length);
