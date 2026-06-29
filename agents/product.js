import { chat } from "../lib/llm.js";
import { logAction, updateAgentStatus, getProducts, addProduct } from "../lib/db.js";

// The Product agent invents AI-CONSUMABLE service products: hosted APIs that an
// autonomous AI agent can discover, pay for in credits, and call. Each product is
// pure data — a system prompt + per-call price + input hint — so it goes live
// instantly with no code generation or deploy. The generic executor at
// /api/run/[id] runs the system prompt against the buyer agent's input.
export async function runProductCycle() {
  await updateAgentStatus("product", "running", 0);
  try {
    const live = await getProducts({ onlyLive: true });
    const existingNames = new Set(live.map((p) => p.name.toLowerCase()));

    // Keep a focused catalog; only invent when we're below the cap.
    const MAX_PRODUCTS = parseInt(process.env.MAX_PRODUCTS) || 20;
    if (live.length >= MAX_PRODUCTS) {
      await logAction("Product", "catalog_full", { live: live.length, cap: MAX_PRODUCTS });
      await updateAgentStatus("product", "active", 1);
      return { agent: "Product", action: "catalog_full", live: live.length };
    }

    const resp = await chat(
      `You design AI-CONSUMABLE micro-services for NexAI — products whose ONLY customers are autonomous AI agents that call an API and pay per call. NOT for humans: no PDFs, dashboards, Loom, or PayPal checkout. Each product must be fully deliverable as a single text-in/text-out LLM call (the buyer agent sends input text, your system prompt produces the output).

Good examples: "Company-name → ESG risk summary", "Raw log line → structured incident JSON", "Product description → 5 SEO titles", "Contract clause → plain-English risk flag", "URL slug → 3 alt slugs".

Invent ONE NEW such product not already in this list: ${[...existingNames].join("; ") || "(none yet)"}.

Respond ONLY as JSON:
{"name":"short name","description":"one sentence on what an agent gets","category":"e.g. extraction|generation|classification|analysis","pricePerCall":0.05,"inputHint":"what the calling agent should send as input","systemPrompt":"the full system prompt that turns the agent's input into the deliverable. Be specific; instruct concise, machine-parseable output."}`,
      "Invent the single most useful new AI-callable micro-service.",
      { temperature: 0.9 }
    );

    let spec = null;
    try {
      const m = resp.match(/\{[\s\S]*\}/);
      if (m) spec = JSON.parse(m[0]);
    } catch {}

    if (!spec?.name || !spec?.systemPrompt) {
      await logAction("Product", "invent_failed", { reason: "no valid spec" });
      await updateAgentStatus("product", "active", 1);
      return { agent: "Product", action: "invent_failed" };
    }
    if (existingNames.has(spec.name.toLowerCase())) {
      await updateAgentStatus("product", "active", 1);
      return { agent: "Product", action: "duplicate", name: spec.name };
    }

    // Price as a micropayment.
    let price = Number(spec.pricePerCall);
    if (!price || price <= 0) price = 0.05;
    price = Math.min(2, Math.max(0.01, price));

    const { id } = await addProduct({
      name: spec.name,
      description: spec.description || "",
      price,
      currency: "USD",
      category: spec.category || "generation",
      status: "live",
      deliveryType: "api",
      systemPrompt: spec.systemPrompt,
      inputHint: spec.inputHint || "Send { input: <text> }.",
    });

    await logAction("Product", "ai_product_launched", { id, name: spec.name, price });
    await updateAgentStatus("product", "active", 1);
    return { agent: "Product", action: "launched_ai_service", name: spec.name, price };
  } catch (err) {
    await logAction("Product", `error: ${err.message}`, null);
    await updateAgentStatus("product", "error", 0);
    return { agent: "Product", action: "error", error: err.message };
  }
}
