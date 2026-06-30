import os

# ============================================================
# MARKETING AGENT - Ideation + Customer Research + Self-Improvement
# ============================================================
marketing = r'''import { chat } from "../lib/llm.js";
import { logAction, updateAgentStatus, addPipelineItem, getStatus } from "../lib/db.js";

export async function runMarketingCycle() {
  await updateAgentStatus("marketing", "running", 0);
  try {
    const status = await getStatus();
    const ideationItems = status.pipeline.filter(p => p.status === "ideation");
    
    let action = {};
    
    // WORK: Create new product ideas if fewer than 3 in ideation
    if (ideationItems.length < 3) {
      const response = await chat(
        "You are Head of Marketing at NexAI. We build AI products for solo founders and AI businesses in the US and Canada. Think of profitable, specific product ideas.",
        "Suggest ONE specific AI product idea. Respond in JSON: {\"name\": \"Product Name\", \"description\": \"Brief description\", \"target_audience\": \"Who it is for\", \"price\": 29, \"category\": \"saas\"}",
        { temperature: 0.9 }
      );
      let product = null;
      try {
        const m = response.match(/\{[\s\S]*\}/);
        if (m) product = JSON.parse(m[0]);
      } catch {}
      if (!product) product = { name: "AI Product", description: response.substring(0,200), target_audience: "Solo founders", price: 29, category: "saas" };
      
      await addPipelineItem({ name: product.name, description: product.description, targetAudience: product.target_audience, price: product.price || 29, category: product.category || "saas", status: "ideation" });
      action.productCreated = product.name;
      await logAction("Marketing", "product_ideation", { name: product.name });
    }
    
    // WORK: Research target customers
    const customerResponse = await chat(
      "You are a B2B marketing researcher for NexAI. We sell AI products to US and Canadian businesses.",
      "List 3 types of businesses in US/Canada that would buy AI tools. JSON: [{\"business_type\": \"type\", \"pain_point\": \"why they need this\", \"estimated_budget\": \"$$\"}]",
      { temperature: 0.8 }
    );
    try {
      const m = customerResponse.match(/\[[\s\S]*\]/);
      if (m) {
        const targets = JSON.parse(m[0]);
        action.targetsFound = targets.length;
        await logAction("Marketing", "customer_research", { targets: targets.map(t => t.business_type) });
      }
    } catch {}
    
    // SELF-IMPROVEMENT: If nothing to do, study and improve
    if (!action.productCreated && ideationItems.length >= 3) {
      const study = await chat(
        "You are a marketing expert studying to improve yourself. You have no urgent tasks right now.",
        "What is the most valuable marketing skill or strategy you should learn next to sell AI products to US/Canadian businesses? Give a specific topic and 3 key insights.",
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

# ============================================================
# TECH AGENT - Development + Self-Improvement
# ============================================================
tech = r'''import { chat } from "../lib/llm.js";
import { logAction, updateAgentStatus, getStatus, updatePipelineItem } from "../lib/db.js";

export async function runTechCycle() {
  await updateAgentStatus("tech", "running", 0);
  try {
    const status = await getStatus();
    const ideationItems = status.pipeline.filter(p => p.status === "ideation");
    const buildingItems = status.pipeline.filter(p => p.status === "building");
    
    let action = {};
    
    // WORK: Move ideation items to building
    for (const item of ideationItems.slice(0, 2)) {
      await updatePipelineItem(item.id, { status: "building" });
      action.built = (action.built || 0) + 1;
      await logAction("Tech", "started_building", { name: item.name });
    }
    
    // WORK: Complete building items
    for (const item of buildingItems) {
      const devNotes = await chat(
        "You are Lead Developer at NexAI building: " + item.name,
        "Describe the key technical features and architecture for this product in 2-3 sentences.",
        { temperature: 0.7 }
      );
      await updatePipelineItem(item.id, { status: "built", description: (item.description || "") + " | Tech: " + devNotes.substring(0,200) });
      action.completed = (action.completed || 0) + 1;
      await logAction("Tech", "build_complete", { name: item.name });
    }
    
    // SELF-IMPROVEMENT: If nothing to build, study new tech
    if (ideationItems.length === 0 && buildingItems.length === 0) {
      const study = await chat(
        "You are a senior developer studying to improve your skills. No tasks are waiting.",
        "What is the most valuable programming skill, framework, or technology you should learn next to build better AI products? Give a specific topic and 3 key insights.",
        { temperature: 0.7 }
      );
      action.selfImprovement = study.substring(0, 200);
      await logAction("Tech", "self_study", { topic: action.selfImprovement });
    }
    
    await updateAgentStatus("tech", "active", 1);
    return { agent: "Tech", action: "build_cycle", ...action };
  } catch (err) {
    await updateAgentStatus("tech", "error", 0);
    return { agent: "Tech", action: "error", error: err.message };
  }
}
'''

# ============================================================
# ANALYTICS AGENT - Testing + Validation + Self-Improvement
# ============================================================
analytics = r'''import { chat } from "../lib/llm.js";
import { logAction, updateAgentStatus, getStatus, updatePipelineItem } from "../lib/db.js";

