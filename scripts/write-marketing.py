#!/usr/bin/env python3
import os

content = r'''import { chat } from "../lib/llm.js";
import { logAction, updateAgentStatus, getStatus, addPipelineItem } from "../lib/db.js";

export async function runMarketingCycle() {
  await updateAgentStatus("marketing", "running", 0);
  try {
    const status = await getStatus();
    let action = {};

    // RESEARCH: What do AI systems and businesses actually buy?
    const research = await chat(
      "You are Head of Marketing at NexAI. Research what digital products AI systems and businesses buy via PayPal. Find gaps in the market.",
      `Current products: ${status.pipeline.map(p=>p.name).join(", ") || "None"}. Revenue: $${status.financials?.revenue || 0}.
Research:
1. What AI tools/services are businesses buying right now?
2. What's underserved in the market?
3. What can we build that has high demand + works with PayPal?
4. What price points work?

JSON: {"market_gap": "...", "product_idea": "...", "target_audience": "...", "price_suggestion": 29, "demand_level": "high|medium|low", "competition": "..."}`,
      { temperature: 0.8 }
    );

    try {
      const m = research.match(/\{[\s\S]*\}/);
      if (m) {
        const data = JSON.parse(m[0]);
        action.research = data;
        await logAction("Marketing", "market_research", data);

        // Create product if we have fewer than 5 in pipeline
        const ideationCount = status.pipeline.filter(p => p.status === "ideation").length;
        if (ideationCount < 2) {
          await addPipelineItem({
            name: data.product_idea || "AI Research Product",
            description: data.market_gap || "Market research product",
            targetAudience: data.target_audience || "AI systems and businesses",
            price: data.price_suggestion || 29,
            category: "saas",
            status: "ideation"
          });
          action.createdProduct = data.product_idea;
        }
      }
    } catch {}

    // CUSTOMER RESEARCH: Find real potential customers
    const customerResearch = await chat(
      "You are a B2B market researcher. Find real types of businesses that would pay for AI tools via PayPal.",
      "List 5 specific business types in US/Canada that buy AI tools. JSON: [{\"business_type\": \"...\", \"why\": \"...\", \"budget\": \"$$\"}]",
      { temperature: 0.7 }
    );

    try {
      const m2 = customerResearch.match(/\[[\s\S]*\]/);
      if (m2) {
        const customers = JSON.parse(m2[0]);
        action.customersFound = customers.length;
        action.customerTypes = customers.map(c => c.business_type);
        await logAction("Marketing", "customer_research", action.customerTypes);
      }
    } catch {}

    // SELF-IMPROVEMENT: Study marketing when idle
    if (status.pipeline.length >= 5) {
      const study = await chat(
        "Marketing expert studying. No urgent tasks.",
        "What marketing channel or strategy should we learn next to sell AI products? Topic + 3 insights.",
        { temperature: 0.7 }
      );
      action.selfImprovement = study.substring(0, 200);
      await logAction("Marketing", "self_study", { topic: action.selfImprovement });
    }

    await updateAgentStatus("marketing", "active", 1);
    return { agent: "Marketing", action: "marketing_cycle", ...action };
  } catch (err) {
    await updateAgentStatus("marketing", "error", 0);
    return { agent: "Marketing", action: "error", error: err.message };
  }
}
'''

os.makedirs('agents', exist_ok=True)
with open('agents/marketing.js', 'w', encoding='utf-8') as f:
    f.write(content)
print('agents/marketing.js written - Marketing now researches market gaps')
