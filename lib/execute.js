import { createHash } from "crypto";
import { getProduct, getApiKey, debitCredits, creditKey, createOrder, logAction, getCachedResult, setCachedResult } from "./db.js";
import { chat } from "./llm.js";
import { webFetch, firstUrl } from "./tools.js";

/**
 * Single code path for running a paid AI-service product. Used by both the REST
 * endpoint (/api/run/[id]) and the MCP server (/api/mcp). Handles auth, metering
 * (credits), the live-data tool, caching, execution, and order/logging.
 *
 * Returns { status, ...payload }:
 *  401 needsKey | 402 insufficient | 400 invalid | 404 notFound | 502 failed | 200 ok
 */
export async function runProduct({ productId, input, key, free = false }) {
  const product = await getProduct(productId);
  if (!product || product.status !== "live") return { status: 404, error: "Product not found or not live" };
  if (!product.systemPrompt) return { status: 400, error: "Product is not an executable AI service" };

  // Free sample mode (public try-it): no key, no charge, no order. Caller is
  // responsible for rate-limiting.
  let charge = { ok: true, balance: null };
  if (!free) {
    if (!key) {
      return { status: 401, needsKey: true, error: "API key required", pricePerCall: product.price, getKey: "POST /api/keys/create { amount } then pass your key" };
    }
    const keyRow = await getApiKey(key);
    if (!keyRow || keyRow.status !== "active") return { status: 401, error: "Invalid API key" };
    charge = await debitCredits(key, product.price);
    if (!charge.ok) return { status: 402, error: "Insufficient credits", balance: charge.balance, pricePerCall: product.price, topUp: "/api/keys/create" };
  }

  const inputHash = createHash("sha256").update(`${product.tool || ""}|${input || ""}`).digest("hex").slice(0, 32);
  let result, cached = false;
  try { const hit = await getCachedResult(product.id, inputHash); if (hit) { result = hit; cached = true; } } catch {}

  if (!cached) {
    try {
      let userContent = input || "(no input provided)";
      if (product.tool === "web_fetch") {
        const url = firstUrl(input);
        const page = await webFetch(url);
        userContent = `SOURCE URL: ${url}\n\nLIVE CONTENT:\n${page}\n\nTASK INPUT: ${input}`;
      }
      result = await chat(product.systemPrompt, userContent, { temperature: 0.4, maxTokens: 1500 });
      try { await setCachedResult(product.id, inputHash, result); } catch {}
    } catch (err) {
      if (!free) await creditKey(key, product.price); // refund — produced nothing
      await logAction("Store", "run_failed", { product: product.id, error: err.message });
      return { status: 502, error: "Execution failed" + (free ? "" : "; credits refunded"), detail: err.message };
    }
  }

  if (free) {
    return { status: 200, product: product.name, result, cached, free: true };
  }

  const order = await createOrder({
    productId: product.id, buyer: key.slice(0, 12) + "…", amount: product.price,
    currency: product.currency, channel: "credits", status: "paid", deliverable: null,
  });
  await logAction("Store", "ai_sale", { product: product.id, price: product.price, orderId: order.id });

  return { status: 200, product: product.name, result, cached, orderId: order.id, charged: product.price, creditsRemaining: charge.balance };
}
