import { getProducts } from "../../../lib/db.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/products — live product catalog (human + machine readable)
export async function GET() {
  const products = await getProducts({ onlyLive: true });
  return Response.json({ products, count: products.length });
}
