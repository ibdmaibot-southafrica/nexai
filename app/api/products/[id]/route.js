import { getProduct } from "../../../../lib/db.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/products/:id — one product
export async function GET(request, { params }) {
  const product = await getProduct(params.id);
  if (!product) return Response.json({ error: "Not found" }, { status: 404 });
  const { systemPrompt, ...safe } = product; // never expose the product's IP
  return Response.json({ product: safe });
}
