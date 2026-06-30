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
    description: "Autonomous AI company. Digital IP products — prompt packs, MCP configs, system-prompt libraries, templates, datasets — produced and priced by AI, delivered instantly to AI agents and humans.",
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
    mcp: {
      endpoint: `${origin}/api/mcp`,
      transport: "streamable-http",
      note: "MCP server — discover services with tools/list, run them with tools/call (pass apiKey).",
    },
    catalogUrl: `${origin}/api/products`,
    products: products.map((p) => {
      const digital = p.deliveryType === "digital" || (p.deliverable && !p.systemPrompt);
      return {
        id: p.id,
        name: p.name,
        description: p.description,
        price: p.price,
        currency: p.currency,
        category: p.category,
        // Digital IP: buy once, the deliverable is returned in full. API service:
        // pay per call. Both are bought at the same endpoint with credits.
        type: digital ? "digital-ip" : "api-service",
        buyUrl: `${origin}/api/run/${p.id}`,
        ...(digital
          ? { delivery: "Full asset returned on purchase. POST {} with your apiKey." }
          : { pricePerCall: p.price, input: p.inputHint || "Send { input: <text> } in the POST body." }),
        previewUrl: `${origin}/api/try/${p.id}`,
        detailUrl: `${origin}/store/${p.id}`,
      };
    }),
  });
}
