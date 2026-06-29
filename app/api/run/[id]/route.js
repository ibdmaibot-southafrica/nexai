import { getProduct } from "../../../../lib/db.js";
import { runProduct } from "../../../../lib/execute.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Metered AI-product call (the AI-to-AI sell path).
//   GET  /api/run/:id                      -> product spec + how to call/pay
//   POST /api/run/:id {input} + API key    -> runs the product, debits credits
function getKey(request) {
  const auth = request.headers.get("authorization") || "";
  if (auth.startsWith("Bearer ")) return auth.slice(7).trim();
  return request.headers.get("x-api-key") || null;
}

export async function GET(request, { params }) {
  const product = await getProduct(params.id);
  if (!product || product.status !== "live") return Response.json({ error: "Product not found" }, { status: 404 });
  return Response.json({
    id: product.id, name: product.name, description: product.description,
    pricePerCall: product.price, currency: product.currency,
    input: product.inputHint || "Send { input: <text> } in the POST body.",
    howToPay: {
      model: "Prepaid credits funded via PayPal.",
      getKey: "POST /api/keys/create { amount } -> returns apiKey + PayPal fund link.",
      call: `POST /api/run/${product.id} with header 'Authorization: Bearer <apiKey>' and body { input }.`,
    },
  });
}

export async function POST(request, { params }) {
  let input = "";
  try {
    const body = await request.json();
    input = typeof body?.input === "string" ? body.input : JSON.stringify(body?.input ?? body ?? "");
  } catch { input = ""; }

  const r = await runProduct({ productId: params.id, input, key: getKey(request) });
  const { status, ...payload } = r;
  return Response.json(payload, { status });
}