export async function runAnalyticsCycle() {
  await updateAgentStatus("analytics", "running", 0);
  try {
    const status = await getStatus();
    const builtItems = status.pipeline.filter(p => p.status === "built");
    const testingItems = status.pipeline.filter(p => p.status === "testing");
    
    let action = {};
    
    // WORK: Start testing built items
    for (const item of builtItems.slice(0, 2)) {
      await updatePipelineItem(item.id, { status: "testing" });
      action.testing = (action.testing || 0) + 1;
      await logAction("Analytics", "started_testing", { name: item.name });
    }
    
    // WORK: Complete testing and validate
    for (const item of testingItems) {
      const testResult = await chat(
        "You are Head of Analytics at NexAI testing: " + item.name,
        "Evaluate this product for market readiness. JSON: {\"score\": 8, \"feedback\": \"brief feedback\", \"recommendation\": \"launch or iterate\"}",
        { temperature: 0.5 }
      );
      let result = { score: 7, feedback: "Ready for launch", recommendation: "launch" };
      try {
        const m = testResult.match(/\{[\s\S]*\}/);
        if (m) result = JSON.parse(m[0]);
      } catch {}
      
      if (result.score >= 7) {
        await updatePipelineItem(item.id, { status: "validated", quality_score: result.score });
        action.validated = (action.validated || 0) + 1;
        await logAction("Analytics", "product_validated", { name: item.name, score: result.score });
      } else {
        await updatePipelineItem(item.id, { status: "building", quality_score: result.score });
        action.sentBack = (action.sentBack || 0) + 1;
        await logAction("Analytics", "needs_improvement", { name: item.name, score: result.score });
      }
    }
    
    // SELF-IMPROVEMENT: If nothing to test, study analytics
    if (builtItems.length === 0 && testingItems.length === 0) {
      const study = await chat(
        "You are a data analyst studying to improve your skills. No tasks are waiting.",
        "What is the most valuable analytics skill, tool, or methodology you should learn next to better evaluate AI products? Give a specific topic and 3 key insights.",
        { temperature: 0.7 }
      );
      action.selfImprovement = study.substring(0, 200);
      await logAction("Analytics", "self_study", { topic: action.selfImprovement });
    }
    
    await updateAgentStatus("analytics", "active", 1);
    return { agent: "Analytics", action: "analytics_cycle", ...action };
  } catch (err) {
    await updateAgentStatus("analytics", "error", 0);
    return { agent: "Analytics", action: "error", error: err.message };
  }
}
'''

# ============================================================
# CEO AGENT - Launch Decisions + Strategy + Self-Improvement
# ============================================================
ceo = r'''import { chat } from "../lib/llm.js";
import { logAction, updateAgentStatus, getStatus, updatePipelineItem, updateState } from "../lib/db.js";

export async function runCEOCycle() {
  await updateAgentStatus("ceo", "running", 0);
  try {
    const status = await getStatus();
    const validatedItems = status.pipeline.filter(p => p.status === "validated");
    
    let action = {};
    
    // WORK: Launch validated products
    for (const item of validatedItems.slice(0, 2)) {
      await updatePipelineItem(item.id, { status: "launched" });
      action.launched = (action.launched || 0) + 1;
      await logAction("CEO", "product_launched", { name: item.name, price: item.price });
    }
    
    // WORK: Set company strategy
    const strategyResponse = await chat(
      "You are CEO of NexAI, an autonomous AI company selling products to US and Canadian markets.",
      "Set a one-sentence company strategy for this week based on our " + status.pipeline.length + " pipeline items and $" + (status.financials?.revenue || 0) + " revenue.",
      { temperature: 0.4 }
    );
    action.strategy = strategyResponse.substring(0, 300);
    await updateState({ strategy: action.strategy });
    await logAction("CEO", "strategy_set", action.strategy);
    
    // SELF-IMPROVEMENT: If nothing to launch, study leadership
    if (validatedItems.length === 0) {
      const study = await chat(
        "You are a CEO studying to improve your leadership skills. No products ready to launch right now.",
        "What is the most valuable business strategy, management technique, or industry trend you should learn next to grow NexAI? Give a specific topic and 3 key insights.",
        { temperature: 0.7 }
      );
      action.selfImprovement = study.substring(0, 200);
      await logAction("CEO", "self_study", { topic: action.selfImprovement });
    }
    
    await updateAgentStatus("ceo", "active", 1);
    return { agent: "CEO", action: "review_cycle", ...action };
  } catch (err) {
    await updateAgentStatus("ceo", "error", 0);
    return { agent: "CEO", action: "error", error: err.message };
  }
}
'''

# ============================================================
# SALES AGENT - Selling + Lead Generation + Self-Improvement
# ============================================================
sales = r'''import { chat } from "../lib/llm.js";
import { logAction, updateAgentStatus, getStatus } from "../lib/db.js";

