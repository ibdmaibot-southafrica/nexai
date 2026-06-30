/**
 * LLM Client - Supports multiple providers:
 * 1. Custom API (LLM_API_URL + LLM_API_KEY) - for Owl Alpha or any OpenAI-compatible API
 * 2. OpenRouter (OPENROUTER_API_KEY) - free tier models
 * 3. Local Ollama (fallback)
 */

const CUSTOM_API_URL = process.env.LLM_API_URL || null;
const CUSTOM_API_KEY = process.env.LLM_API_KEY || null;
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = process.env.LLM_MODEL || "openrouter/owl-alpha";
const OLLAMA_URL = "http://localhost:11434/api/chat";
const OLLAMA_MODEL = process.env.LLM_MODEL || "llama3.1:8b";

// Active per-agent task context. The runner sets this right before it runs an
// agent, so EVERY chat() call that agent makes carries the CEO's instruction for
// THIS cycle — without each of the ~40 agents having to wire it in by hand.
// Agents run sequentially in the runner, so one module-scoped slot is safe.
let activeDirective = null;
export function setActiveDirective(text) {
  activeDirective = text && String(text).trim() ? String(text).trim() : null;
}
export function clearActiveDirective() {
  activeDirective = null;
}

export async function chat(systemPrompt, userMessage, options = {}) {
  const temperature = options.temperature ?? 0.7;
  const maxTokens = options.maxTokens ?? 2048;

  // Fold the CEO's standing dispatch for this agent into the system prompt so the
  // agent actually does what it was told this cycle, not just its default routine.
  // Pass { noDirective: true } to opt a call out (e.g. the CEO's own audit).
  let sys = systemPrompt;
  if (activeDirective && !options.noDirective) {
    sys = `${systemPrompt}\n\nCEO DIRECTIVE FOR THIS CYCLE (highest priority — do this specific task now, ahead of your default routine):\n"${activeDirective}"`;
  }

  // Priority 1: Custom API (Owl Alpha or any OpenAI-compatible endpoint)
  if (CUSTOM_API_URL && CUSTOM_API_KEY) {
    return callCustomAPI(sys, userMessage, temperature, maxTokens);
  }

  // Priority 2: OpenRouter
  if (process.env.OPENROUTER_API_KEY) {
    return callOpenRouter(sys, userMessage, temperature, maxTokens);
  }

  // Priority 3: Local Ollama
  return callOllama(sys, userMessage, temperature, maxTokens);
}

async function callCustomAPI(systemPrompt, userMessage, temperature, maxTokens) {
  // Support any OpenAI-compatible API (Owl Alpha, Together AI, etc.)
  const apiUrl = CUSTOM_API_URL.replace(/\/$/, "") + "/chat/completions";
  const model = process.env.LLM_MODEL || "owl-alpha";

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CUSTOM_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    throw new Error(`Custom API error: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

async function callOpenRouter(systemPrompt, userMessage, temperature, maxTokens) {
  // Handle model ID - if it contains "openrouter/" prefix, use as-is, otherwise prepend it
  let model = OPENROUTER_MODEL;
  if (!model.includes("/")) {
    model = `openrouter/${model}`;
  }

  // Fallback CHAIN: OpenRouter tries `models` in order and auto-falls-back when a
  // model errors or is rate-limited. OPENROUTER_FALLBACK_MODEL is a comma-separated
  // list, so a 429 on the free primary routes to the next free model, then the next.
  const fallbacks = (process.env.OPENROUTER_FALLBACK_MODEL || "openrouter/auto")
    .split(",").map((s) => s.trim()).filter(Boolean);
  // OpenRouter allows a MAX of 3 models in the routing array. Keep primary + first 2 fallbacks.
  const chain = [model, ...fallbacks.filter((f) => f !== model)].slice(0, 3);
  const routing = chain.length > 1 ? { models: chain } : { model };

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      // Full URL so OpenRouter attributes usage to "NexAI" (not "Unknown").
      "HTTP-Referer": process.env.PUBLIC_BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://vercel-app-sigma-teal.vercel.app"),
      "X-Title": "NexAI",
    },
    body: JSON.stringify({
      ...routing,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[LLM] OpenRouter error ${response.status}: ${errorText}`);
    throw new Error(`OpenRouter error: ${response.status} ${errorText.substring(0, 200)}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

async function callOllama(systemPrompt, userMessage, temperature, maxTokens) {
  const response = await fetch(OLLAMA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      stream: false,
      options: { temperature, num_predict: maxTokens },
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama error: ${response.status}`);
  }

  const data = await response.json();
  return data?.message?.content || "";
}

export async function healthCheck() {
  if (process.env.OPENROUTER_API_KEY) {
    return true; // Assume valid if key exists
  }
  try {
    const res = await fetch("http://localhost:11434/api/tags", { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}
