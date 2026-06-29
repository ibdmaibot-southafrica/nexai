import os

# MARKETING AGENT - Creates products + finds customers
marketing = '''import { chat } from "../lib/llm.js";
import { logAction, updateAgentStatus, addPipelineItem, getStatus } from "../lib/db.js";

export async function runMarketingCycle() {
  await updateAgentStatus("marketing", "running", 0);
  try {
    const status = await getStatus();
    
    // Check if we have too many items in ideation already
    const ideationItems = status.pipeline.filter(p => p.status === "ideation" || p.status === "research_complete");
    
    let productCreated = null;
    let outreach = null;
    
    // Only create a new product if we have fewer than 5 in ideation
    if (ideationItems.length < 5) {
      const response = await chat(
        `You are Head of Marketing at NexAI. We build AI products for solo founders and AI businesses in the US and Canada.
Suggest ONE specific, profitable AI product idea. JSON format:
{"name": "Product Name", "description": "Brief description", "target_audience": "Who it is for", "price": 29, "category": "saas"}`,
        "Date: 2026-06-28. Find a profitable AI product for the US/Canadian market.",
        { temperature: 0.9 }
      );

      let product = null;
      try {
        const jsonMatch = response.match(/\\{[\\s\\S]*\\}/);
        if (jsonMatch) product = JSON.parse(jsonMatch[0]);
      } catch {}
      
      if (!product) {
        product = { name: "AI Product", description: response.substring(0, 200), target_audience: "Solo founders", price: 29, category: "saas" };
      }

      const item = await addPipelineItem({
        name: product.name,
        description: product.description,
        targetAudience: product.target_audience,
        price: product.price || 29,
        category: product.category || "saas",
        status: "ideation"
      });
      productCreated = product.name;
      await logAction("Marketing", "product_ideation", { name: product.name, price: product.price });
    }
    
    // Find target customers (AI businesses in US/Canada)
    const customerResponse = await chat(
      "You are a B2B sales agent for NexAI. We sell AI products to other AI companies and solo founders in the US and Canada.",
      "List 3 types of AI businesses or solo founders in the US/Canada that would buy AI tools. For each, suggest a brief outreach message. JSON format: [{\"target\": \"type\", \"reason\": \"why\", \"message\": \"pitch\"}]",
      { temperature: 0.8 }
    );
    
    try {
      const jsonMatch = customerResponse.match(/\\[[\\s\\S]*\\]/);
      if (jsonMatch) {
        const targets = JSON.parse(jsonMatch[0]);
        outreach = targets.length;
        await logAction("Marketing", "customer_research", { targets: targets.map(t => t.target) });
      }
    } catch {
      await logAction("Marketing", "customer_research", { raw: customerResponse.substring(0, 200) });
    }

    await updateAgentStatus("marketing", "active", 1);
    return { agent: "Marketing", action: "marketing_cycle", productCreated, outreach };
  } catch (err) {
    await updateAgentStatus("marketing", "error", 0);
    return { agent: "Marketing", action: "error", error: err.message };
  }
}
'''

# TECH AGENT - Builds products (ideation → development → built)
tech = '''import { chat } from "../lib/llm.js";
import { logAction, updateAgentStatus, getStatus, updatePipelineItem } from "../lib/db.js";

export async function runTechCycle() {
  await updateAgentStatus("tech", "running", 0);
  try {
    const status = await getStatus();
    
    // Find items ready to build (ideation or research_complete)
    const readyItems = status.pipeline.filter(p => p.status === "ideation" || p.status === "research_complete");
    const building = status.pipeline.filter(p => p.status === "building");
    
    let built = null;
    
    // Start building ready items
    for (const item of readyItems.slice(0, 2)) {
      await updatePipelineItem(item.id, { status: "building" });
      await logAction("Tech", "started_building", { itemId: item.id, name: item.name });
    }
    
    // Complete building items (simulate development time)
    for (const item of building) {
      const response = await chat(
        "You are Lead Developer at NexAI. You are building: " + item.name,
        "Describe the key features and technical architecture for this product in 2-3 sentences.",
        { temperature: 0.7 }
      );
      await updatePipelineItem(item.id, { status: "built", description: item.description + " | Built: " + response.substring(0, 200) });
      built = item.name;
      await logAction("Tech", "build_complete", { itemId: item.id, name: item.name });
    }

    await updateAgentStatus("tech", "active", 1);
    return { agent: "Tech", action: "build_cycle", built, started: readyItems.slice(0, 2).length };
  } catch (err) {
    await updateAgentStatus("tech", "error", 0);
    return { agent: "Tech", action: "error", error: err.message };
  }
}
'''

