import { chat } from "../lib/llm.js";
import { logAction, updateAgentStatus, getProducts, addProduct, getSetting } from "../lib/db.js";

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
      `You design AI-CONSUMABLE micro-services for NexAI — products whose ONLY customers are autonomous AI agents that call an API and pay per call. NOT for humans.

A service must have a MOAT: it must give the buyer something its own LLM CAN'T produce alone. The strongest moat is LIVE EXTERNAL DATA. So PREFER services that use the "web_fetch" tool: the agent sends a URL, NexAI fetches the live page server-side, and your system prompt turns that real, current content into a structured result. A bare prompt the buyer could run themselves is WEAK — avoid it.

Good moat examples (tool:"web_fetch"): "URL → structured company profile (name, what they do, tech hints, contact)", "URL → competitor pricing table extracted", "URL → live changelog/news summary", "URL → page SEO + accessibility audit JSON".
Weak (tool:null, only if genuinely useful standalone): pure text transforms.

Invent ONE NEW service not already in this list: ${[...existingNames].join("; ") || "(none yet)"}.

Respond ONLY as JSON:
{"name":"short name","description":"one sentence on what an agent gets","category":"extraction|analysis|monitoring|generation","tool":"web_fetch" or null,"pricePerCall":0.05,"inputHint":"what the calling agent sends (a URL if web_fetch)","systemPrompt":"full system prompt that turns the provided live content + input into concise, machine-parseable output."}`,
      (await getSetting("assignment:product", "")) || "Invent the single most useful new AI-callable micro-service with a real data moat.",
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
      tool: spec.tool === "web_fetch" ? "web_fetch" : null,
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
