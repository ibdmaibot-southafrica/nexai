import { getInvoice, updateInvoiceStatus, logAction } from "../../../../../lib/db.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/payments/status/[invoiceId] — check payment status
export async function GET(request, { params }) {
  try {
    const invoiceId = params.invoiceId;
    const invoice = await getInvoice(invoiceId);

    if (!invoice) {
      return Response.json({ error: "Invoice not found" }, { status: 404 });
    }

    return Response.json({
      invoiceId: invoice.id,
      status: invoice.status,
      amount: invoice.amount,
      customer: invoice.customer,
      product: invoice.product,
      created_at: invoice.created_at,
      paid_at: invoice.paid_at,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/payments/status/[invoiceId] — manually mark as paid (admin)
export async function POST(request, { params }) {
  try {
    const invoiceId = params.invoiceId;
    const body = await request.json();
    const { status } = body;

    if (!["paid", "pending", "cancelled"].includes(status)) {
      return Response.json({ error: "Invalid status" }, { status: 400 });
    }

    await updateInvoiceStatus(invoiceId, status);
    await logAction("Finance", "invoice_manual_update", { invoiceId, status });

    return Response.json({ success: true, invoiceId, status });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
