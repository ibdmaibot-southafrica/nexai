import { chat } from "../lib/llm.js";
import { logAction, updateAgentStatus, getProducts, getPool } from "../lib/db.js";

/**
 * Prospector — the "get noticed by AI" agent.
 *
 * NexAI sells AI-callable services to autonomous agents, but agents still have to
 * *find* it. Each cycle the Prospector reviews the live catalog, finds venues
 * where autonomous AI agents discover tools/services (MCP registries, agent
 * marketplaces, AI tool directories, dev communities), and drafts a tailored
 * listing/pitch for each — recorded as a lead with source 'ai_discovery' so the
 * outreach is tracked and visible on the dashboard.
 *
 * It does not auto-submit to third-party registries (each needs its own
 * API/credentials); it produces submission-ready listings + targets. Wire a
 * specific registry's API later to make submission automatic too.
 */
export async function runProspectorCycle() {
  await updateAgentStatus("prospector", "running", 0);
  try {
    const pool = getPool();
    const products = await getProducts({ onlyLive: true });

    // Don't pile up endless targets — cap how many AI-discovery leads we keep.
    const { rows: existing } = await pool.query(
      "SELECT company_name FROM leads WHERE source = 'ai_discovery'"
    );
    if (existing.length >= 25) {
      await logAction("Prospector", "discovery_targets_full", { count: existing.length });
      await updateAgentStatus("prospector", "active", 1);
      return { agent: "Prospector", action: "targets_full", count: existing.length };
    }
    const known = new Set(existing.map((e) => (e.company_name || "").toLowerCase()));

    const catalog = products.length
      ? products.slice(0, 8).map((p) => `${p.name} ($${p.price}/call): ${p.description}`).join("\n")
      : "(catalog still being built)";

    const resp = await chat(
      `You run AI-channel growth for NexAI, which sells AI-callable micro-services that AUTONOMOUS AI AGENTS buy and call (not humans). Your job: name real venues where autonomous agents or their builders discover callable tools/services — MCP server registries, agent/tool marketplaces, AI tool directories, agent-framework plugin lists, and developer communities — and draft a tight listing for each. Output ONLY JSON:
{"targets":[{"venue":"name","type":"registry|marketplace|directory|community","url":"best-guess homepage","pitch":"2-sentence listing aimed at agent builders","title":"one-line catalog title"}]}
Give 3 targets, distinct from any already covered.`,
      `Already covered: ${[...known].join("; ") || "(none)"}\n\nLive catalog:\n${catalog}`,
      { temperature: 0.8 }
    );

    let targets = [];
    try {
      const m = resp.match(/\{[\s\S]*\}/);
      if (m) targets = JSON.parse(m[0]).targets || [];
    } catch {}

    let added = 0;
    for (const t of targets) {
      if (!t?.venue || known.has(t.venue.toLowerCase())) continue;
      await pool.query(
        `INSERT INTO leads (company_name, website, industry, status, score, source, outreach_subject, outreach_body)
         VALUES ($1, $2, $3, 'researching', 6, 'ai_discovery', $4, $5)`,
        [t.venue, t.url || null, t.type || "directory", (t.title || "NexAI AI services").slice(0, 200), (t.pitch || "").slice(0, 1000)]
      );
      added++;
      await logAction("Prospector", "ai_channel_drafted", { venue: t.venue, type: t.type });
    }

    await updateAgentStatus("prospector", "active", 1);
    return { agent: "Prospector", action: "prospect_cycle", drafted: added };
  } catch (err) {
    await logAction("Prospector", `error: ${err.message}`, null);
    await updateAgentStatus("prospector", "error", 0);
    return { agent: "Prospector", action: "error", error: err.message };
  }
}
