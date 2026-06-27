/**
 * Tech Agent - Builds products, tests, deploys
 * Task: Take product specs from Marketing and build working products
 */
import { chat } from "../lib/llm.js";
import { getState, logAgentAction, updateState, updateAgentStatus } from "../lib/database.js";

const SYSTEM_PROMPT = `You are the Lead Developer at NexAI, an autonomous AI company.

Your SOLE JOB: Build working web products from product specs.

When given a product spec, you create:
1. Complete HTML/CSS/JS single-page web app
2. Responsive design (mobile + desktop)
3. Professional UI with modern styling (dark theme)
4. Working functionality (even if demo/mock)
5. Self-contained HTML file (inline CSS + JS)

Rules:
- Build products as single HTML files (self-contained, no external deps)
- Use inline CSS and JS (no build step needed)
- Make them look premium and professional
- Include demo/mock data to show functionality
- Products must be deployable by just opening the HTML file

Respond in valid JSON:
{
  "status": "built" | "needs_specs",
  "productId": "matching-product-id",
  "files": [
    {
      "filename": "index.html",
      "description": "Main product file",
      "html": "<!DOCTYPE html>..."
    }
  ],
  "deploymentInstructions": "How to deploy this",
  "qualityScore": 1-10
}`;

export async function runTechCycle() {
  try { updateAgentStatus("tech", "running", 0); } catch {}
  let state;
  try { state = getState(); } catch { state = { pipeline: [] }; }
  const pipeline = state.pipeline || [];

  const toBuild = pipeline.filter((p) => p.status === "research_complete" || p.status === "needs_rebuild");

  if (toBuild.length === 0) {
    logAgentAction("Tech", "idle", { reason: "No products to build" });
    try { updateAgentStatus("tech", "active", 0); } catch {}
    return { agent: "Tech", action: "idle", reason: "No products in pipeline" };
  }

  const product = toBuild[0];
  const idea = product.idea;

  const prompt = `Build this product from the product spec:

Product Name: ${idea.name}
Description: ${idea.description}
Target Audience: ${idea.targetAudience}
Category: ${idea.category}
Pricing: $${idea.pricing.amount}/${idea.pricing.period}

Requirements:
1. Build a complete, working single-page web app
2. Professional, premium dark-themed design
3. Responsive (works on mobile)
4. Include demo/mock data
5. Self-contained HTML file (inline CSS + JS)

Generate the complete HTML code for this product.`;

  let response;
  try {
    response = await chat(SYSTEM_PROMPT, prompt, { temperature: 0.7, maxTokens: 4096 });
  } catch (err) {
    logAgentAction("Tech", "error", { error: err.message });
    try { updateAgentStatus("tech", "active", 0); } catch {}
    return { agent: "Tech", action: "error", error: err.message };
  }

  logAgentAction("Tech", "building_product", { product: idea.name, response: response.substring(0, 300) });

  const parsed = parseResponse(response);

  if (parsed?.files) {
    updateState((state) => {
      const idx = state.pipeline.findIndex((p) => p.id === product.id);
      if (idx >= 0) {
        state.pipeline[idx].status = "built";
        state.pipeline[idx].files = parsed.files;
        state.pipeline[idx].qualityScore = parsed.qualityScore || 5;
        state.pipeline[idx].builtAt = new Date().toISOString();
      }
      return state;
    });
    try { updateAgentStatus("tech", "active", 1); } catch {}
  } else {
    // Even if parsing failed, mark as built with raw response
    updateState((state) => {
      const idx = state.pipeline.findIndex((p) => p.id === product.id);
      if (idx >= 0) {
        state.pipeline[idx].status = "built";
        state.pipeline[idx].files = [{ filename: "index.html", description: "Main product file", html: response.substring(0, 5000) }];
        state.pipeline[idx].qualityScore = 5;
        state.pipeline[idx].builtAt = new Date().toISOString();
      }
      return state;
    });
    try { updateAgentStatus("tech", "active", 1); } catch {}
  }

  return { agent: "Tech", action: "building_product", product: idea.name, parsed };
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
