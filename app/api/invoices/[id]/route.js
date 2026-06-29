import { getInvoice, updateInvoiceStatus, logAction } from "../../../../lib/db.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/invoices/[id] — get single invoice
export async function GET(request, { params }) {
  try {
    const invoiceId = params.id;
    const invoice = await getInvoice(invoiceId);

    if (!invoice) {
      return Response.json({ error: `Invoice ${invoiceId} not found` }, { status: 404 });
    }

    return Response.json(invoice);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
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

    const existing = await getInvoice(invoiceId);
    if (!existing) {
      return Response.json({ error: `Invoice ${invoiceId} not found` }, { status: 404 });
    }

    await updateInvoiceStatus(invoiceId, status);
    await logAction("Finance", "invoice_updated", { invoiceId, status });

    const updated = await getInvoice(invoiceId);
    return Response.json({ success: true, invoice: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