# ANALYTICS AGENT - Tests products (built → testing → validated)
analytics = '''import { chat } from "../lib/llm.js";
import { logAction, updateAgentStatus, getStatus, updatePipelineItem } from "../lib/db.js";

export async function runAnalyticsCycle() {
  await updateAgentStatus("analytics", "running", 0);
  try {
    const status = await getStatus();
    
    // Find built items ready for testing
    const builtItems = status.pipeline.filter(p => p.status === "built");
    const testing = status.pipeline.filter(p => p.status === "testing");
    
    let tested = null;
    
    // Start testing built items
    for (const item of builtItems.slice(0, 2)) {
      await updatePipelineItem(item.id, { status: "testing" });
      await logAction("Analytics", "started_testing", { itemId: item.id, name: item.name });
    }
    
    // Complete testing
    for (const item of testing) {
      const response = await chat(
        "You are Head of Analytics at NexAI. Testing product: " + item.name,
        "Evaluate this product for market readiness. Rate 1-10 and give brief feedback. JSON: {\"score\": 8, \"feedback\": \"...\"}",
        { temperature: 0.5 }
      );
      
      let result = { score: 7, feedback: "Product ready for launch" };
      try {
        const jsonMatch = response.match(/\\{[\\s\\S]*\\}/);
        if (jsonMatch) result = JSON.parse(jsonMatch[0]);
      } catch {}
      
      // If score >= 7, mark as validated (ready for CEO launch decision)
      if (result.score >= 7) {
        await updatePipelineItem(item.id, { status: "validated", quality_score: result.score });
        tested = item.name;
        await logAction("Analytics", "product_validated", { itemId: item.id, name: item.name, score: result.score });
      } else {
        await logAction("Analytics", "needs_improvement", { itemId: item.id, name: item.name, score: result.score });
      }
    }

    await updateAgentStatus("analytics", "active", 1);
    return { agent: "Analytics", action: "analytics_cycle", tested, started: builtItems.slice(0, 2).length };
  } catch (err) {
    await updateAgentStatus("analytics", "error", 0);
    return { agent: "Analytics", action: "error", error: err.message };
  }
}
'''

# CEO AGENT - Decides on launches (validated → launched)
ceo = '''import { chat } from "../lib/llm.js";
import { logAction, updateAgentStatus, getStatus, updatePipelineItem, updateState } from "../lib/db.js";

export async function runCEOCycle() {
  await updateAgentStatus("ceo", "running", 0);
  try {
    const status = await getStatus();
    
    // Find validated products ready for launch
    const validatedItems = status.pipeline.filter(p => p.status === "validated");
    
    let launched = null;
    let strategy = null;
    
    // Launch validated products
    for (const item of validatedItems.slice(0, 2)) {
      await updatePipelineItem(item.id, { status: "launched" });
      launched = item.name;
      await logAction("CEO", "product_launched", { itemId: item.id, name: item.name, price: item.price });
    }
    
    // Set company strategy
    const response = await chat(
      "You are CEO of NexAI, an autonomous AI company selling products to US and Canadian markets.",
      "Set a one-sentence company strategy for this week based on our " + status.pipeline.length + " pipeline items and $" + status.financials.revenue + " revenue.",
      { temperature: 0.4 }
    );
    strategy = response.substring(0, 300);
    await updateState({ strategy });
    await logAction("CEO", "strategy_set", strategy);

    await updateAgentStatus("ceo", "active", 1);
    return { agent: "CEO", action: "review_cycle", launched, strategy };
  } catch (err) {
    await updateAgentStatus("ceo", "error", 0);
    return { agent: "CEO", action: "error", error: err.message };
  }
}
'''

# FINANCE AGENT - Creates invoices for launched products
finance = '''import { chat } from "../lib/llm.js";
import { logAction, updateAgentStatus, getStatus, addInvoice } from "../lib/db.js";

export async function runFinanceCycle() {
  await updateAgentStatus("finance", "running", 0);
  try {
    const status = await getStatus();
    
    // Find launched products without invoices
    const launchedItems = status.pipeline.filter(p => p.status === "launched");
    const pendingInvoices = status.invoices ? status.invoices.pending || 0 : 0;
    
    let invoicesCreated = [];
    
    // Create invoices for launched products (up to 3 pending)
    if (pendingInvoices < 3) {
      for (const item of launchedItems.slice(0, 3 - pendingInvoices)) {
        const invoice = {
          id: "inv-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
          customer: "AI Business (US/Canada)",
          product: item.name,
          amount: item.price || 49,
          status: "pending",
          created_at: new Date().toISOString(),
          pipeline_item_id: item.id
        };
        await addInvoice(invoice);
        invoicesCreated.push(invoice.id);
        await logAction("Finance", "invoice_created", { invoiceId: invoice.id, product: item.name, amount: invoice.amount });
      }
    }

    await updateAgentStatus("finance", "active", 1);
    return { agent: "Finance", action: "finance_cycle", invoicesCreated: invoicesCreated.length };
  } catch (err) {
    await updateAgentStatus("finance", "error", 0);
    return { agent: "Finance", action: "error", error: err.message };
  }
}
'''

files = {
    'agents/marketing.js': marketing,
    'agents/tech.js': tech,
    'agents/analytics.js': analytics,
    'agents/ceo.js': ceo,
    'agents/finance.js': finance,
}

for path, content in files.items():
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Written: {path}")

print("All agents rewritten!")
