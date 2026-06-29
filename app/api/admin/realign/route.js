import { getPool, getProducts, addProduct } from "../../../../lib/db.js";
import { requireSecret } from "../../../../lib/auth.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Lean, on-mission roster for an AI-sells-to-AI company on a free LLM.
const KEEP = ["ceo", "coding", "product", "viability", "prospector", "analytics", "finance"];

// Starter AI-callable services so the catalog is never empty. Each is data: a
// system prompt the generic executor (/api/run/[id]) runs against buyer input.
const STARTERS = [
  { name: "Entity Extractor", category: "extraction", price: 0.03, inputHint: "Any text", systemPrompt: "Extract named entities from the input text. Return ONLY compact JSON: {\"people\":[],\"orgs\":[],\"places\":[],\"dates\":[]}. No prose." },
  { name: "Log Line Classifier", category: "classification", price: 0.03, inputHint: "A raw log line", systemPrompt: "Classify the log line. Return ONLY JSON: {\"severity\":\"info|warn|error|critical\",\"category\":\"...\",\"summary\":\"<=12 words\"}. No prose." },
  { name: "SEO Title Generator", category: "generation", price: 0.02, inputHint: "A product or page description", systemPrompt: "Generate 5 concise, high-CTR SEO titles (<=60 chars each) for the input. Return ONLY a JSON array of 5 strings." },
  { name: "Sentiment + Intent", category: "analysis", price: 0.03, inputHint: "A customer message", systemPrompt: "Analyze the message. Return ONLY JSON: {\"sentiment\":\"positive|neutral|negative\",\"intent\":\"...\",\"urgency\":1-5}. No prose." },
];

export async function POST(request) {
  const denied = requireSecret(request);
  if (denied) return denied;
  const pool = getPool();
  let body = {};
  try { body = await request.json(); } catch {}
  const keep = Array.isArray(body.keep) && body.keep.length ? body.keep : KEEP;

  try {
    // 1. Prune: disable every agent not in the lean keep-list.
    const disabled = await pool.query(
      "UPDATE agents SET status = 'disabled', updated_at = NOW() WHERE key <> ALL($1::text[]) AND status <> 'disabled' RETURNING key",
      [keep]
    );
    // Make sure the keepers are active.
    await pool.query("UPDATE agents SET status = 'active' WHERE key = ANY($1::text[]) AND status = 'disabled'", [keep]);

    // 2. Seed starter products if the live catalog is empty.
    let seeded = 0;
    const live = await getProducts({ onlyLive: true });
    if (live.length === 0) {
      for (const s of STARTERS) {
        await addProduct({ ...s, currency: "USD", status: "live", deliveryType: "api" });
        seeded++;
      }
    }

    return Response.json({
      success: true,
      kept: keep,
      agentsDisabled: disabled.rowCount,
      productsSeeded: seeded,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
