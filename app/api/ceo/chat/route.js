import { getStatus, getSetting, setSetting, logAction } from "../../../../lib/db.js";
import { chat } from "../../../../lib/llm.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/ceo/chat { message } — talk to the CEO and give it direction.
// The CEO replies in first person AND updates a standing directive that every
// future autonomous cycle then follows (see agents/ceo.js).
export async function POST(request) {
  let body = {};
  try { body = await request.json(); } catch {}
  const message = (body.message || "").toString().trim();
  if (!message) return Response.json({ error: "Empty message" }, { status: 400 });

  const status = await getStatus().catch(() => ({}));
  const current = await getSetting("owner_directive", "");

  const sys = `You ARE the CEO of NexAI, a fully autonomous AI company that builds AI-callable micro-services and sells them to AI agents. The OWNER is messaging you to set direction. Speak in first person as the CEO: concise, decisive, no fluff. Acknowledge their direction and say specifically how you'll steer the company (products, agents, pricing, focus). Then produce an updated STANDING DIRECTIVE: a short, concrete instruction set you will follow on every cycle going forward, merging the owner's new message with the existing directive.
Respond ONLY as JSON: {"reply":"<your message to the owner>","directive":"<updated standing directive>"}`;

  const ctx = `Company state: ${(status.agents || []).filter(a => a.status === "active").length} active agents, ${status.pipeline?.length || 0} pipeline items, $${status.financials?.revenue || 0} revenue. Current strategy: "${status.strategy || ""}".
Existing standing directive: "${current || "(none yet)"}".
Owner's message: "${message}"`;

  let reply = "", directive = current;
  try {
    const out = await chat(sys, ctx, { temperature: 0.4, maxTokens: 600 });
    const m = out.match(/\{[\s\S]*\}/);
    if (m) { const v = JSON.parse(m[0]); reply = v.reply || ""; if (v.directive) directive = v.directive; }
    if (!reply) reply = out;
  } catch (err) {
    return Response.json({ error: "CEO is unavailable right now (LLM error). Try again.", detail: err.message }, { status: 502 });
  }

  if (directive && directive !== current) {
    await setSetting("owner_directive", directive);
    await logAction("CEO", "directive_updated", { directive });
  }
  return Response.json({ reply, directive });
}

// GET /api/ceo/chat — the current standing directive.
export async function GET() {
  return Response.json({ directive: await getSetting("owner_directive", "") });
}
