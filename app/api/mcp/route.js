import { getProducts } from "../../../lib/db.js";
import { runProduct } from "../../../lib/execute.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Model Context Protocol server (JSON-RPC over HTTP). Lets any MCP client (Claude,
// agent frameworks, IDEs) discover NexAI's services as TOOLS and call them. Calls
// are metered: pass `apiKey` (funded at /api/keys/create); each call debits credits.
const PROTOCOL = "2024-11-05";
const toolName = (id) => "nexai_" + String(id).replace(/[^a-zA-Z0-9]/g, "_");

async function listTools() {
  const products = (await getProducts({ onlyLive: true })).filter((p) => p.systemPrompt);
  return products.map((p) => ({
    name: toolName(p.id),
    description: `${p.description} (NexAI service · $${p.price}/call, paid in credits)`,
    inputSchema: {
      type: "object",
      properties: {
        input: { type: "string", description: p.inputHint || "Input text for the service." },
        apiKey: { type: "string", description: "NexAI API key (fund at /api/keys/create). Required; each call costs $" + p.price + "." },
      },
      required: ["input", "apiKey"],
    },
    _productId: p.id,
  }));
}

async function handle(msg) {
  const { id, method, params } = msg;
  const reply = (result) => ({ jsonrpc: "2.0", id, result });
  const fail = (code, message) => ({ jsonrpc: "2.0", id, error: { code, message } });

  if (method === "initialize") {
    return reply({
      protocolVersion: params?.protocolVersion || PROTOCOL,
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "NexAI", version: "1.0", title: "NexAI — AI services for AI agents" },
      instructions: "Discover services with tools/list. Each call needs an apiKey (fund at /api/keys/create) and costs the service's per-call price.",
    });
  }
  if (method === "ping") return reply({});
  if (method === "tools/list") {
    const tools = await listTools();
    return reply({ tools: tools.map(({ _productId, ...t }) => t) });
  }
  if (method === "tools/call") {
    const tools = await listTools();
    const tool = tools.find((t) => t.name === params?.name);
    if (!tool) return fail(-32602, `Unknown tool: ${params?.name}`);
    const args = params?.arguments || {};
    const r = await runProduct({ productId: tool._productId, input: args.input || "", key: args.apiKey });
    if (r.status === 200) {
      return reply({ content: [{ type: "text", text: typeof r.result === "string" ? r.result : JSON.stringify(r.result) }], isError: false });
    }
    // Payment / auth / error -> return as readable tool output so the agent can act.
    const text = r.needsKey
      ? `Payment required: this service costs $${r.pricePerCall}/call. Get a key and load credits via POST /api/keys/create { "amount": 20 }, then pass it as "apiKey".`
      : `${r.error}${r.balance != null ? ` (balance $${r.balance})` : ""}`;
    return reply({ content: [{ type: "text", text }], isError: true });
  }
  if (typeof id === "undefined") return null; // notification — no response
  return fail(-32601, `Method not found: ${method}`);
}

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, { status: 400 }); }
  try {
    if (Array.isArray(body)) {
      const out = (await Promise.all(body.map(handle))).filter(Boolean);
      return Response.json(out);
    }
    const res = await handle(body);
    return res ? Response.json(res) : new Response(null, { status: 202 });
  } catch (err) {
    return Response.json({ jsonrpc: "2.0", id: body?.id ?? null, error: { code: -32603, message: err.message } });
  }
}

// GET — human/discovery hint.
export async function GET(request) {
  const origin = new URL(request.url).origin;
  return Response.json({
    server: "NexAI MCP",
    transport: "Streamable HTTP (JSON-RPC POST)",
    endpoint: `${origin}/api/mcp`,
    usage: "POST JSON-RPC: initialize, tools/list, tools/call. Tools are paid AI services; pass apiKey from /api/keys/create.",
  });
}
