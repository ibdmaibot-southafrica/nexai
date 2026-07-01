import { chat } from "../lib/llm.js";
import { logAction, updateAgentStatus, getStatus } from "../lib/db.js";

export async function runSupportCycle() {
  await updateAgentStatus("support", "running", 0);
  try {
    const status = await getStatus();
    const pipelineLen = Array.isArray(status?.pipeline) ? status.pipeline.length : 0;
    const revenue = status?.financials?.revenue ?? 0;
    const activeCustomers = Array.isArray(status?.customers) ? status.customers.length : 0;
    const openTickets = Array.isArray(status?.tickets) ? status.tickets.filter(t => t.status === "open").length : 0;
    const slaBreaches = Array.isArray(status?.tickets) ? status.tickets.filter(t => t.slaBreached).length : 0;
    const atRiskAccounts = Array.isArray(status?.customers) ? status.customers.filter(c => c.healthScore < 40).length : 0;

    const context = [
      "Pipeline: " + pipelineLen + " items",
      "Revenue: $" + revenue,
      "Active customers: " + activeCustomers,
      "Open tickets: " + openTickets,
      "SLA breaches: " + slaBreaches,
      "At-risk accounts: " + atRiskAccounts
    ].join(", ");

    const action = {
      summary: context,
      priorities: []
    };

    if (slaBreaches > 0) action.priorities.push("escalate_sla_breaches");
    if (atRiskAccounts > 0) action.priorities.push("churn_prevention_outreach");
    if (openTickets > 5) action.priorities.push("ticket_triage");
    if (pipelineLen > 0) action.priorities.push("onboarding_followup");

    const response = await chat(
      "You are the Customer Success Agent of NexAI. Automated onboarding, SLA monitoring, churn prevention, and rapid integration support for paying customers. Respond with a JSON object containing: {action: string, details: string, urgency: 'low'|'medium'|'high'}.",
      "Current state: " + context + ". What is your next action?",
      { temperature: 0.6 }
    );

    try {
      const m = response.match(/\{[\s\S]*\}/);
      if (m) {
        const parsed = JSON.parse(m[0]);
        action.llmResponse = parsed;
        action.action = parsed.action || "monitor";
        action.details = parsed.details || "";
        action.urgency = parsed.urgency || "low";
      } else {
        action.action = "monitor";
        action.details = response.substring(0, 200);
        action.urgency = "low";
      }
    } catch {
      action.action = "monitor";
      action.details = "Could not parse LLM response";
      action.urgency = "low";
    }

    await logAction("Customer Success Agent", "support_cycle", action);
    await updateAgentStatus("support", "active", 1);
    return { agent: "Customer Success Agent", action: action.action, ...action };
  } catch (err) {
    await updateAgentStatus("support", "error", 0);
    return { agent: "Customer Success Agent", action: "error", error: err.message };
  }
}