/**
 * Finance Agent - Tracks costs, manages invoicing, monitors revenue
 * Task: Generate invoices, track payments, manage finances
 */
import { chat } from "../lib/llm.js";
import { getState, logAgentAction, updateState, updateAgentStatus } from "../lib/database.js";

const SYSTEM_PROMPT = `You are the CFO of NexAI, an autonomous AI company.

Your SOLE JOB: Manage finances, generate invoices, track revenue.

Payment model (no Stripe):
- We send invoices to customers with bank transfer details
- Customer pays manually via bank transfer
- We track who has paid and who hasn't
- Generate invoice content for each sale

Rules:
- Track all costs (API calls, hosting, tools)
- Track all revenue (payments received)
- Generate invoice content for each sale
- Flag overdue payments
- Calculate profit margins

Respond in valid JSON:
{
  "financials": {
    "totalRevenue": 0,
    "totalCosts": 0,
    "profit": 0,
    "outstandingInvoices": 0,
    "overduePayments": 0
  },
  "newInvoices": [
    {
      "customer": "Customer Name",
      "product": "Product Name",
      "amount": 29,
      "status": "pending",
      "dueDate": "2026-07-26"
    }
  ],
  "recommendations": ["financial advice"]
}`;

export async function runFinanceCycle() {
  try { updateAgentStatus("finance", "running", 0); } catch {}
  let state;
  try { state = getState(); } catch { state = { financials: { revenue: 0, costs: 0 }, invoices: [], pipeline: [] }; }
  const financials = state.financials || { revenue: 0, costs: 0 };
  const invoices = state.invoices || [];
  const pipeline = state.pipeline || [];
  const launchedProducts = pipeline.filter((p) => p.status === "launched");

  const prompt = `Manage NexAI finances:

Current Financials:
- Revenue: $${financials.revenue}
- Costs: $${financials.costs}
- Profit: $${(financials.revenue || 0) - (financials.costs || 0)}

Launched Products: ${launchedProducts.length}
${launchedProducts.map((p) => `- ${p.idea?.name} at $${p.idea?.pricing?.amount}/mo`).join("\n") || "None yet"}

Active Invoices: ${invoices.length}
${invoices.map((i) => `- ${i.id}: ${i.customer} - $${i.amount} (${i.status})`).join("\n") || "None"}

Provide:
1. Financial health assessment
2. New invoices for any launched products that need them
3. Revenue projections
4. Cost optimization tips`;

  let response;
  try {
    response = await chat(SYSTEM_PROMPT, prompt, { temperature: 0.3 });
  } catch (err) {
    logAgentAction("Finance", "error", { error: err.message });
    try { updateAgentStatus("finance", "active", 0); } catch {}
    return { agent: "Finance", action: "error", error: err.message };
  }

  logAgentAction("Finance", "finance_cycle", { response: response.substring(0, 300) });

  const parsed = parseResponse(response);

  if (parsed) {
    updateState((state) => {
      // Update financials from LLM response
      if (parsed.financials) {
        state.financials = {
          revenue: parsed.financials.totalRevenue || state.financials?.revenue || 0,
          costs: parsed.financials.totalCosts || state.financials?.costs || 0,
          growth: state.financials?.growth || "+0%",
        };
      }
      // Add new invoices from LLM response
      if (parsed.newInvoices && Array.isArray(parsed.newInvoices)) {
        if (!state.invoices) state.invoices = [];
        for (const inv of parsed.newInvoices) {
          state.invoices.push({
            id: `inv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            customer: inv.customer,
            product: inv.product,
            amount: inv.amount,
            status: inv.status || "pending",
            createdAt: new Date().toISOString(),
            dueDate: inv.dueDate || new Date(Date.now() + 30 * 86400000).toISOString(),
          });
        }
      }
      return state;
    });
    try { updateAgentStatus("finance", "active", 1); } catch {}
  } else {
    try { updateAgentStatus("finance", "active", 0); } catch {}
  }

  return { agent: "Finance", action: "finance_cycle", response, parsed };
}

export function generateInvoice(customerName, productName, amount) {
  const invoice = {
    id: `inv-${Date.now()}`,
    customer: customerName,
    product: productName,
    amount,
    status: "pending",
    createdAt: new Date().toISOString(),
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    paymentInstructions: [
      "Transfer the amount to our bank account",
      "Use your invoice number as reference",
      "Email us the payment confirmation",
      "We'll activate your access within 24 hours",
    ],
  };

  updateState((state) => {
    if (!state.invoices) state.invoices = [];
    state.invoices.push(invoice);
    return state;
  });

  logAgentAction("Finance", "invoice_generated", { invoice });
  return invoice;
}

function parseResponse(response) {
  try {
    const jsonStart = response.indexOf("{");
    const jsonEnd = response.lastIndexOf("}") + 1;
    if (jsonStart >= 0 && jsonEnd > jsonStart) {
      return JSON.parse(response.substring(jsonStart, jsonEnd));
    }
  } catch {}
  return null;
}
