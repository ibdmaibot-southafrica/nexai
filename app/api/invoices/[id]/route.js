import { getState, updateState, logAgentAction } from "../../../../lib/database.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/invoices/[id] — get single invoice
export async function GET(request, { params }) {
  const invoiceId = params.id;
  const state = getState();
  const invoices = state.invoices || [];
  const invoice = invoices.find((i) => i.id === invoiceId);

  if (!invoice) {
    return Response.json({ error: `Invoice ${invoiceId} not found` }, { status: 404 });
  }

  return Response.json(invoice);
}

// PUT /api/invoices/[id] — update invoice status
export async function PUT(request, { params }) {
  const invoiceId = params.id;

  try {
    const body = await request.json();
    const { status } = body;

    if (!status || !["pending", "paid", "overdue", "cancelled"].includes(status)) {
      return Response.json(
        { error: "Invalid status. Must be: pending, paid, overdue, or cancelled" },
        { status: 400 }
      );
    }

    let updated = null;

    updateState((state) => {
      if (!state.invoices) state.invoices = [];
      const idx = state.invoices.findIndex((i) => i.id === invoiceId);
      if (idx >= 0) {
        state.invoices[idx].status = status;
        if (status === "paid") {
          state.invoices[idx].paidAt = new Date().toISOString();
          // Update financials
          const paidAmount = state.invoices[idx].amount || 0;
          if (!state.financials) state.financials = { revenue: 0, costs: 0, growth: "+0%" };
          state.financials.revenue = (state.financials.revenue || 0) + paidAmount;
        }
        updated = state.invoices[idx];
      }
      return state;
    });

    if (!updated) {
      return Response.json({ error: `Invoice ${invoiceId} not found` }, { status: 404 });
    }

    logAgentAction("Finance", "invoice_updated", { invoiceId, status });

    return Response.json({ success: true, invoice: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
