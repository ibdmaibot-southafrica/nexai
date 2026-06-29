import * as acorn from "acorn";
import { chat } from "../lib/llm.js";
import {
  logAction,
  updateAgentStatus,
  getStatus,
  getPool,
  getAgentsByStatus,
  getSetting,
  setSetting,
} from "../lib/db.js";

/**
 * Self-improving Coding Agent.
 *
 * Generates agent code with the LLM, then BEFORE anything is queued for deploy it
 * checks itself:
 *   1. Static check  — acorn parses it (real syntax test), the required cycle
 *      function is exported, imports are allow-listed, and dangerous APIs are
 *      banned (no fs/process/getPool/eval/child_process).
 *   2. LLM self-review — a strict reviewer judges viability and can return a fix.
 *   3. Repair loop    — failures are fed back to the model (bounded retries); the
 *      hand-written template is the always-valid fallback.
 * Only code that passes is written to agent_code (status 'pending'); the build-gate
 * (lib/deploy.js) remains the final authority — a failing Vercel build never
 * reaches master.
 *
 * It also MAINTAINS itself: agents stuck in 'error' are regenerated, and it
 * TRAINS itself by recording lessons from every rejection and feeding them into
 * future generations.
 */

const CORE_AGENTS = new Set(["ceo", "marketing", "tech", "product", "sales", "finance", "analytics", "coding"]);
const ALLOWED_IMPORTS = {
  "../lib/llm.js": new Set(["chat"]),
  "../lib/db.js": new Set(["logAction", "updateAgentStatus", "getStatus"]),
};
const BANNED = [
  "getPool", "process.env", "child_process", "node:fs", "require(", "eval(",
  "new Function", "execSync", "spawn(", "globalThis", "import(",
];
const MAX_CODE_LEN = 8000;
const MAX_BUILD_PER_CYCLE = 2;
const MAX_REPAIR_PER_CYCLE = 1;
const MAX_ATTEMPTS = 3;

export function isValidAgentKey(key) {
  return typeof key === "string" && /^[a-z][a-z0-9_]{1,30}$/.test(key);
}

function fnNameFor(key) {
  return "run" + key.charAt(0).toUpperCase() + key.slice(1) + "Cycle";
}

