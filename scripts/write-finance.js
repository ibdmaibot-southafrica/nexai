const fs = require('fs');
// Finance agent: review + forecasting only. It does NOT create invoices.
// Invoices/orders are only ever born from a real checkout (POST /api/payments/create)
// and auto-confirmed "paid" by the PayPal webhook. No fabricated invoices.
const content = `import { chat } from "../lib/llm.js";
import { logAction, updateAgentStatus, getInvoices, getStatus } from "../lib/db.js";

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

    await logAction("Finance", "review_complete", response.substring(0, 200));
    await updateAgentStatus("finance", "active", 1);

    return {
      agent: "Finance",
      action: "finance_cycle",
      strategy: response.substring(0, 200),
      invoiceCreated: null,
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
