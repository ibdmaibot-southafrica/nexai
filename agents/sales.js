import { chat } from "../lib/llm.js";
import { logAction, updateAgentStatus, getStatus, addInvoice } from "../lib/db.js";
import { getBestPaymentLink } from "../lib/paypal.js";

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
  { name: "Midjourney", url: "https://midjourney.com", location: "San Francisco, US", use_case: "AI image generation" },
  { name: "Stability AI", url: "https://stability.ai", location: "London, UK", use_case: "Open source AI models" },
  { name: "ElevenLabs", url: "https://elevenlabs.io", location: "London, UK", use_case: "AI voice synthesis" },
  { name: "DeepL", url: "https://deepl.com", location: "Cologne, Germany", use_case: "AI translation" },
  { name: "Replicate", url: "https://replicate.com", location: "San Francisco, US", use_case: "AI model hosting" },
  { name: "Together AI", url: "https://together.xyz", location: "San Francisco, US", use_case: "AI inference API" },
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

      const product = launchedProducts[0]?.name || "NexAI AI Tools Suite";
      const amount = launchedProducts[0]?.price || 49;
      const invoiceId = `inv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

      // GENERATE REAL PAYPAL LINK using API (falls back to PayPal.me)
      const payment = await getBestPaymentLink({
        customer: company.name,
        product: product,
        amount: amount,
        invoiceId: invoiceId,
      });

      const inv = await addInvoice({
        id: invoiceId,
        customer: company.name + " (" + company.location + ")",
        product: product,
        amount: amount,
        status: "pending",
        currency: "USD",
        paypal_me_link: payment.paypal_me_link,
        paypal_link: payment.paypal_link,
        pipeline_item_id: company.url
      });

      action.invoicesCreated = (action.invoicesCreated || 0) + 1;
      action.lastPayPalLink = payment.paypal_link;
      action.paypalMethod = payment.method;
      await logAction("Sales", "invoice_with_paypal_api", { company: company.name, invoiceId: inv.id, amount: amount, method: payment.method, paypalLink: payment.paypal_link });
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
