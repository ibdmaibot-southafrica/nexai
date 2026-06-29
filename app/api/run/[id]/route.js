import { getProduct, getApiKey, debitCredits, creditKey, createOrder, logAction } from "../../../../lib/db.js";
import { chat } from "../../../../lib/llm.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Metered AI-product call (the AI-to-AI sell path).
//   GET  /api/run/:id                       -> product spec + how to call/pay
//   POST /api/run/:id  {input}  + API key   -> runs the product, debits credits
// Auth: Authorization: Bearer <apiKey>  (or X-API-Key). Credits funded via PayPal
// at /api/keys/create. Each call costs the product's per-call price.
function getKey(request) {
  const auth = request.headers.get("authorization") || "";
  if (auth.startsWith("Bearer ")) return auth.slice(7).trim();
  return request.headers.get("x-api-key") || null;
}

export async function GET(request, { params }) {
  const product = await getProduct(params.id);
  if (!product || product.status !== "live") return Response.json({ error: "Product not found" }, { status: 404 });
  return Response.json({
    id: product.id,
    name: product.name,
    description: product.description,
    pricePerCall: product.price,
    currency: product.currency,
    input: product.inputHint || "Send { input: <text> } in the POST body.",
    howToPay: {
      model: "Prepaid credits funded via PayPal.",
      getKey: "POST /api/keys/create { amount } -> returns apiKey + PayPal fund link.",
      call: `POST /api/run/${product.id} with header 'Authorization: Bearer <apiKey>' and body { input }.`,
    },
  });
}

export async function POST(request, { params }) {
  const product = await getProduct(params.id);
  if (!product || product.status !== "live") {
    return Response.json({ error: "Product not found" }, { status: 404 });
  }
  if (!product.systemPrompt) {
    return Response.json({ error: "Product is not an executable AI service" }, { status: 400 });
  }

  const key = getKey(request);
  if (!key) {
    return Response.json(
      { error: "API key required", howToGetOne: "POST /api/keys/create { amount } then send Authorization: Bearer <key>", pricePerCall: product.price },
      { status: 401 }
    );
  }
  const keyRow = await getApiKey(key);
  if (!keyRow || keyRow.status !== "active") {
    return Response.json({ error: "Invalid API key" }, { status: 401 });
  }

  // Charge first (atomic). 402 if the balance can't cover this call.
  const charge = await debitCredits(key, product.price);
  if (!charge.ok) {
    return Response.json(
      { error: "Insufficient credits", balance: charge.balance, pricePerCall: product.price, topUp: "/api/keys/create" },
      { status: 402 }
    );
  }

  // Read input.
  let input = "";
  try {
    const body = await request.json();
    input = typeof body?.input === "string" ? body.input : JSON.stringify(body?.input ?? body ?? "");
  } catch {
    input = "";
  }

  // Execute the product (its stored system prompt + the buyer's input).
  let result;
  try {
    result = await chat(product.systemPrompt, input || "(no input provided)", { temperature: 0.5, maxTokens: 1500 });
  } catch (err) {
    await creditKey(key, product.price); // refund — we charged but produced nothing
    await logAction("Store", "run_failed", { product: product.id, error: err.message });
    return Response.json({ error: "Execution failed; credits refunded", detail: err.message }, { status: 502 });
  }

  const order = await createOrder({
    productId: product.id,
    buyer: key.slice(0, 12) + "…",
    amount: product.price,
    currency: product.currency,
    channel: "credits",
    status: "paid",
    deliverable: null,
  });
  await logAction("Store", "ai_sale", { product: product.id, price: product.price, orderId: order.id });

  return Response.json({
    product: product.name,
    result,
    orderId: order.id,
    charged: product.price,
    creditsRemaining: charge.balance,
  });
}
