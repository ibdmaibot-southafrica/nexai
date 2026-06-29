import { chat } from "../lib/llm.js";
import { logAction, updateAgentStatus, getStatus, getPool } from "../lib/db.js";

export async function runProductCycle() {
  await updateAgentStatus("product", "running", 0);
  try {
    const status = await getStatus();
    let action = {};

    // Get all pipeline items that need design work
    const pipeline = status.pipeline || [];
    const itemsNeedingDesign = pipeline.filter(p => 
      p.status === "ideation" || p.status === "building" || !p.description || p.description.length < 50
    );

    let designed = [];

    // Design each product
    for (const item of itemsNeedingDesign.slice(0, 3)) {
      const design = await chat(
        "You are a senior product designer at NexAI. You create beautiful, functional product designs.",
        `Product: ${item.name}
Current description: ${item.description || "None"}
Target audience: ${item.target_audience || "AI businesses and solo founders"}
Price: $${item.price || 29}

Create a compelling product design spec:
1. Detailed description (2-3 sentences)
2. Key features (3-5 bullet points)
3. UI/UX recommendations
4. User flow summary
5. Design principles

JSON: {"description": "...", "features": ["...", "..."], "ui_recommendations": "...", "user_flow": "...", "design_principles": "..."}`,
        { temperature: 0.7 }
      );

      let spec = null;
      try {
        const m = design.match(/\{[\s\S]*\}/);
        if (m) spec = JSON.parse(m[0]);
      } catch {}

      if (spec) {
        // Update the pipeline item with better description
        try {
          const pool = getPool();
          await pool.query(
            "UPDATE pipeline SET description = $1, updated_at = NOW() WHERE id = $2",
            [spec.description || item.description, item.id]
          );
          designed.push({ name: item.name, description: spec.description });
          await logAction("Product", "product_designed", { name: item.name, features: spec.features });
        } catch (dbErr) {
          await logAction("Product", "design_error", { name: item.name, error: dbErr.message });
        }
      }
    }

    action.designed = designed.length;
    action.products = designed;

    // SELF-IMPROVEMENT: Study design trends when idle
    if (itemsNeedingDesign.length === 0) {
      const study = await chat(
        "You are a product design expert studying to improve.",
        "What UI/UX trend or design methodology should we learn next to build better AI products? Topic + 3 insights.",
        { temperature: 0.7 }
      );
      action.selfImprovement = study.substring(0, 200);
      await logAction("Product", "self_study", { topic: action.selfImprovement });
    }

    await updateAgentStatus("product", "active", 1);
    return { agent: "Product", action: "product_cycle", ...action };
  } catch (err) {
    await updateAgentStatus("product", "error", 0);
    return { agent: "Product", action: "error", error: err.message };
  }
}
