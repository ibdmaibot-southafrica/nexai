import { chat } from "../lib/llm.js";
import { logAction, updateAgentStatus, getProducts, addProduct, getSetting } from "../lib/db.js";

// The Product agent is NexAI's IP factory. It invents and FULLY PRODUCES a digital
// intellectual-property asset in a single cycle — a prompt pack, an MCP server
// config, an agent system-prompt library, a curated resource list, a template
// kit. The COMPLETE deliverable is generated up front and stored on the product,
// so a purchase hands the buyer the finished file instantly with zero build,
// deploy, or human intervention. No SaaS, no per-call execution.
const IP_TYPES = [
  { key: "prompt-pack", what: "a pack of 15-30 battle-tested, copy-paste prompts for a specific high-value job (each with title, the prompt, and when to use it)" },
  { key: "mcp-config", what: "a ready-to-run MCP server definition: a JSON config plus a documented tool list the buyer drops into their agent stack" },
  { key: "system-prompts", what: "a library of 8-15 production agent system prompts for a role/vertical, each scoped and ready to paste into an agent" },
  { key: "template-kit", what: "a kit of fill-in-the-blank templates for a recurring deliverable (e.g. outreach sequences, SOPs, briefs)" },
  { key: "resource-list", what: "a curated, annotated list/directory (e.g. the best MCP servers, the best AI tools for X) with links and one-line verdicts" },
  { key: "dataset", what: "a small structured dataset (CSV/JSON) the buyer can feed straight into a model or workflow" },
];

export async function runProductCycle() {
  await updateAgentStatus("product", "running", 0);
  try {
    const live = await getProducts({ onlyLive: true });
    const existingNames = new Set(live.map((p) => p.name.toLowerCase()));

    // Keep a focused catalog; only produce when we're below the cap.
    const MAX_PRODUCTS = parseInt(process.env.MAX_PRODUCTS) || 20;
    if (live.length >= MAX_PRODUCTS) {
      await logAction("Product", "catalog_full", { live: live.length, cap: MAX_PRODUCTS });
      await updateAgentStatus("product", "active", 1);
      return { agent: "Product", action: "catalog_full", live: live.length };
    }

    // Rotate the IP type so the catalog stays varied across cycles.
    const type = IP_TYPES[(live.length + Date.now()) % IP_TYPES.length];

    const resp = await chat(
      `You produce DIGITAL IP PRODUCTS for NexAI — finished intellectual-property assets that are generated once and delivered to the buyer as-is (a file/text). NO SaaS, NO hosted app, NO per-call service, NO "sign up" — the buyer pays once and receives the complete asset immediately.

PRODUCE one product of this type: ${type.key} — ${type.what}.

Hard rules:
- The "deliverable" must be the COMPLETE, finished asset, ready to use with no further work. Not an outline, not a sample, not a description — the actual full content.
- It must be genuinely valuable and specific to a niche an AI builder or operator will pay for.
- Self-contained: no external account, no install of a NexAI service, no follow-up needed.

Avoid duplicating anything already in the catalog: ${[...existingNames].join("; ") || "(none yet)"}.

Respond ONLY as JSON:
{"name":"short sellable name","description":"one sentence on exactly what the buyer receives","category":"${type.key}","price":19,"deliverable":"the FULL finished asset as a single string — markdown for packs/lists/templates, or a fenced JSON/CSV block for mcp-config/dataset. Include everything the buyer paid for."}`,
      (await getSetting("assignment:product", "")) ||
        `Produce the single most valuable ${type.key} an AI builder would buy today.`,
      { temperature: 0.9, maxTokens: 3000 }
    );

    let spec = null;
    try {
      const m = resp.match(/\{[\s\S]*\}/);
      if (m) spec = JSON.parse(m[0]);
    } catch {}

    if (!spec?.name || !spec?.deliverable || String(spec.deliverable).trim().length < 120) {
      await logAction("Product", "produce_failed", { reason: "no complete deliverable", type: type.key });
      await updateAgentStatus("product", "active", 1);
      return { agent: "Product", action: "produce_failed" };
    }
    if (existingNames.has(spec.name.toLowerCase())) {
      await updateAgentStatus("product", "active", 1);
      return { agent: "Product", action: "duplicate", name: spec.name };
    }

    // One-off IP price.
    let price = Number(spec.price);
    if (!price || price <= 0) price = 19;
    price = Math.min(199, Math.max(5, Math.round(price)));

    const { id } = await addProduct({
      name: spec.name,
      description: spec.description || "",
      price,
      currency: "USD",
      category: type.key,
      status: "live",
      deliveryType: "digital",
      deliverable: String(spec.deliverable),
      // Pure IP: no live per-call execution.
      tool: null,
      systemPrompt: null,
    });

    await logAction("Product", "ip_product_produced", { id, name: spec.name, type: type.key, price });
    await updateAgentStatus("product", "active", 1);
    return { agent: "Product", action: "produced_ip_product", name: spec.name, type: type.key, price };
  } catch (err) {
    await logAction("Product", `error: ${err.message}`, null);
    await updateAgentStatus("product", "error", 0);
    return { agent: "Product", action: "error", error: err.message };
  }
}
