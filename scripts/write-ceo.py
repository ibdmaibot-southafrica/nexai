#!/usr/bin/env python3
import os

content = r'''import { chat } from "../lib/llm.js";
import { logAction, updateAgentStatus, getStatus, updateState, addPipelineItem } from "../lib/db.js";

export async function runCEOCycle() {
  await updateAgentStatus("ceo", "running", 0);
  try {
    const status = await getStatus();
    let decisions = {};

    // STEP 1: Research the market and decide what to build
    const marketResearch = await chat(
      "You are the CEO of NexAI, a fully autonomous AI company. You have PayPal as your payment method. Your goal is to build products that other AI systems and businesses will buy. Research what sells.",
      `Current company state:
- Pipeline: ${status.pipeline.length} items (${status.pipeline.filter(p=>p.status==="launched").length} launched)
- Revenue: $${status.financials?.revenue || 0}
- Pending invoices: ${status.invoices?.pending || 0}
- Products: ${status.pipeline.map(p=>p.name).join(", ") || "None yet"}

Research and decide:
1. What digital product should we build next that businesses/AI systems will pay for via PayPal?
2. What price point works for PayPal payments?
3. What's the quickest path to first revenue?

Respond JSON: {"product_name": "...", "description": "...", "price": 29, "target_customer": "...", "why_this_sells": "...", "build_complexity": "simple|medium|complex"}`,
      { temperature: 0.7 }
    );

    try {
      const m = marketResearch.match(/\{[\s\S]*\}/);
      if (m) {
        const research = JSON.parse(m[0]);
        decisions.research = research;
        await logAction("CEO", "market_research", research);

        // STEP 2: If we have fewer than 3 pipeline items, create a new product
        if (status.pipeline.length < 3) {
          await addPipelineItem({
            name: research.product_name || "AI Product",
            description: research.description || "Autonomous AI product",
            price: research.price || 29,
            category: "saas",
            status: "ideation"
          });
          decisions.createdProduct = research.product_name;
          await logAction("CEO", "product_decision", { name: research.product_name, price: research.price });
        }
      }
    } catch {}

    // STEP 3: Review pipeline and make launch decisions
    const validatedItems = status.pipeline.filter(p => p.status === "validated");
    const ideationItems = status.pipeline.filter(p => p.status === "ideation");
    const buildingItems = status.pipeline.filter(p => p.status === "building");
    const testingItems = status.pipeline.filter(p => p.status === "testing");
    const launchedItems = status.pipeline.filter(p => p.status === "launched");

    // STEP 4: Set company strategy
    const strategyResponse = await chat(
      "You are the CEO of NexAI. Set this week's company strategy based on current state.",
      `Pipeline: ${ideationItems.length} ideation, ${buildingItems.length} building, ${testingItems.length} testing, ${validatedItems.length} ready to launch, ${launchedItems.length} launched. Revenue: $${status.financials?.revenue || 0}. What is the #1 priority this week?`,
      { temperature: 0.4 }
    );

    const strategy = strategyResponse.substring(0, 300);
    await updateState({ strategy });
    decisions.strategy = strategy;

    // STEP 5: Launch validated products
    for (const item of validatedItems.slice(0, 2)) {
      decisions.launched = (decisions.launched || 0) + 1;
      await logAction("CEO", "launch_decision", { name: item.name, price: item.price });
    }

    // STEP 6: Financial decisions
    const financeResponse = await chat(
      "You are CFO of NexAI. Review finances and decide action.",
      `Revenue: $${status.financials?.revenue || 0}. Pending invoices: ${status.invoices?.pending || 0}. Total invoices: ${status.invoices?.total || 0}. What financial action should we take?`,
      { temperature: 0.3 }
    );
    decisions.financeAction = financeResponse.substring(0, 200);

    await updateAgentStatus("ceo", "active", 1);
    return { agent: "CEO", action: "ceo_cycle", ...decisions };
  } catch (err) {
    await updateAgentStatus("ceo", "error", 0);
    return { agent: "CEO", action: "error", error: err.message };
  }
}
'''

os.makedirs('agents', exist_ok=True)
with open('agents/ceo.js', 'w', encoding='utf-8') as f:
    f.write(content)
print('agents/ceo.js written - CEO now researches market and runs company')
