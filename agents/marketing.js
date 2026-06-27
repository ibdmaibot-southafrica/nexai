/**
 * Marketing Agent - Market research, product ideation, positioning
 * Task: Find profitable product opportunities and define what to build
 */
import { chat } from "../lib/llm.js";
import { getState, logAgentAction, updateState, updateAgentStatus } from "../lib/database.js";

const SYSTEM_PROMPT = `You are the Head of Marketing & Product at NexAI, an autonomous AI company.

Your SOLE JOB: Research the market and identify the single best product we can build and sell.

Process:
1. Research current market trends in AI tools, SaaS, and automation
2. Identify underserved niches with high demand and low competition
3. Define ONE specific product to build (be precise)
4. Create the product spec: name, description, target audience, pricing
5. Define the marketing message and positioning

Rules:
- Focus on products that can be built as a web app (HTML/CSS/JS)
- Products must be sellable as subscriptions ($9-$99/mo)
- Target solo founders, small businesses, creators
- Only recommend products with clear monetization

Respond in valid JSON:
{
  "marketResearch": "summary of findings",
  "productIdea": {
    "name": "Product Name",
    "description": "One sentence what it does",
    "targetAudience": "Who buys this",
    "pricing": {"amount": 29, "period": "month"},
    "category": "ai-tool | saas | automation | content",
    "competitiveAdvantage": "Why this wins"
  },
  "positioning": "How to position this in the market",
  "nextSteps": ["what needs to happen next"]
}`;

export async function runMarketingCycle() {
  try { updateAgentStatus("marketing", "running", 0); } catch {}
  let state;
  try { state = getState(); } catch { state = { pipeline: [] }; }
  const pipeline = state.pipeline || [];

  const prompt = `Research and identify the best product for NexAI to build and sell.

Current pipeline: ${pipeline.length > 0 ? JSON.stringify(pipeline.map(p => ({ name: p.idea?.name, status: p.status })), null, 2) : "Empty - this is our first product"}

Market context (June 2026):
- AI agents and automation are booming
- Solo founders and small teams need AI tools
- People pay $9-$99/mo for productivity tools
- Low-code/no-code is huge
- Niche AI tools outperform general ones

Find the single best opportunity. Be specific and actionable.`;

  let response;
  try {
    response = await chat(SYSTEM_PROMPT, prompt, { temperature: 0.9 });
  } catch (err) {
    logAgentAction("Marketing", "error", { error: err.message });
    try { updateAgentStatus("marketing", "active", 0); } catch {}
    return { agent: "Marketing", action: "error", error: err.message };
  }

  logAgentAction("Marketing", "research_cycle", { response: response.substring(0, 300) });

  const parsed = parseResponse(response);
  if (parsed?.productIdea) {
    updateState((state) => {
      if (!state.pipeline) state.pipeline = [];
      state.pipeline.push({
        id: `product-${Date.now()}`,
        status: "research_complete",
        idea: parsed.productIdea,
        positioning: parsed.positioning,
        research: parsed.marketResearch,
        createdAt: new Date().toISOString(),
      });
      return state;
    });
    try { updateAgentStatus("marketing", "active", 1); } catch {}
  } else {
    try { updateAgentStatus("marketing", "active", 0); } catch {}
  }

  return { agent: "Marketing", action: "research_cycle", response, parsed };
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
