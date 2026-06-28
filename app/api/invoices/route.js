import { getState, updateState, logAgentAction } from "../../../lib/db.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/invoices — list all invoices
export async function GET() {
  const state = getState();
  let invoices = state.invoices || [];
  if (!Array.isArray(invoices)) {
    invoices = Object.values(invoices);
  }

  return Response.json({
    invoices,
    total: invoices.length,
    paid: invoices.filter((i) => i.status === "paid").length,
    pending: invoices.filter((i) => i.status === "pending").length,
    overdue: invoices.filter((i) => i.status === "overdue").length,
    totalAmount: invoices.reduce((sum, i) => sum + (i.amount || 0), 0),
    paidAmount: invoices.filter((i) => i.status === "paid").reduce((sum, i) => sum + (i.amount || 0), 0),
  });
}

// POST /api/invoices — create a new invoice
export async function POST(request) {
  try {
    const body = await request.json();
    const { customer, product, amount, dueDate } = body;

    if (!customer || !product || !amount) {
      return Response.json(
        { error: "Missing required fields: customer, product, amount" },
        { status: 400 }
      );
    }

    const invoice = {
      id: `inv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      customer,
      product,
      amount: parseFloat(amount),
      status: "pending",
      createdAt: new Date().toISOString(),
      dueDate: dueDate || new Date(Date.now() + 30 * 86400000).toISOString(),
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

    logAgentAction("Finance", "invoice_created", { invoice });

    return Response.json({ success: true, invoice }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
