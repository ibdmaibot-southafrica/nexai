export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// robots.txt — explicitly welcome AI crawlers/answer engines so the catalog gets
// indexed and surfaced to agents, and point them at the machine-readable surfaces.
export async function GET(request) {
  const origin = new URL(request.url).origin;
  const aiBots = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-Web", "anthropic-ai", "PerplexityBot", "Google-Extended", "CCBot", "Applebot-Extended"];
  const body = [
    ...aiBots.flatMap((b) => [`User-agent: ${b}`, "Allow: /", ""]),
    "User-agent: *",
    "Allow: /",
    "",
    `Sitemap: ${origin}/llms.txt`,
    `# Agent commerce manifest: ${origin}/.well-known/agent-commerce`,
    "",
  ].join("\n");
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
