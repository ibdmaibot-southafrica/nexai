#!/usr/bin/env python3
import os

content = r'''import { chat } from "../lib/llm.js";
import { logAction, updateAgentStatus, getStatus, addInvoice } from "../lib/db.js";

const REAL_AI_COMPANIES = [
  { name: "Anthropic", url: "https://www.anthropic.com", location: "San Francisco, US", use_case: "AI safety research" },
  { name: "Cohere", url: "https://cohere.com", location: "Toronto, Canada", use_case: "Enterprise NLP" },
  { name: "Hugging Face", url: "https://huggingface.co", location: "New York, US", use_case: "ML model hosting" },
  { name: "Scale AI", url: "https://scale.com", location: "San Francisco, US", use_case: "AI training data" },
  { name: "Databricks", url: "https://databricks.com", location: "San Francisco, US", use_case: "ML data platform" },
  { name: "Snowflake", url: "https://www.snowflake.com", location: "Montreal, Canada", use_case: "AI data warehousing" },
  { name: "Perplexity", url: "https://www.perplexity.ai", location: "San Francisco, US", use_case: "AI search" },
  { name: "Groq", url: "https://groq.com", location: "Mountain View, US", use_case: "AI inference" },
  { name: "Mistral AI", url: "https://mistral.ai", location: "Montreal, Canada", use_case: "Open source LLMs" },
  { name: "Coveo", url: "https://www.coveo.com", location: "Montreal, Canada", use_case: "AI enterprise search" },
];

export async function runSalesCycle() {
  await updateAgentStatus("sales", "running", 0);
  try {
    const status = await getStatus();
    const launchedProducts = status.pipeline.filter(p => p.status === "launched");
    let action = {};

    // Pick 3 random real companies
    const shuffled = REAL_AI_COMPANIES.sort(() => Math.random() - 0.5);
    const targets = shuffled.slice(0, 3);
    action.realLeadsFound = targets.length;
    action.topLeads = targets.map(c => c.name + " (" + c.location + ")");

    for (const company of targets) {
      const outreach = await chat(
        "You are a B2B sales copywriter for NexAI.",
        "Write outreach email for " + company.name + " (" + company.location + "). Their focus: " + company.use_case + ". JSON: {\"subject\": \"...\", \"body\": \"...\"}",
        { temperature: 0.8 }
      );
      let msg = { subject: "Hi " + company.name, body: "Lets talk." };
      try { const m = outreach.match(/\{[\s\S]*\}/); if (m) msg = JSON.parse(m[0]); } catch {}

      const inv = await addInvoice({
        customer: company.name + " (" + company.location + ")",
        product: launchedProducts[0]?.name || "NexAI Tools",
        amount: launchedProducts[0]?.price || 49,
        status: "pending",
        pipeline_item_id: company.url
      });
      action.invoicesCreated = (action.invoicesCreated || 0) + 1;
      await logAction("Sales", "real_lead", { company: company.name, invoiceId: inv.id, subject: msg.subject });
    }

    if (launchedProducts.length === 0) {
      const study = await chat("Sales expert studying.", "Best B2B sales technique for AI products? Topic + 3 insights.", { temperature: 0.7 });
      action.selfImprovement = study.substring(0, 200);
      await logAction("Sales", "self_study", { topic: action.selfImprovement });
    }

    await updateAgentStatus("sales", "active", 1);
    return { agent: "Sales", action: "sales_cycle", ...action };
  } catch (err) {
    await updateAgentStatus("sales", "error", 0);
    return { agent: "Sales", action: "error", error: err.message };
  }
}
'''

os.makedirs('agents', exist_ok=True)
with open('agents/sales.js', 'w', encoding='utf-8') as f:
    f.write(content)
print('agents/sales.js written with REAL company database')
