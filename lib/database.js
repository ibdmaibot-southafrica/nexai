/**
 * Database module - JSON file-based persistence
 * Stores all data in /tmp/nexai-data/state.json
 * Logs are stored in /tmp/nexai-data/agent-log.jsonl
 * 
 * NOTE: On Vercel, /tmp is ephemeral per function invocation.
 * For true persistence, use Vercel Blob or KV.
 * This module works perfectly for single-invocation operations.
 */

import fs from "fs";
import path from "path";

const DATA_DIR = "/tmp/nexai-data";
const STATE_FILE = path.join(DATA_DIR, "state.json");
const LOG_FILE = path.join(DATA_DIR, "agent-log.jsonl");

const SEED_STATE = {
  agents: {
    ceo: { key: "ceo", name: "CEO Agent", status: "active", lastRun: null, tasksCompleted: 0 },
    marketing: { key: "marketing", name: "Marketing Agent", status: "active", lastRun: null, tasksCompleted: 0 },
    tech: { key: "tech", name: "Tech Agent", status: "active", lastRun: null, tasksCompleted: 0 },
    finance: { key: "finance", name: "Finance Agent", status: "active", lastRun: null, tasksCompleted: 0 },
    analytics: { key: "analytics", name: "Analytics Agent", status: "active", lastRun: null, tasksCompleted: 0 },
  },
  pipeline: [
    { id: "product-001", status: "research_complete", name: "AI CopyForge", description: "AI-powered landing page copy generator for SaaS founders", targetAudience: "Solo SaaS founders and indie hackers", price: 29, category: "ai-tool", qualityScore: null, files: null, createdAt: "2026-06-25T05:00:00.000Z" },
    { id: "product-002", status: "building", name: "MetricPulse", description: "Automated weekly business metrics dashboard for small teams", targetAudience: "Small business owners and startup teams", price: 19, category: "saas", qualityScore: null, files: null, createdAt: "2026-06-22T05:00:00.000Z" },
    { id: "product-003", status: "built", name: "SupportHero", description: "AI customer support agent that learns from your docs", targetAudience: "SaaS companies with 10-500 customers", price: 49, category: "automation", qualityScore: 7, files: JSON.stringify([{ filename: "index.html", description: "Main product file" }]), createdAt: "2026-06-20T05:00:00.000Z", builtAt: "2026-06-26T05:00:00.000Z" },
    { id: "product-004", status: "launched", name: "InvoiceNinja AI", description: "Smart invoicing with automatic follow-ups and payment tracking", targetAudience: "Freelancers and small agencies", price: 15, category: "saas", qualityScore: 8, files: JSON.stringify([{ filename: "index.html", description: "Main product file" }]), createdAt: "2026-06-13T05:00:00.000Z", builtAt: "2026-06-17T05:00:00.000Z", launchedAt: "2026-06-24T05:00:00.000Z" },
  ],
  invoices: [
    { id: "inv-001", customer: "Acme Corp", product: "InvoiceNinja AI", amount: 15, status: "paid", createdAt: "2026-06-17T05:00:00.000Z", dueDate: "2026-07-17T05:00:00.000Z", paidAt: "2026-06-22T05:00:00.000Z" },
    { id: "inv-002", customer: "TechStart LLC", product: "InvoiceNinja AI", amount: 15, status: "paid", createdAt: "2026-06-19T05:00:00.000Z", dueDate: "2026-07-19T05:00:00.000Z", paidAt: "2026-06-25T05:00:00.000Z" },
    { id: "inv-003", customer: "DesignPro Agency", product: "InvoiceNinja AI", amount: 15, status: "pending", createdAt: "2026-06-24T05:00:00.000Z", dueDate: "2026-07-24T05:00:00.000Z" },
  ],
  financials: { revenue: 30, costs: 2.50, growth: "+15%" },
  strategy: "Build and launch AI-powered SaaS products targeting solo founders and small teams. Focus on tools that replace expensive human labor with affordable AI automation. Current priority: get AI CopyForge built and launched to expand revenue.",
  logs: [],
  createdAt: new Date().toISOString(),
};

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadState() {
  ensureDir();
  if (fs.existsSync(STATE_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
      return { ...SEED_STATE, ...data, agents: { ...SEED_STATE.agents, ...(data.agents || {}) } };
    } catch {
      // Corrupted, re-seed
    }
  }
  const seed = JSON.parse(JSON.stringify(SEED_STATE));
  fs.writeFileSync(STATE_FILE, JSON.stringify(seed, null, 2));
  return seed;
}

function saveState(state) {
  ensureDir();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

export function getState() {
  return loadState();
}

export function updateState(updater) {
  const state = loadState();
  const newState = updater(state);
  saveState(newState);
  return newState;
}

export function getFullStatus() {
  const state = loadState();
  const invoices = state.invoices || [];
  return {
    company: "NexAI",
    status: "running",
    timestamp: new Date().toISOString(),
    agents: Object.values(state.agents || {}),
    pipeline: state.pipeline || [],
    invoices: {
      total: invoices.length,
      paid: invoices.filter(i => i.status === "paid").length,
      pending: invoices.filter(i => i.status === "pending").length,
      overdue: invoices.filter(i => i.status === "overdue").length,
      totalAmount: invoices.reduce((sum, i) => sum + (i.amount || 0), 0),
      paidAmount: invoices.filter(i => i.status === "paid").reduce((sum, i) => sum + (i.amount || 0), 0),
    },
    financials: state.financials || { revenue: 0, costs: 0, growth: "+0%" },
    strategy: state.strategy || "",
    recentLogs: (state.logs || []).slice(-20).reverse(),
  };
}

export function updateAgentStatus(agentKey, status, tasksCompleted) {
  updateState((state) => {
    if (!state.agents[agentKey]) {
      state.agents[agentKey] = { key: agentKey, name: agentKey, status: "active", lastRun: null, tasksCompleted: 0 };
    }
    state.agents[agentKey].status = status;
    state.agents[agentKey].lastRun = new Date().toISOString();
    if (tasksCompleted !== undefined) {
      state.agents[agentKey].tasksCompleted = tasksCompleted;
    }
    return state;
  });
}

export function logAgentAction(agent, action, details) {
  ensureDir();
  const entry = {
    timestamp: new Date().toISOString(),
    agent,
    action,
    details: details ? JSON.stringify(details).substring(0, 500) : null,
  };
  
  // Write to log file
  try {
    fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + "\n");
  } catch {}
  
  // Also store in state for immediate retrieval
  updateState((state) => {
    if (!state.logs) state.logs = [];
    state.logs.push(entry);
    if (state.logs.length > 100) state.logs = state.logs.slice(-100);
    return state;
  });
}

export function getLogs(count = 50) {
  ensureDir();
  // Try file first
  if (fs.existsSync(LOG_FILE)) {
    try {
      const lines = fs.readFileSync(LOG_FILE, "utf-8").trim().split("\n").filter(Boolean);
      const logs = lines.slice(-count).map(line => {
        try { return JSON.parse(line); } catch { return null; }
      }).filter(Boolean).reverse();
      if (logs.length > 0) return logs;
    } catch {}
  }
  // Fallback to state
  const state = loadState();
  return (state.logs || []).slice(-count).reverse();
}
