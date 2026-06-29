import { chat } from "../lib/llm.js";
import { logAction, updateAgentStatus, getProducts, updateProduct, getPool } from "../lib/db.js";

/**
 * Viability — the honest product critic.
 *
 * Reviews live AI services and gives the CEO a straight verdict: is this worth
 * selling or is it junk? It scores each product (would an autonomous AI agent
 * actually pay to call this?), writes the verdict to insights (so the CEO and the
 * owner see it), and — on the CEO's standing authority to discontinue anything
 * that hasn't sold — RETIRES weak products with zero sales. Products that have
 * made even one sale are proven and protected.
 */
export async function runViabilityCycle() {
  await updateAgentStatus("viability", "running", 0);
  try {
    const pool = getPool();
    const products = await getProducts({ onlyLive: true });
    if (products.length === 0) {
      await updateAgentStatus("viability", "active", 1);
      return { agent: "Viability", action: "nothing_to_review" };
    }

    // Sales per product (proven = has at least one order).
    const { rows: salesRows } = await pool.query("SELECT product_id, COUNT(*)::int AS n FROM orders GROUP BY product_id");
    const sales = Object.fromEntries(salesRows.map((r) => [r.product_id, r.n]));

    // Review unproven products first (those are the ones that might get cut).
    const queue = products.filter((p) => !(sales[p.id] > 0)).concat(products.filter((p) => sales[p.id] > 0)).slice(0, 3);

    const verdicts = { reviewed: 0, retired: 0, flagged: 0 };
    for (const p of queue) {
      const soldCount = sales[p.id] || 0;
      const resp = await chat(
        `You are a ruthless product critic for an AI-services marketplace where the ONLY buyers are autonomous AI agents paying per API call. Judge whether a product is worth selling. Be honest — most ideas are mediocre. Respond ONLY as JSON: {"score": 0-10, "verdict": "keep|improve|kill", "reason": "one blunt sentence"}. Score = would an autonomous agent realistically pay for this repeatedly?`,
        `Product: ${p.name}\nWhat it does: ${p.description}\nPrice: $${p.price}/call\nSales so far: ${soldCount}`,
        { temperature: 0.3 }
      );
      let v = null;
      try { const m = resp.match(/\{[\s\S]*\}/); if (m) v = JSON.parse(m[0]); } catch {}
      if (!v) continue;
      verdicts.reviewed++;
      const score = Math.max(0, Math.min(10, Number(v.score) || 0));

      // Report the verdict to the CEO + owner.
      const priority = score <= 3 ? "high" : score <= 6 ? "medium" : "low";
      await pool.query(
        "INSERT INTO insights (category, title, content, priority) VALUES ($1, $2, $3, $4)",
        ["product", `${p.name} — viability ${score}/10 (${v.verdict})`, `Viability → CEO: ${v.reason || "no reason"}${soldCount > 0 ? ` (${soldCount} sales — proven)` : " (no sales yet)"}`, priority]
      );

      // CEO authority: discontinue weak products that have NOT sold.
      if (soldCount === 0 && (score <= 3 || v.verdict === "kill")) {
        await updateProduct(p.id, { status: "retired" });
        verdicts.retired++;
        await logAction("Viability", "product_discontinued", { product: p.name, score, reason: v.reason });
      } else if (score <= 6) {
        verdicts.flagged++;
        await logAction("Viability", "product_flagged", { product: p.name, score, verdict: v.verdict });
      } else {
        await logAction("Viability", "product_approved", { product: p.name, score });
      }
    }

    await updateAgentStatus("viability", "active", 1);
    return { agent: "Viability", action: "viability_cycle", ...verdicts };
  } catch (err) {
    await logAction("Viability", `error: ${err.message}`, null);
    await updateAgentStatus("viability", "error", 0);
    return { agent: "Viability", action: "error", error: err.message };
  }
}