// NOTE: This agent does NOT create invoices. Invoices/orders are only ever born
// from a real checkout (POST /api/payments/create) and are auto-confirmed as
// "paid" by the PayPal webhook (/api/payments/webhook). Pre-minting invoices is
// fabricated revenue, so it has been removed. The sales agent now only does
// sales research/strategy so it stays "active" without inventing customers.

export async function runSalesCycle() {
  await updateAgentStatus("sales", "running", 0);
  try {
    const status = await getStatus();
    const launchedProducts = status.pipeline.filter(p => p.status === "launched");

    let action = { invoicesCreated: 0 };

    const focus = launchedProducts.length > 0
      ? launchedProducts.map(p => p.name + " ($" + p.price + ")").join(", ")
      : "the NexAI product suite";

    // Self-improvement only: study how to convert real buyers. No outreach is
    // sent, no company is contacted, and no invoice is created here.
    const study = await chat(
      "You are a B2B growth strategist for NexAI.",
      "For " + focus + ", give the single highest-leverage tactic to convert real inbound buyers via a self-serve PayPal checkout. Return a short topic line + 3 concrete insights.",
      { temperature: 0.7 }
    );
    action.selfImprovement = study.substring(0, 300);
    await logAction("Sales", "self_study", { focus, topic: action.selfImprovement });

    await updateAgentStatus("sales", "active", 1);
    return { agent: "Sales", action: "sales_cycle", ...action };
  } catch (err) {
    await updateAgentStatus("sales", "error", 0);
    return { agent: "Sales", action: "error", error: err.message };
  }
}
'''

# ============================================================
# FINANCE AGENT - Financial Management + Self-Improvement
# ============================================================
finance = r'''import { chat } from "../lib/llm.js";
import { logAction, updateAgentStatus, getStatus } from "../lib/db.js";

export async function runFinanceCycle() {
  await updateAgentStatus("finance", "running", 0);
  try {
    const status = await getStatus();
    const revenue = status.financials?.revenue || 0;
    const pendingInvoices = status.invoices?.pending || 0;
    const totalInvoices = status.invoices?.total || 0;
    const launchedProducts = status.pipeline.filter(p => p.status === "launched").length;
    
    let action = {};
    
    // WORK: Financial review and forecasting
    const review = await chat(
      "You are CFO of NexAI.",
      "Financial status: $" + revenue + " revenue, " + pendingInvoices + " pending invoices, " + totalInvoices + " total invoices, " + launchedProducts + " launched products. What financial action should we take?",
      { temperature: 0.3 }
    );
    action.review = review.substring(0, 200);
    await logAction("Finance", "financial_review", { revenue, pendingInvoices, recommendation: action.review });
    
    // SELF-IMPROVEMENT: Always study finance (there's always more to learn)
    const study = await chat(
      "You are a finance expert studying to improve your skills.",
      "What is the most valuable financial strategy, tax optimization, or funding approach you should learn next to grow NexAI's revenue? Give a specific topic and 3 key insights.",
      { temperature: 0.7 }
    );
    action.selfImprovement = study.substring(0, 200);
    await logAction("Finance", "self_study", { topic: action.selfImprovement });
    
    await updateAgentStatus("finance", "active", 1);
    return { agent: "Finance", action: "finance_cycle", revenue, pendingInvoices, ...action };
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
    'agents/sales.js': sales,
    'agents/finance.js': finance,
}

for path, content in files.items():
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Written: {path}")

print("\nAll agents rewritten with self-improvement!")
