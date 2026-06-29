import { chat } from "../lib/llm.js";
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
