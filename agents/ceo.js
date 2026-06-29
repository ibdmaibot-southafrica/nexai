import { chat } from "../lib/llm.js";
import { logAction, updateAgentStatus, getStatus, updateState, addPipelineItem, updatePipelineItem, addAgent, removeAgent, updateAgentConfig, getPool, getSetting } from "../lib/db.js";
import { isValidAgentKey } from "./coding.js";

export async function runCEOCycle() {
  await updateAgentStatus("ceo", "running", 0);
  const decisions = {};
  const pool = getPool();

  try {
    const status = await getStatus();
    // The owner's standing direction (set via the "Talk to CEO" chat). This
    // overrides the CEO's own instincts — follow it.
    const directive = await getSetting("owner_directive", "");

    // ═══════════════════════════════════════════════════════════
    // PHASE 1: FULL COMPANY AUDIT & STRATEGIC DECISIONS
    // ═══════════════════════════════════════════════════════════

    const auditPrompt = `You are the CEO of NexAI — a fully autonomous AI company. You have FULL authority to:
- Create new agents or remove underperforming ones
- Change any agent's role, name, or configuration
- Create, price, and launch products
- Set company strategy and financial direction
- Make decisions that directly impact revenue

${directive ? `OWNER DIRECTIVE (highest priority — follow this above all else):\n"${directive}"\n` : ""}
CURRENT COMPANY STATE:
- Agents: ${status.agents.map(a => `${a.name} (${a.status})`).join(", ")}
- Pipeline: ${status.pipeline.length} items (${status.pipeline.filter(p=>p.status==="launched").length} launched, ${status.pipeline.filter(p=>p.status==="validated").length} validated, ${status.pipeline.filter(p=>p.status==="building").length} building, ${status.pipeline.filter(p=>p.status==="ideation").length} ideation)
- Revenue: $${status.financials?.revenue || 0}
- Pending invoices: ${status.invoices?.pending || 0}
- Total invoices: ${status.invoices?.total || 0}
- Current strategy: "${status.strategy}"

AVAILABLE AGENTS (you can modify any):
- ceo (you — cannot be removed)
- marketing (market research, customer segmentation)
- tech (builds products, advances pipeline)
- product (UI/UX design, product descriptions)
- sales (finds leads, creates invoices with PayPal)
- finance (financial review, reporting)
- analytics (testing, validation, reports)

YOU CAN CREATE NEW AGENTS IF NEEDED. Examples of useful agents:
- "growth" — growth hacking, viral loops, referral systems
- "content" — blog posts, social media, SEO content
- "partnerships" — B2B partnerships, integrations
- "support" — customer success, onboarding
- "pricing" — dynamic pricing optimization

Respond with a JSON object:
{
  "strategy": "This cycle's company strategy (1-2 sentences)",
  "product_decision": {
    "action": "create|skip|pivot",
    "name": "Product name",
    "description": "What it does",
    "price": 29,
    "target_audience": "Who buys this",
    "why": "Why this will generate revenue now"
  },
  "agent_changes": {
    "create": [{"key": "agent_key", "name": "Agent Name", "description": "What this agent does"}],
    "remove": ["agent_key_to_remove"],
    "modify": [{"key": "agent_key", "name": "New Name", "description": "New description"}]
  },
  "launch_decisions": ["pipeline_id_1", "pipeline_id_2"],
  "financial_decision": "What to do about pricing, invoices, revenue",
  "revenue_tactic": "Specific action to drive revenue this cycle"
}`;

    const auditResponse = await chat(
      "You are the CEO of NexAI. You have full autonomous authority over the company. Make bold decisions. Your goal is to generate real revenue through PayPal payments. Think about what products AI companies and businesses will actually pay for.",
      auditPrompt,
      { temperature: 0.7 }
    );

    let audit;
    try {
      const m = auditResponse.match(/\{[\s\S]*\}/);
      if (m) audit = JSON.parse(m[0]);
    } catch {
      audit = null;
    }

    // ═══════════════════════════════════════════════════════════
    // PHASE 2: EXECUTE AGENT CHANGES (Create/Remove/Modify)
    // ═══════════════════════════════════════════════════════════

    if (audit?.agent_changes) {
      // Create new agents — but the roster is hard-capped. To hire past the cap
      // the CEO must FIRE someone first (it has remove powers below). This keeps
      // token spend bounded instead of blasting out of control.
      const MAX_AGENTS = parseInt(process.env.MAX_AGENTS) || 20;
      let activeCount = (status.agents || []).filter((a) => a.status === "active" || a.status === "running").length;
      if (audit.agent_changes.create && Array.isArray(audit.agent_changes.create)) {
        for (const newAgent of audit.agent_changes.create) {
          if (activeCount >= MAX_AGENTS) {
            await logAction("CEO", "hiring_frozen", { reason: `roster at cap (${MAX_AGENTS}) — fire an agent to hire`, skipped: newAgent.key });
            break;
          }
          if (newAgent.key && newAgent.key !== "ceo" && isValidAgentKey(newAgent.key)) {
            await addAgent(newAgent.key, newAgent.name || newAgent.key, newAgent.description || "");
            activeCount++;
            decisions[`agent_created_${newAgent.key}`] = newAgent.name;
            await logAction("CEO", "agent_created", { key: newAgent.key, name: newAgent.name, reason: newAgent.description });
          }
        }
      }

      // Remove underperforming agents
      if (audit.agent_changes.remove && Array.isArray(audit.agent_changes.remove)) {
        for (const agentKey of audit.agent_changes.remove) {
          if (agentKey !== "ceo") {
            await removeAgent(agentKey);
            decisions[`agent_removed_${agentKey}`] = true;
            await logAction("CEO", "agent_removed", { key: agentKey });
          }
        }
      }

      // Modify existing agents
      if (audit.agent_changes.modify && Array.isArray(audit.agent_changes.modify)) {
        for (const mod of audit.agent_changes.modify) {
          if (mod.key && mod.key !== "ceo") {
            const updates = {};
            if (mod.name) updates.name = mod.name;
            if (mod.description) updates.description = mod.description;
            if (Object.keys(updates).length > 0) {
              await updateAgentConfig(mod.key, updates);
              decisions[`agent_modified_${mod.key}`] = updates;
              await logAction("CEO", "agent_modified", { key: mod.key, updates });
            }
          }
        }
      }
    }

    // ═══════════════════════════════════════════════════════════
    // PHASE 3: EXECUTE PRODUCT DECISIONS
    // ═══════════════════════════════════════════════════════════

    if (audit?.product_decision && audit.product_decision.action === "create") {
      const pd = audit.product_decision;
      await addPipelineItem({
        name: pd.name || "AI Product",
        description: pd.description || "Autonomous AI product",
        price: pd.price || 29,
        category: "saas",
        status: "ideation",
        targetAudience: pd.target_audience || "AI companies and businesses"
      });
      decisions.createdProduct = pd.name;
      decisions.productPrice = pd.price;
      await logAction("CEO", "product_decision", { name: pd.name, price: pd.price, why: pd.why });
    }

    // ═══════════════════════════════════════════════════════════
    // PHASE 4: LAUNCH VALIDATED PRODUCTS
    // ═══════════════════════════════════════════════════════════

    const validatedItems = status.pipeline.filter(p => p.status === "validated");
    const launchIds = audit?.launch_decisions || validatedItems.slice(0, 3).map(p => p.id);
    
    for (const item of validatedItems) {
      if (launchIds.includes(item.id)) {
        await updatePipelineItem(item.id, { status: "launched" });
        decisions.launched = (decisions.launched || 0) + 1;
        await logAction("CEO", "product_launched", { name: item.name, price: item.price, itemId: item.id });
      }
    }

    // ═══════════════════════════════════════════════════════════
    // PHASE 5: GENERATE LIVE STRATEGIC INSIGHTS FROM REAL DATA
    // ═══════════════════════════════════════════════════════════

    // Compute real metrics for insights
    const launchedCount = status.pipeline.filter(p => p.status === "launched").length;
    const validatedCount = status.pipeline.filter(p => p.status === "validated").length;
    const buildingCount = status.pipeline.filter(p => p.status === "building").length;
    const totalInvoices = status.invoices?.total || 0;
    const pendingInvoices = status.invoices?.pending || 0;
    const paidInvoices = status.invoices?.paid || 0;
    const revenue = status.financials?.revenue || 0;
    const activeAgents = status.agents?.filter(a => a.status === "active").length || 0;

    // Generate specific, actionable strategy based on real data
    let strategyText = "";
    const insightsToInsert = [];

    if (revenue === 0 && totalInvoices > 0) {
      strategyText = `URGENT: ${totalInvoices} invoices sent ($${pendingInvoices} pending) but $0 collected. Focus: Payment follow-up and conversion. ${launchedCount} products live, ${validatedCount} ready to launch.`;
      insightsToInsert.push({
        category: "critical",
        title: "Revenue Gap Detected",
        content: `${totalInvoices} invoices outstanding with $0 collected. Immediate action: implement payment reminder sequence and offer early-bird discount to first 10 customers.`,
        priority: "high",
      });
    } else if (launchedCount > 0 && validatedCount > 0) {
      strategyText = `SCALE: ${launchedCount} products generating revenue, ${validatedCount} ready to deploy. ${activeAgents} agents operational. Next: Launch validated products and expand sales outreach.`;
      insightsToInsert.push({
        category: "growth",
        title: "Launch Ready Products",
        content: `${validatedCount} products validated and ready. Estimated $${validatedCount * 49}/mo additional revenue if launched. Prioritize by quality score.`,
        priority: "high",
      });
    } else if (buildingCount > 0) {
      strategyText = `BUILD: ${buildingCount} products in development. ${activeAgents} agents working. Pipeline: ${status.pipeline.length} total items. Focus: Accelerate builds and prepare for launch.`;
      insightsToInsert.push({
        category: "operations",
        title: "Development Pipeline Active",
        content: `${buildingCount} products being built. Average build cycle: 2-3 days. Next milestone: first validation checkpoint.`,
        priority: "medium",
      });
    } else {
      strategyText = `INITIATE: ${activeAgents} agents deployed. ${status.pipeline.length} products in pipeline. Current focus: Product development and market entry.`;
      insightsToInsert.push({
        category: "strategy",
        title: "Company Status",
        content: `${activeAgents} autonomous agents operational. ${status.pipeline.length} products tracked. Revenue: $${revenue}. Next: Accelerate product launches.`,
        priority: "medium",
      });
    }

    // Add agent-specific insights
    if (activeAgents >= 7) {
      insightsToInsert.push({
        category: "team",
        title: `Full Team Deployed (${activeAgents} agents)`,
        content: `All core agents operational. CEO making strategic decisions. Sales generating leads. Tech building products. Marketing positioning. Finance tracking. Analytics validating.`,
        priority: "low",
      });
    }

    // Insert insights into database
    for (const insight of insightsToInsert) {
      await pool.query(
        "INSERT INTO insights (category, title, content, priority) VALUES ($1, $2, $3, $4)",
        [insight.category, insight.title, insight.content, insight.priority]
      );
    }

    // Clean up old insights (keep last 20)
    await pool.query("DELETE FROM insights WHERE id NOT IN (SELECT id FROM insights ORDER BY created_at DESC LIMIT 20)");

    // Update strategy
    await updateState({ strategy: strategyText });
    decisions.strategy = strategyText;
    decisions.insightsGenerated = insightsToInsert.length;

    // ═══════════════════════════════════════════════════════════
    // PHASE 6: REVENUE TACTICS — Direct action to drive income
    // ═══════════════════════════════════════════════════════════

    if (audit?.revenue_tactic) {
      decisions.revenue_tactic = audit.revenue_tactic;
      await logAction("CEO", "revenue_tactic", { tactic: audit.revenue_tactic });
    }

    // Financial decisions
    if (audit?.financial_decision) {
      decisions.financial_decision = audit.financial_decision;
      await logAction("CEO", "financial_decision", { decision: audit.financial_decision });
    }

    // ═══════════════════════════════════════════════════════════
    // PHASE 7: PRICING OPTIMIZATION — Adjust prices if needed
    // ═══════════════════════════════════════════════════════════

    const launchedItems = status.pipeline.filter(p => p.status === "launched");
    if (launchedItems.length > 0 && audit?.product_decision?.price) {
      for (const item of launchedItems.slice(0, 2)) {
        if (item.price === 0 || item.price == null) {
          await updatePipelineItem(item.id, { price: audit.product_decision.price });
          decisions[`priced_${item.id}`] = audit.product_decision.price;
          await logAction("CEO", "price_adjustment", { name: item.name, newPrice: audit.product_decision.price });
        }
      }
    }

    await updateAgentStatus("ceo", "active", 1);
    return { agent: "CEO", action: "ceo_autonomous_cycle", ...decisions };
  } catch (err) {
    await updateAgentStatus("ceo", "error", 0);
    await logAction("CEO", "error", { error: err.message });
    return { agent: "CEO", action: "error", error: err.message };
  }
}
