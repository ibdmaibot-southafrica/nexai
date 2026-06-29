import { updateInvoiceStatus, logAction } from "../../../../lib/db.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/payments/webhook — PayPal IPN/webhook handler
export async function POST(request) {
  try {
    const body = await request.json();
    
    // Handle PayPal webhook events
    const eventType = body.event_type;
    const resource = body.resource;

    console.log("[PayPal Webhook]", eventType, resource?.invoice_id || resource?.invoice);

    if (eventType === "PAYMENT.CAPTURE.COMPLETED" || eventType === "CHECKOUT.ORDER.APPROVED") {
      const invoiceId = resource?.invoice_id || resource?.invoice || resource?.supplementary?.data?.invoice_id;
      const amount = resource?.amount?.value || resource?.purchase_units?.[0]?.amount?.value;
      const payerEmail = resource?.payer?.email_address || resource?.payer?.payer_id;

      if (invoiceId) {
        await updateInvoiceStatus(invoiceId, "paid");
        await logAction("Finance", "payment_received", { invoiceId, amount, payerEmail, eventType });
        console.log("[PayPal] Payment confirmed for invoice:", invoiceId);
      }
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("[PayPal Webhook] Error:", error.message);
    return Response.json({ success: true }); // Always return 200 to PayPal
  }
}

// GET /api/payments/webhook — PayPal IPN verification (legacy)
export async function GET() {
  return Response.json({ status: "PayPal webhook endpoint active" });
}