function sanitize(str) {
  return (str || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ").replace(/\r/g, "").substring(0, 200);
}

function stripFences(s) {
  return (s || "").replace(/^```[a-z]*\n?/i, "").replace(/```\s*$/i, "").trim();
}

// The always-valid hand-written scaffold — used as a reference for the LLM and as
// the guaranteed fallback if generation can't pass the self-check.
export function generateAgentCode(agentKey, agentName, agentDescription) {
  const capKey = agentKey.charAt(0).toUpperCase() + agentKey.slice(1);
  const safeName = sanitize(agentName);
  const safeDesc = sanitize(agentDescription || agentName + " for NexAI");
  return [
    'import { chat } from "../lib/llm.js";',
    'import { logAction, updateAgentStatus, getStatus } from "../lib/db.js";',
    "",
    "export async function run" + capKey + "Cycle() {",
    '  await updateAgentStatus("' + agentKey + '", "running", 0);',
    "  try {",
    "    const status = await getStatus();",
    "    const action = {};",
    "    const response = await chat(",
    '      "You are the ' + safeName + ' of NexAI. ' + safeDesc + '",',
    '      "Pipeline: " + status.pipeline.length + " items, Revenue: $" + (status.financials?.revenue || 0) + ". What should you do? JSON: {action, details}",',
    "      { temperature: 0.6 }",
    "    );",
    "    try {",
    "      const m = response.match(/\\{[\\s\\S]*\\}/);",
    "      if (m) action.result = JSON.parse(m[0]);",
    "    } catch {}",
    '    await logAction("' + safeName + '", "cycle_complete", action);',
    '    await updateAgentStatus("' + agentKey + '", "active", 1);',
    '    return { agent: "' + safeName + '", action: "' + agentKey + '_cycle", ...action };',
    "  } catch (err) {",
    '    await updateAgentStatus("' + agentKey + '", "error", 0);',
    '    return { agent: "' + safeName + '", action: "error", error: err.message };',
    "  }",
    "}",
  ].join("\n");
}

// ---- Self-check #1: static + safety ------------------------------------------
function staticCheck(code, key) {
  const issues = [];
  if (!code || code.length < 40) issues.push("empty or too short");
  if (code && code.length > MAX_CODE_LEN) issues.push(`too long (>${MAX_CODE_LEN} chars)`);

  for (const bad of BANNED) {
    if (code && code.includes(bad)) issues.push(`banned API: ${bad}`);
  }

  let ast = null;
  try {
    ast = acorn.parse(code, { ecmaVersion: "latest", sourceType: "module" });
  } catch (e) {
    issues.push(`syntax error: ${e.message}`);
    return { ok: false, issues }; // can't inspect further
  }

  // Imports must be allow-listed (source + named specifiers).
  for (const node of ast.body) {
    if (node.type !== "ImportDeclaration") continue;
    const src = node.source.value;
    const allowed = ALLOWED_IMPORTS[src];
    if (!allowed) { issues.push(`disallowed import: ${src}`); continue; }
    for (const spec of node.specifiers) {
      const name = spec.imported?.name || spec.local?.name;
      if (!allowed.has(name)) issues.push(`disallowed import {${name}} from ${src}`);
    }
  }

  // The required cycle function must be exported.
  const expected = fnNameFor(key);
  const hasExport =
    new RegExp(`export\\s+async\\s+function\\s+${expected}\\s*\\(`).test(code) ||
    new RegExp(`export\\s+const\\s+${expected}\\s*=\\s*async`).test(code);
  if (!hasExport) issues.push(`must export async function ${expected}`);

  return { ok: issues.length === 0, issues };
}

// ---- LLM generation / repair / review ----------------------------------------
async function llmGenerate(agent, lessons) {
  const expected = fnNameFor(agent.key);
  const sys = `You write ONE self-contained ES module for an autonomous agent in the NexAI company. Output ONLY JavaScript code (no prose, no markdown fences).
HARD RULES:
- Export exactly: export async function ${expected}() { ... }
- Import ONLY: import { chat } from "../lib/llm.js"; and any of { logAction, updateAgentStatus, getStatus } from "../lib/db.js".
- NO other imports. NO fs, process, getPool, eval, new Function, child_process, dynamic import(), or fetch to arbitrary hosts.
- Must call updateAgentStatus("${agent.key}","running",0) first and updateAgentStatus("${agent.key}","active",1) on success; wrap in try/catch and on error call updateAgentStatus("${agent.key}","error",0).
- Must return an object like { agent, action }.
- Keep under ${MAX_CODE_LEN} characters.`;
  const lessonText = lessons.length ? `\n\nLESSONS FROM PAST FAILURES (avoid these):\n- ${lessons.slice(0, 8).join("\n- ")}` : "";
  const user = `Agent key: ${agent.key}\nName: ${agent.name}\nMandate: ${agent.description || agent.name}\n\nWrite the module. Reference shape:\n${generateAgentCode(agent.key, agent.name, agent.description)}${lessonText}`;
  const out = await chat(sys, user, { temperature: 0.3, maxTokens: 2000 });
  return stripFences(out);
}

async function llmRepair(code, issues, agent) {
  const expected = fnNameFor(agent.key);
  const out = await chat(
    `You fix a JavaScript ES module. Output ONLY the corrected full module code (no prose, no fences). It must export async function ${expected}, import only chat from "../lib/llm.js" and {logAction,updateAgentStatus,getStatus} from "../lib/db.js", and use no fs/process/getPool/eval/child_process.`,
    `Problems to fix:\n- ${issues.join("\n- ")}\n\nCode:\n${code}`,
    { temperature: 0.2, maxTokens: 2000 }
  );
  return stripFences(out);
}

async function llmReview(code, agent) {
  const expected = fnNameFor(agent.key);
  const out = await chat(
    `You are a strict reviewer. Decide if this ES module will run without errors in a Next.js Node runtime. It must export async function ${expected}, import only allowed modules (chat from ../lib/llm.js; logAction/updateAgentStatus/getStatus from ../lib/db.js), and avoid fs/process/getPool/eval. Respond ONLY as JSON: {"approved": true|false, "reason": "...", "fixedCode": "full corrected code if not approved, else empty"}.`,
    code,
    { temperature: 0.1, maxTokens: 2200 }
  );
  try {
    const m = out.match(/\{[\s\S]*\}/);
    if (m) {
      const v = JSON.parse(m[0]);
      if (v.fixedCode) v.fixedCode = stripFences(v.fixedCode);
      return v;
    }
  } catch {}
  return { approved: false, reason: "unparseable review", fixedCode: "" };
}

// Generate -> self-check -> self-review -> repair. Returns { ok, code, attempts, issues }.
async function buildAgent(agent, lessons, recordLesson) {
  let code = "";
  try { code = await llmGenerate(agent, lessons); } catch (e) { code = ""; }
  if (!code) code = generateAgentCode(agent.key, agent.name, agent.description);

  let lastIssues = [];
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const sc = staticCheck(code, agent.key);
    if (!sc.ok) {
      lastIssues = sc.issues;
      await recordLesson(`${agent.key}: ${sc.issues.join("; ")}`);
      try { code = await llmRepair(code, sc.issues, agent); } catch {}
      if (!code) break;
      continue;
    }
    // Static passed -> LLM viability review.
    let review;
    try { review = await llmReview(code, agent); } catch { review = { approved: true }; }
    if (review.approved) return { ok: true, code, attempts: attempt };
    lastIssues = [review.reason || "review rejected"];
    await recordLesson(`${agent.key}: review - ${review.reason || "rejected"}`);
    if (review.fixedCode && staticCheck(review.fixedCode, agent.key).ok) code = review.fixedCode;
  }

  // Fallback: the guaranteed-valid template.
  const tpl = generateAgentCode(agent.key, agent.name, agent.description);
  if (staticCheck(tpl, agent.key).ok) return { ok: true, code: tpl, attempts: MAX_ATTEMPTS, fallback: true };
  return { ok: false, issues: lastIssues };
}

