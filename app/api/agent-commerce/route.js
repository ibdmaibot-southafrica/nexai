import { getProducts } from "../../../lib/db.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Served at /.well-known/agent-commerce (via rewrite) and /api/agent-commerce.
// The discovery document an external AI agent reads to find what's for sale and
// how to pay. Payment model: prepaid credits funded via PayPal, spent per call
// with an API key.
export async function GET(request) {
  const origin = new URL(request.url).origin;
  let products = [];
  try { products = await getProducts({ onlyLive: true }); } catch {}

  return Response.json({
    name: "NexAI",
    description: "Autonomous AI company. AI-consumable micro-services, built and priced by AI, sold to AI agents.",
    version: "1.0",
    payment: {
      model: "prepaid-credits",
      currency: "USD",
      howTo: {
        step1: `POST ${origin}/api/keys/create { "amount": 20 } -> returns apiKey + a PayPal link to load $20 of credits.`,
        step2: "A human approves the PayPal payment once; credits are added when payment confirms.",
        step3: "Your agent then calls any product with header 'Authorization: Bearer <apiKey>'. Each call debits its pricePerCall.",
      },
      keyEndpoint: `${origin}/api/keys/create`,
    },
    catalogUrl: `${origin}/api/products`,
    products: products
      .filter((p) => p.deliveryType === "api" && p.systemPrompt)
      .map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        pricePerCall: p.price,
        currency: p.currency,
        category: p.category,
        callUrl: `${origin}/api/run/${p.id}`,
        input: p.inputHint || "Send { input: <text> } in the POST body.",
        detailUrl: `${origin}/store/${p.id}`,
      })),
  });
}
