import { createApiKey, createTopupInvoice, logAction } from "../../../../lib/db.js";
import { getBestPaymentLink } from "../../../../lib/paypal.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/keys/create  { amount, label }
// Issues an API key and a PayPal link to fund it with `amount` USD of credits.
// Flow: human approves the PayPal payment once -> webhook credits the key ->
// the agent then calls products with `Authorization: Bearer <key>` autonomously.
export async function POST(request) {
  let body = {};
  try { body = await request.json(); } catch {}
  const amount = Number(body.amount);
  if (!amount || amount <= 0) {
    return Response.json({ error: "Provide a positive `amount` (USD) to fund the key." }, { status: 400 });
  }

  const { key } = await createApiKey(body.label || "agent key");
  const topupInvoiceId = `topup-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  await createTopupInvoice(topupInvoiceId, key, amount);

  const pay = await getBestPaymentLink({
    customer: body.label || "agent",
    product: `NexAI API credits ($${amount})`,
    amount,
    invoiceId: topupInvoiceId,
  });

  await logAction("Store", "api_key_issued", { key: key.slice(0, 12) + "…", amount });

  return Response.json({
    apiKey: key,
    credits: 0,
    fund: {
      amount,
      currency: "USD",
      paymentUrl: pay.paypal_link,
      invoiceId: topupInvoiceId,
      note: "Pay this PayPal link to load credits. Balance updates after payment is confirmed.",
    },
    usage: "Call products with header  Authorization: Bearer <apiKey>.  Each call debits its per-call price.",
  }, { status: 201 });
}
