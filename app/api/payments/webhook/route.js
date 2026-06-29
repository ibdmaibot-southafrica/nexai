import { updateInvoiceStatus, completeTopup, logAction } from "../../../../lib/db.js";
import { verifyWebhookSignature } from "../../../../lib/paypal.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/payments/webhook — PayPal IPN/webhook handler
export async function POST(request) {
  try {
    // Read the RAW body once — signature verification must hash the exact bytes
    // PayPal signed, and we reuse the same string for JSON parsing.
    const rawBody = await request.text();

    // Reject forged webhooks. Without this, anyone could POST a fake
    // "payment completed" event and mark invoices paid without paying.
    const verified = await verifyWebhookSignature(request.headers, rawBody);
    if (!verified) {
      console.warn("[PayPal Webhook] Rejected unverified webhook");
      await logAction("Finance", "payment_webhook_rejected", { reason: "signature_unverified" });
      return Response.json({ error: "Webhook signature verification failed" }, { status: 401 });
    }

    const body = JSON.parse(rawBody);

    // Handle PayPal webhook events
    const eventType = body.event_type;
    const resource = body.resource;

    console.log("[PayPal Webhook]", eventType, resource?.invoice_id || resource?.invoice);

    if (eventType === "PAYMENT.CAPTURE.COMPLETED" || eventType === "CHECKOUT.ORDER.APPROVED") {
      const invoiceId =
        resource?.invoice_id ||
        resource?.invoice ||
        resource?.supplementary?.data?.invoice_id ||
        resource?.purchase_units?.[0]?.reference_id;
      const amount = resource?.amount?.value || resource?.purchase_units?.[0]?.amount?.value;
      const payerEmail = resource?.payer?.email_address || resource?.payer?.payer_id;

      if (invoiceId) {
        // Is this an API-credit top-up? If so, credit the key; otherwise it's a
        // normal product invoice.
        const topup = await completeTopup(invoiceId);
        if (topup.credited) {
          await logAction("Finance", "credits_funded", { invoiceId, key: topup.key?.slice(0, 12) + "…", amount: topup.amount });
        } else {
          await updateInvoiceStatus(invoiceId, "paid");
          await logAction("Finance", "payment_received", { invoiceId, amount, payerEmail, eventType });
        }
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
