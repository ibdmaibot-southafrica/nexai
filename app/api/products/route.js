import { getProducts } from "../../../lib/db.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/products — live product catalog (human + machine readable).
// Never expose systemPrompt (the product's IP).
export async function GET() {
  const products = (await getProducts({ onlyLive: true })).map(({ systemPrompt, ...p }) => p);
  return Response.json({ products, count: products.length });
}
