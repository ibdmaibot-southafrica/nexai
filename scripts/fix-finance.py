content = '''import { chat } from "../lib/llm.js";
import { logAction, updateAgentStatus, getStatus } from "../lib/db.js";

export async function runFinanceCycle() {
  await updateAgentStatus("finance", "running", 0);
  try {
    const status = await getStatus();
    
    // Track financial health - don't auto-create invoices, just report
    const revenue = status.financials?.revenue || 0;
    const pendingInvoices = status.invoices?.pending || 0;
    const totalInvoices = status.invoices?.total || 0;
    
    const response = await chat(
      "You are CFO of NexAI.",
      `Financial status: $${revenue} revenue, ${pendingInvoices} pending invoices, ${totalInvoices} total invoices. What financial action should we take?`,
      { temperature: 0.3 }
    );

    await logAction("Finance", "financial_review", { 
      revenue, pendingInvoices, totalInvoices,
      recommendation: response.substring(0, 200) 
    });
    
    await updateAgentStatus("finance", "active", 1);
    return { agent: "Finance", action: "finance_cycle", revenue, pendingInvoices };
  } catch (err) {
    await updateAgentStatus("finance", "error", 0);
    return { agent: "Finance", action: "error", error: err.message };
  }
}
'''

with open('agents/finance.js', 'w', encoding='utf-8') as f:
    f.write(content)
print('finance.js updated - no longer auto-creates invoices')