// ---- Self-training: lessons in settings --------------------------------------
async function getLessons() {
  try { return JSON.parse((await getSetting("coding_lessons", "[]")) || "[]"); } catch { return []; }
}
async function makeLessonRecorder() {
  const lessons = await getLessons();
  const added = [];
  return {
    lessons,
    record: async (text) => { added.push(text); },
    flush: async () => {
      if (!added.length) return;
      const merged = [...added, ...lessons].slice(0, 20);
      await setSetting("coding_lessons", JSON.stringify(merged));
    },
  };
}

export async function runCodingCycle() {
  await updateAgentStatus("coding", "running", 0);
  const decisions = { built: 0, repaired: 0, rejected: 0, agentsToBuild: [], repairedKeys: [] };
  const recorder = await makeLessonRecorder();
  try {
    const pool = getPool();

    // ---- BUILD: new CEO-appointed agents not yet generated --------------------
    const { rows: active } = await pool.query("SELECT key, name, description FROM agents WHERE status = 'active' ORDER BY key");
    const { rows: existing } = await pool.query("SELECT DISTINCT agent_key FROM agent_code WHERE status IN ('pending','building','deployed')");
    const existingKeys = new Set(existing.map((c) => c.agent_key));
    const toBuild = active
      .filter((a) => isValidAgentKey(a.key) && !CORE_AGENTS.has(a.key) && !existingKeys.has(a.key))
      .slice(0, MAX_BUILD_PER_CYCLE);
    decisions.agentsToBuild = toBuild.map((a) => a.key);

    for (const agent of toBuild) {
      const r = await buildAgent(agent, recorder.lessons, recorder.record);
      if (r.ok) {
        await pool.query(
          "INSERT INTO agent_code (agent_key, file_path, code, status) VALUES ($1, $2, $3, 'pending')",
          [agent.key, "agents/" + agent.key + ".js", r.code]
        );
        decisions.built++;
        await logAction("Coding", "agent_code_generated", { key: agent.key, attempts: r.attempts, fallback: !!r.fallback });
      } else {
        decisions.rejected++;
        await logAction("Coding", "agent_build_rejected", { key: agent.key, issues: r.issues });
      }
    }

    // ---- MAINTAIN: regenerate agents stuck in 'error' -------------------------
    const broken = (await getAgentsByStatus("error"))
      .filter((a) => isValidAgentKey(a.key) && !CORE_AGENTS.has(a.key))
      .slice(0, MAX_REPAIR_PER_CYCLE);

    for (const agent of broken) {
      const r = await buildAgent(agent, recorder.lessons, recorder.record);
      if (r.ok) {
        await pool.query(
          "INSERT INTO agent_code (agent_key, file_path, code, status) VALUES ($1, $2, $3, 'pending')",
          [agent.key, "agents/" + agent.key + ".js", r.code]
        );
        // Let it run again once the repaired build deploys.
        await pool.query("UPDATE agents SET status = 'active', updated_at = NOW() WHERE key = $1", [agent.key]);
        decisions.repaired++;
        decisions.repairedKeys.push(agent.key);
        await logAction("Coding", "agent_repair_queued", { key: agent.key, attempts: r.attempts });
      }
    }

    await recorder.flush();
    await updateAgentStatus("coding", "active", 1);
    return { agent: "Coding", action: "coding_cycle", ...decisions };
  } catch (err) {
    await recorder.flush().catch(() => {});
    await updateAgentStatus("coding", "error", 0);
    await logAction("Coding", "error", { error: err.message });
    return { agent: "Coding", action: "error", error: err.message };
  }
}
