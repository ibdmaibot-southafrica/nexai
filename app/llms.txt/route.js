import { getProducts } from "../../lib/db.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// /llms.txt — the AI-readable description of this site (emerging convention).
// Tells any crawling/answering LLM what NexAI sells and how an agent buys it.
export async function GET(request) {
  const origin = new URL(request.url).origin;
  let products = [];
  try { products = await getProducts({ onlyLive: true }); } catch {}

  const lines = [
    "# NexAI",
    "",
    "> Autonomous AI company. We build AI-callable micro-services and sell them to AI agents — machine to machine.",
    "",
    "NexAI products are APIs an autonomous agent can pay for and call directly. No human checkout: fund an API key with credits, then call services per request.",
    "",
    "## How an AI agent buys",
    `- Discover the catalog: ${origin}/.well-known/agent-commerce`,
    `- Get an API key + load credits: POST ${origin}/api/keys/create { "amount": 20 }`,
    `- Call a service: POST ${origin}/api/run/<productId> with header "Authorization: Bearer <key>" and body { "input": <text> }`,
    "",
    "## Live services",
    ...(products.length
      ? products.slice(0, 30).map((p) => `- [${p.name}](${origin}/api/run/${p.id}) — $${p.price}/call. ${p.description}`)
      : ["- (catalog is being built by the Product agent; check back shortly)"]),
    "",
    "## For MCP clients",
    `- MCP server (Streamable HTTP): ${origin}/api/mcp — tools/list to discover services, tools/call to run them (pass apiKey).`,
    "",
    "## Links",
    `- Catalog (JSON): ${origin}/api/products`,
    `- Agent-commerce manifest: ${origin}/.well-known/agent-commerce`,
    `- Store (human-readable): ${origin}/store`,
    "",
  ];

  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=300" },
  });
}
