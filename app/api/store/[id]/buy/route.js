import { randomBytes } from "crypto";
import { getProduct, createOrder, logAction } from "../../../../../lib/db.js";
import { buildRequirements, decodePaymentHeader, verifyAndSettle } from "../../../../../lib/x402.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Autonomous purchase endpoint (x402). Buyer agents:
//   1) GET  /api/store/:id/buy            -> 402 Payment Required + requirements
//   2) pay USDC, then resend with header  X-PAYMENT: <base64 payload>
//   3) GET  /api/store/:id/buy (w/ header)-> 200 + the deliverable
async function handle(request, { params }) {
  const product = await getProduct(params.id);
  if (!product) return Response.json({ error: "Product not found or not live" }, { status: 404 });

  const resource = new URL(request.url).toString();
  const requirements = buildRequirements({
    resource,
    priceUsd: product.price,
    description: `${product.name} — ${product.description}`.slice(0, 200),
  });

  const paymentHeader = request.headers.get("x-payment");

  // No payment yet -> the 402 handshake.
  if (!paymentHeader) {
    return Response.json(
      { ...requirements, product: { id: product.id, name: product.name, price: product.price, currency: product.currency } },
      { status: 402 }
    );
  }

  // Payment presented -> verify + settle on-chain via facilitator.
  const payload = decodePaymentHeader(paymentHeader);
  const settle = await verifyAndSettle(payload, requirements);
  if (!settle.paid) {
    await logAction("Store", "x402_payment_rejected", { product: product.id, reason: settle.reason });
    return Response.json({ ...requirements, error: settle.reason || "payment not verified" }, { status: 402 });
  }

  // Paid — fulfil. Deliverable is a usable license key + access info.
  const licenseKey = "nexai_" + randomBytes(16).toString("hex");
  const deliverable = {
    product: product.name,
    licenseKey,
    deliveryType: product.deliveryType,
    apiEndpoint: product.apiEndpoint,
    docsUrl: product.docsUrl,
    payload: product.deliverable || null,
  };

  const order = await createOrder({
    productId: product.id,
    buyer: payload?.payload?.authorization?.from || "agent",
    amount: product.price,
    currency: product.currency,
    channel: "x402",
    paymentRef: settle.txHash || null,
    status: "paid",
    deliverable: JSON.stringify(deliverable),
  });
  await logAction("Store", "x402_sale", { product: product.id, amount: product.price, tx: settle.txHash, orderId: order.id });

  return new Response(JSON.stringify({ success: true, orderId: order.id, deliverable }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "X-PAYMENT-RESPONSE": Buffer.from(JSON.stringify({ success: true, txHash: settle.txHash, network: settle.network })).toString("base64"),
    },
  });
}

export const GET = handle;
export const POST = handle;
