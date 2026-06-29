/**
 * Tools that give products a moat — data the buyer's bare LLM can't produce.
 * web_fetch pulls a live page server-side (with an SSRF guard) so a NexAI service
 * can return fresh, real-world data, not just model knowledge.
 */

function isBlockedHost(host) {
  const h = (host || "").toLowerCase();
  if (!h || h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) return true;
  // Block obvious private / loopback / link-local / metadata addresses.
  if (/^(127\.|10\.|169\.254\.|192\.168\.|::1|0\.0\.0\.0)/.test(h)) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(h)) return true;
  if (h === "169.254.169.254" || h === "metadata.google.internal") return true; // cloud metadata
  return false;
}

// Fetch a URL safely and return readable text (HTML stripped, capped).
export async function webFetch(rawUrl) {
  let url;
  try { url = new URL(rawUrl); } catch { throw new Error("invalid URL"); }
  if (!/^https?:$/.test(url.protocol)) throw new Error("only http(s) URLs allowed");
  if (isBlockedHost(url.hostname)) throw new Error("blocked host");

  const res = await fetch(url.toString(), {
    redirect: "follow",
    signal: AbortSignal.timeout(12000),
    headers: { "User-Agent": "NexAI-Service/1.0 (+https://vercel-app-sigma-teal.vercel.app)" },
  });
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`);

  const buf = await res.arrayBuffer();
  let text = Buffer.from(buf.slice(0, 600_000)).toString("utf8"); // cap ~600KB
  // Rough HTML -> text.
  text = text
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, 12000); // feed a bounded amount to the model
}

// Extract the first URL from a string (buyers may send a sentence or a bare URL).
export function firstUrl(input) {
  const m = (input || "").match(/https?:\/\/[^\s"'<>]+/i);
  return m ? m[0] : (input || "").trim();
}
