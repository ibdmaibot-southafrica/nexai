const fs = require('fs');
const content = `/**
 * Database using Neon Postgres (via DATABASE_URL env var)
 */

import pg from "pg";

const { Pool } = pg;

let pool = null;

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL environment variable is not set");
    }
    pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
  }
  return pool;
}

let tablesEnsured = false;
async function ensureTables() {
  const client = await getPool().connect();
  try {
    await client.query(\`
      CREATE TABLE IF NOT EXISTS agents (
        key TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        last_run TIMESTAMPTZ,
        tasks_completed INTEGER DEFAULT 0,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS pipeline (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        status TEXT DEFAULT 'research_complete',
        target_audience TEXT DEFAULT '',
        price NUMERIC DEFAULT 0,
        category TEXT DEFAULT 'saas',
        quality_score INTEGER,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ
      );
      CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY,
        customer TEXT NOT NULL,
        product TEXT DEFAULT '',
        amount NUMERIC DEFAULT 0,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        paid_at TIMESTAMPTZ
      );
      CREATE TABLE IF NOT EXISTS financials (
        id SERIAL PRIMARY KEY,
        revenue NUMERIC DEFAULT 0,
        costs NUMERIC DEFAULT 0,
        growth TEXT DEFAULT '+0%'
      );
      CREATE TABLE IF NOT EXISTS strategy (
        id SERIAL PRIMARY KEY,
        content TEXT NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS logs (
        id SERIAL PRIMARY KEY,
        agent TEXT NOT NULL,
        action TEXT NOT NULL,
        details TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      INSERT INTO agents (key, name, status) VALUES 
        ('ceo', 'CEO Agent', 'active'), 
        ('marketing', 'Marketing Agent', 'active'), 
        ('tech', 'Tech Agent', 'active'), 
        ('finance', 'Finance Agent', 'active'), 
        ('analytics', 'Analytics Agent', 'active') 
      ON CONFLICT (key) DO NOTHING;
      INSERT INTO financials (revenue, costs, growth) VALUES (0, 0, '+0%') ON CONFLICT DO NOTHING;
      INSERT INTO strategy (content) VALUES ('Build AI products for solo founders.') ON CONFLICT DO NOTHING;
    \`);
  } finally {
    client.release();
  }
}

async function init() {
  if (!tablesEnsured) {
    await ensureTables();
    tablesEnsured = true;
  }
}

export async function getStatus() {
  await init();
  const pool = getPool();
  const [agentsRes, pipelineRes, invoicesRes, financialsRes, strategyRes, logsRes] = await Promise.all([
    pool.query("SELECT * FROM agents ORDER BY key"),
    pool.query("SELECT * FROM pipeline ORDER BY created_at DESC"),
    pool.query("SELECT * FROM invoices ORDER BY created_at DESC"),
    pool.query("SELECT * FROM financials ORDER BY id DESC LIMIT 1"),
    pool.query("SELECT * FROM strategy ORDER BY updated_at DESC LIMIT 1"),
    pool.query("SELECT * FROM logs ORDER BY created_at DESC LIMIT 20"),
  ]);
  const invoices = invoicesRes.rows;
  const financials = financialsRes.rows[0] || { revenue: 0, costs: 0, growth: "+0%" };
  const strategy = strategyRes.rows[0]?.content || "Build AI products for solo founders.";
  return {
    company: "NexAI", status: "running", timestamp: new Date().toISOString(),
    agents: agentsRes.rows.map(a => ({ key: a.key, name: a.name, status: a.status, lastRun: a.last_run?.toISOString() || null, tasksCompleted: a.tasks_completed })),
    pipeline: pipelineRes.rows.map(p => ({ id: p.id, name: p.name, description: p.description, status: p.status, targetAudience: p.target_audience, price: Number(p.price), category: p.category, qualityScore: p.quality_score, created_at: p.created_at?.toISOString(), updated_at: p.updated_at?.toISOString() })),
    invoices: { 
      total: invoices.length, 
      paid: invoices.filter(i => i.status === "paid").length, 
      pending: invoices.filter(i => i.status === "pending").length, 
      overdue: invoices.filter(i => i.status === "overdue").length, 
      totalAmount: invoices.reduce((s, i) => s + Number(i.amount), 0), 
      paidAmount: invoices.filter(i => i.status === "paid").reduce((s, i) => s + Number(i.amount), 0) 
    },
    financials: { revenue: Number(financials.revenue), costs: Number(financials.costs), growth: financials.growth },
    strategy,
    recentLogs: logsRes.rows.map(l => ({ id: l.id, agent: l.agent, action: l.action, details: l.details, created_at: l.created_at?.toISOString() })),
  };
}

export async function updateAgentStatus(key, status, delta) {
  await init();
  await getPool().query(
    "INSERT INTO agents (key, name, status, last_run, tasks_completed, updated_at) VALUES ($1, $2, $3, NOW(), $4, NOW()) ON CONFLICT (key) DO UPDATE SET status = $3, last_run = NOW(), tasks_completed = COALESCE(agents.tasks_completed, 0) + $4, updated_at = NOW()",
    [key, key.charAt(0).toUpperCase() + key.slice(1) + " Agent", status, delta || 0]
  );
}

export async function addPipelineItem(item) {
  await init();
  await getPool().query(
    "INSERT INTO pipeline (id, name, description, status, target_audience, price, category, quality_score, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())",
    [item.id || "product-" + Date.now(), item.name, item.description || "", item.status || "research_complete", item.targetAudience || "", item.price || 0, item.category || "saas", item.qualityScore || null]
  );
}

export async function updatePipelineItem(id, data) {
  await init();
  const fields = Object.keys(data).map((k, i) => k + " = $" + (i + 2)).join(", ");
  await getPool().query("UPDATE pipeline SET " + fields + ", updated_at = NOW() WHERE id = $1", [id, ...Object.values(data)]);
}

export async function addInvoice(inv) {
  await init();
  await getPool().query(
    "INSERT INTO invoices (id, customer, product, amount, status, created_at) VALUES ($1, $2, $3, $4, $5, NOW())",
    [inv.id || "inv-" + Date.now(), inv.customer, inv.product || "", inv.amount, inv.status || "pending"]
  );
}

export async function updateInvoiceStatus(id, status) {
  await init();
  if (status === "paid") {
    await getPool().query("UPDATE invoices SET status = $2, paid_at = NOW() WHERE id = $1", [id, status]);
    const invRes = await getPool().query("SELECT amount FROM invoices WHERE id = $1", [id]);
    if (invRes.rows[0]) await getPool().query("UPDATE financials SET revenue = revenue + $1 WHERE id = 1", [Number(invRes.rows[0].amount)]);
  } else {
    await getPool().query("UPDATE invoices SET status = $2 WHERE id = $1", [id, status]);
  }
}

export async function logAction(agent, action, details) {
  await init();
  await getPool().query(
    "INSERT INTO logs (agent, action, details) VALUES ($1, $2, $3)",
    [agent, action, details ? JSON.stringify(details).substring(0, 500) : null]
  );
}

export async function getLogs(count = 50) {
  await init();
  const res = await getPool().query("SELECT * FROM logs ORDER BY created_at DESC LIMIT $1", [count]);
  return res.rows.map(l => ({ id: l.id, agent: l.agent, action: l.action, details: l.details, created_at: l.created_at?.toISOString() }));
}

export async function getInvoices() {
  await init();
  const res = await getPool().query("SELECT * FROM invoices ORDER BY created_at DESC");
  return res.rows.map(i => ({ ...i, amount: Number(i.amount) }));
}

export async function getInvoice(id) {
  await init();
  const res = await getPool().query("SELECT * FROM invoices WHERE id = $1", [id]);
  if (res.rows[0]) return { ...res.rows[0], amount: Number(res.rows[0].amount) };
  return null;
}

export async function getFullStatus() { return await getStatus(); }
export async function getState() { return await getStatus(); }
export async function updateState(data) {
  if (data && typeof data === "object") {
    await init();
    if (data.strategy) await getPool().query("UPDATE strategy SET content = $1, updated_at = NOW() WHERE id = 1", [data.strategy]);
  }
  return true;
}
export async function logAgentAction(agent, action, details) { return await logAction(agent, action, details); }
`;

fs.writeFileSync('lib/db.js', content, 'utf8');
console.log('db.js written with Neon Postgres - length:', content.length);
