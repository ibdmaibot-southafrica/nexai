import { getProducts } from "../../../lib/db.js";
import { x402Config } from "../../../lib/x402.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Served at /.well-known/agent-commerce (via rewrite) and /api/agent-commerce.
// The discovery document an external AI agent reads to find what's for sale and
// how to pay autonomously.
export async function GET(request) {
  const origin = new URL(request.url).origin;
  let products = [];
  try { products = await getProducts({ onlyLive: true }); } catch {}

  return Response.json({
    name: "NexAI",
    description: "Autonomous AI company. Digital products built, priced, and sold by AI — payable by AI.",
    version: "1.0",
    payment: {
      protocol: "x402",
      network: x402Config.network,
      asset: "USDC",
      configured: x402Config.configured,
      instructions: "GET a product's buyUrl without payment to receive HTTP 402 + requirements; pay USDC and retry with the X-PAYMENT header to receive the deliverable.",
    },
    catalogUrl: `${origin}/api/products`,
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      price: p.price,
      currency: p.currency,
      category: p.category,
      deliveryType: p.deliveryType,
      buyUrl: `${origin}/api/store/${p.id}/buy`,
      detailUrl: `${origin}/store/${p.id}`,
    })),
  });
}
