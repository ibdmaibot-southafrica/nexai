/**
 * CEO Agent - Manages pipeline, ensures quality, approves launches
 * Task: Coordinate Marketing → Tech → Launch, ensure best outcomes
 */
import { chat } from "../lib/llm.js";
import { getState, logAgentAction, updateState, updateAgentStatus } from "../lib/database.js";

const SYSTEM_PROMPT = `You are the CEO of NexAI, an autonomous AI company.

Your SOLE JOB: Manage the product pipeline and ensure we ship quality products that make money.

Pipeline stages: research_complete → building → built → review → launched → revenue

Your job:
1. Review what Marketing researched - is it viable?
2. Review what Tech built - is it good enough to sell?
3. Approve or reject before launch
4. Ensure we focus on revenue-generating activities
5. Make fast decisions - speed matters more than perfection

Rules:
- Approve products that are functional and sellable
- Reject products that are too complex or have no clear buyer
- Push for launch once quality score >= 6/10
- Always prioritize revenue

Respond in valid JSON:
{
  "decision": "approve_build" | "reject" | "request_changes" | "approve_launch",
  "reasoning": "your reasoning",
  "productId": "which product",
  "changesNeeded": ["if requesting changes"],
  "priority": "high" | "medium" | "low"
}`;

export async function runCEOCycle() {
  try { updateAgentStatus("ceo", "running", 0); } catch {}
  let state;
  try { state = getState(); } catch { state = { pipeline: [], financials: { revenue: 0, costs: 0 }, strategy: "" }; }
  const pipeline = state.pipeline || [];

  const toReview = pipeline.filter((p) => p.status === "research_complete" || p.status === "built");

  if (toReview.length === 0) {
    logAgentAction("CEO", "idle", { reason: "No products to review" });
    try { updateAgentStatus("ceo", "active", 0); } catch {}
    return { agent: "CEO", action: "idle", reason: "Pipeline empty" };
  }

  const product = toReview[0];

  const prompt = `Review this product for NexAI:

Product: ${product.idea?.name || product.name}
Status: ${product.status}
Idea: ${JSON.stringify(product.idea, null, 2)}
Quality Score: ${product.qualityScore || "N/A"}
Files Built: ${product.files?.length || 0}

Pipeline Summary:
- Total products: ${pipeline.length}
- Research: ${pipeline.filter((p) => p.status === "research_complete").length}
- Building: ${pipeline.filter((p) => p.status === "building").length}
- Built: ${pipeline.filter((p) => p.status === "built").length}
- Launched: ${pipeline.filter((p) => p.status === "launched").length}

Decision needed: Should we build this? Is it good enough to launch?`;

  let response;
  try {
    response = await chat(SYSTEM_PROMPT, prompt, { temperature: 0.4 });
  } catch (err) {
    logAgentAction("CEO", "error", { error: err.message });
    try { updateAgentStatus("ceo", "active", 0); } catch {}
    return { agent: "CEO", action: "error", error: err.message };
  }

  logAgentAction("CEO", "review_cycle", { product: product.idea?.name, response: response.substring(0, 300) });

  const parsed = parseResponse(response);

  if (parsed?.decision) {
    updateState((state) => {
      const idx = state.pipeline.findIndex((p) => p.id === product.id);
      if (idx >= 0) {
        if (parsed.decision === "approve_build") {
          state.pipeline[idx].status = "building";
        } else if (parsed.decision === "approve_launch") {
          state.pipeline[idx].status = "launched";
          state.pipeline[idx].launchedAt = new Date().toISOString();
        } else if (parsed.decision === "reject") {
          state.pipeline[idx].status = "rejected";
          state.pipeline[idx].rejectionReason = parsed.reasoning;
        } else if (parsed.decision === "request_changes") {
          state.pipeline[idx].status = "needs_rebuild";
          state.pipeline[idx].changeRequests = parsed.changesNeeded;
        }
      }
      return state;
    });
    try { updateAgentStatus("ceo", "active", 1); } catch {}
  } else {
    try { updateAgentStatus("ceo", "active", 0); } catch {}
  }

  return { agent: "CEO", action: "review_cycle", product: product.idea?.name, parsed };
}

function parseResponse(response) {
  try {
    const jsonStart = response.indexOf("{");
    const jsonEnd = response.lastIndexOf("}") + 1;
    if (jsonStart >= 0 && jsonEnd > jsonStart) {
      return JSON.parse(response.substring(jsonStart, jsonEnd));
    }
  } catch {}
  return null;
}
