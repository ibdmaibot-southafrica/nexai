import { chat } from "../lib/llm.js";
import { logAction, updateAgentStatus, getStatus } from "../lib/db.js";

// NOTE: This agent does NOT create invoices. Invoices/orders are only ever born
// from a real checkout (POST /api/payments/create) and are auto-confirmed as
// "paid" by the PayPal webhook (/api/payments/webhook). Pre-minting invoices
// against real company names is fabricated revenue, so it has been removed.
// The sales agent now only does sales research/strategy so it stays "active"
// on the dashboard without inventing customers or sending any email.

export async function runSalesCycle() {
  await updateAgentStatus("sales", "running", 0);
  try {
    const status = await getStatus();
    const launchedProducts = status.pipeline.filter(p => p.status === "launched");
    let action = { invoicesCreated: 0 };

    const focus = launchedProducts[0]?.name || "the NexAI product suite";

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
