/**
 * Database using Neon Postgres (via DATABASE_URL env var)
 */

import pg from "pg";
import { randomBytes } from "crypto";

const { Pool } = pg;

let pool = null;

export function getPool() {
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
    await client.query(`
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
      INSERT INTO agents (key, name, status, description) VALUES 
        ('ceo', 'CEO Agent', 'active', 'Strategic decisions, goal-setting, and company direction'),
        ('coding', 'Coding Agent', 'active', 'Builds new agent code files from CEO appointments and can modify the website'),
        ('marketing', 'Marketing Agent', 'active', 'Brand strategy, content, and market positioning'),
        ('tech', 'Tech Agent', 'active', 'Product development, engineering, and technical ops'),
        ('finance', 'Finance Agent', 'active', 'Financial planning, invoicing, and budget management'),
        ('analytics', 'Analytics Agent', 'active', 'Data analysis, reporting, and performance insights'),
        ('sales', 'Sales Agent', 'active', 'B2B sales, lead generation, and customer outreach'),
        ('product', 'Product Design Agent', 'active', 'UI/UX design, product research, and user experience'),
        ('prospector', 'Prospector Agent', 'active', 'Gets the catalog noticed by AI: lists services in agent registries, marketplaces, and AI tool directories'),
        ('viability', 'Viability Agent', 'active', 'Honest product critic: scores services, reports verdicts to the CEO, and discontinues weak products that have not sold')
      ON CONFLICT (key) DO NOTHING;
      INSERT INTO financials (revenue, costs, growth) VALUES (0, 0, '+0%') ON CONFLICT DO NOTHING;
      INSERT INTO strategy (content) VALUES ('Build AI-consumable micro-services (callable APIs) that autonomous AI agents discover and pay for per call. Sell AI to AI.') ON CONFLICT DO NOTHING;
      
      -- Create leads table for real sales tracking
      CREATE TABLE IF NOT EXISTS leads (
        id SERIAL PRIMARY KEY,
        company_name TEXT NOT NULL,
        website TEXT,
        location TEXT,
        industry TEXT,
        contact_email TEXT,
        contact_name TEXT,
        status TEXT DEFAULT 'researching',
        score INTEGER DEFAULT 0,
        outreach_subject TEXT,
        outreach_body TEXT,
        invoice_id TEXT,
        notes TEXT,
        source TEXT DEFAULT 'agent_research',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        contacted_at TIMESTAMPTZ,
        responded_at TIMESTAMPTZ
      );
      
      -- Create products table for actual built products
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        price NUMERIC DEFAULT 0,
        status TEXT DEFAULT 'planned',
        api_endpoint TEXT,
        docs_url TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        launched_at TIMESTAMPTZ
      );
      
      -- Create reports table for analytics
      CREATE TABLE IF NOT EXISTS reports (
        id SERIAL PRIMARY KEY,
        report_type TEXT NOT NULL,
        title TEXT NOT NULL,
        data JSONB DEFAULT '{}',
        summary TEXT DEFAULT '',
        period TEXT DEFAULT 'daily',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Create insights table for CEO strategic insights
      CREATE TABLE IF NOT EXISTS insights (
        id SERIAL PRIMARY KEY,
        category TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        priority TEXT DEFAULT 'medium',
        status TEXT DEFAULT 'active',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Create agent_code table: Coding Agent stores generated code here
      -- status lifecycle: pending -> building -> deployed | failed
      CREATE TABLE IF NOT EXISTS agent_code (
        id SERIAL PRIMARY KEY,
        agent_key TEXT NOT NULL,
        file_path TEXT NOT NULL,
        code TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        deployed_at TIMESTAMPTZ
      );

      -- Key/value settings (kill switch lives here as autonomy_enabled)
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );
      INSERT INTO settings (key, value) VALUES ('autonomy_enabled', 'true') ON CONFLICT (key) DO NOTHING;

      -- Orders: completed purchases (credits = agent paid per-call via funded API key)
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        product_id TEXT,
        buyer TEXT,
        amount NUMERIC DEFAULT 0,
        currency TEXT DEFAULT 'USD',
        channel TEXT DEFAULT 'credits',
        payment_ref TEXT,
        status TEXT DEFAULT 'paid',
        deliverable TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Build-gate state machine: one row per in-flight/finished deploy
      -- status lifecycle: building -> merged | failed
      CREATE TABLE IF NOT EXISTS deployments (
        id SERIAL PRIMARY KEY,
        branch TEXT NOT NULL,
        head_sha TEXT,
        status TEXT DEFAULT 'building',
        agent_code_ids TEXT,
        detail TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    
    // Add new columns to existing tables (separate queries for safety)
    try { await client.query("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD'"); } catch {}
    try { await client.query("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paypal_link TEXT"); } catch {}
    try { await client.query("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paypal_me_link TEXT"); } catch {}
    try { await client.query("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS pipeline_item_id TEXT"); } catch {}
    try { await client.query("ALTER TABLE pipeline ADD COLUMN IF NOT EXISTS target_audience TEXT DEFAULT ''"); } catch {}
    try { await client.query("ALTER TABLE pipeline ADD COLUMN IF NOT EXISTS quality_score INTEGER"); } catch {}
    try { await client.query("ALTER TABLE agents ADD COLUMN IF NOT EXISTS description TEXT DEFAULT ''"); } catch {}
    // Storefront / agent-commerce columns on products
    try { await client.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'ai-tool'"); } catch {}
    try { await client.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD'"); } catch {}
    try { await client.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS delivery_type TEXT DEFAULT 'api'"); } catch {}
    try { await client.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS deliverable TEXT"); } catch {}
    try { await client.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS pipeline_item_id TEXT"); } catch {}
    // AI-consumable service products: the prompt executed per paid call + input hint.
    try { await client.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS system_prompt TEXT"); } catch {}
    try { await client.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS input_hint TEXT"); } catch {}
    // Moat: a product may use a tool (e.g. 'web_fetch') to bring in live data the
    // buyer's own LLM can't, before the prompt runs.
    try { await client.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS tool TEXT"); } catch {}
    // Cache: identical (product,input) calls are served from here — cheaper margin,
    // faster, and the seed of an accumulating proprietary dataset.
    try {
      await client.query(`CREATE TABLE IF NOT EXISTS result_cache (
        product_id TEXT NOT NULL,
        input_hash TEXT NOT NULL,
        result TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (product_id, input_hash)
      )`);
    } catch {}
    // Credit top-ups link a PayPal invoice to the API key being funded.
    try { await client.query("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS api_key TEXT"); } catch {}
    // API keys: buyers fund a credit balance via PayPal, then their agent spends per call.
    try {
      await client.query(`CREATE TABLE IF NOT EXISTS api_keys (
        key TEXT PRIMARY KEY,
        label TEXT,
        credits NUMERIC DEFAULT 0,
        status TEXT DEFAULT 'active',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        last_used_at TIMESTAMPTZ
      )`);
    } catch {}
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
  const id = inv.id || "inv-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6);
  // Try with new columns first, fall back to old schema
  try {
    await getPool().query(
      "INSERT INTO invoices (id, customer, product, amount, status, currency, paypal_link, paypal_me_link, pipeline_item_id, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())",
      [id, inv.customer, inv.product || "", inv.amount, inv.status || "pending", inv.currency || "USD", inv.paypal_link || null, inv.paypal_me_link || null, inv.pipeline_item_id || null]
    );
  } catch {
    // Fallback for old schema without new columns
    await getPool().query(
      "INSERT INTO invoices (id, customer, product, amount, status, created_at) VALUES ($1, $2, $3, $4, $5, NOW())",
      [id, inv.customer, inv.product || "", inv.amount, inv.status || "pending"]
    );
  }
  return { id, customer: inv.customer, product: inv.product, amount: inv.amount, status: inv.status || "pending" };
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

// ===== SETTINGS (kill switch + flags) =====

export async function getSetting(key, fallback = null) {
  await init();
  const res = await getPool().query("SELECT value FROM settings WHERE key = $1", [key]);
  return res.rows[0]?.value ?? fallback;
}

export async function setSetting(key, value) {
  await init();
  await getPool().query(
    "INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2",
    [key, String(value)]
  );
}

// ===== SELF-BUILD: agent_code + deployments (build-gate state machine) =====

export async function getAgentCodeByStatus(status) {
  await init();
  const res = await getPool().query(
    "SELECT * FROM agent_code WHERE status = $1 ORDER BY created_at ASC",
    [status]
  );
  return res.rows;
}

export async function setAgentCodeStatus(ids, status) {
  if (!ids || ids.length === 0) return;
  await init();
  const deployedAt = status === "deployed" ? "NOW()" : "deployed_at";
  await getPool().query(
    `UPDATE agent_code SET status = $1, deployed_at = ${deployedAt} WHERE id = ANY($2::int[])`,
    [status, ids]
  );
}

export async function createDeployment({ branch, head_sha, agent_code_ids }) {
  await init();
  const res = await getPool().query(
    "INSERT INTO deployments (branch, head_sha, status, agent_code_ids) VALUES ($1, $2, 'building', $3) RETURNING *",
    [branch, head_sha || null, JSON.stringify(agent_code_ids || [])]
  );
  return res.rows[0];
}

// The single in-flight deploy, if any (we serialize: at most one 'building')
export async function getActiveDeployment() {
  await init();
  const res = await getPool().query(
    "SELECT * FROM deployments WHERE status = 'building' ORDER BY id DESC LIMIT 1"
  );
  const row = res.rows[0];
  if (row && typeof row.agent_code_ids === "string") {
    try { row.agent_code_ids = JSON.parse(row.agent_code_ids); } catch { row.agent_code_ids = []; }
  }
  return row || null;
}

export async function updateDeployment(id, data) {
  await init();
  const fields = Object.keys(data).map((k, i) => k + " = $" + (i + 2)).join(", ");
  await getPool().query(
    "UPDATE deployments SET " + fields + ", updated_at = NOW() WHERE id = $1",
    [id, ...Object.values(data)]
  );
}

export async function getActiveAgentKeys() {
  await init();
  const res = await getPool().query("SELECT key FROM agents WHERE status = 'active' ORDER BY key");
  return res.rows.map(r => r.key);
}

// Agents in a given lifecycle status (e.g. 'error') — used by the coding agent's
// self-maintenance pass to find and repair broken agents.
export async function getAgentsByStatus(status) {
  await init();
  const res = await getPool().query(
    "SELECT key, name, description FROM agents WHERE status = $1 ORDER BY key",
    [status]
  );
  return res.rows;
}

// Custom agents that have generated code but none of it deployed yet. Their file
// doesn't exist in the repo build, so the runner must skip them until a build
// merges. Core agents have no agent_code rows, so they never appear here.
export async function getUndeployedAgentKeys() {
  await init();
  const res = await getPool().query(
    "SELECT agent_key FROM agent_code GROUP BY agent_key HAVING bool_or(status = 'deployed') = false"
  );
  return res.rows.map(r => r.agent_key);
}

// ===== PRODUCTS (data-driven storefront + agent-commerce catalog) =====

function mapProduct(p) {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    price: Number(p.price),
    currency: p.currency || "USD",
    status: p.status,
    category: p.category || "ai-tool",
    deliveryType: p.delivery_type || "api",
    apiEndpoint: p.api_endpoint || null,
    docsUrl: p.docs_url || null,
    systemPrompt: p.system_prompt || null,
    inputHint: p.input_hint || null,
    tool: p.tool || null,
    createdAt: p.created_at?.toISOString?.() || p.created_at,
    launchedAt: p.launched_at?.toISOString?.() || p.launched_at || null,
  };
}

export async function addProduct(product) {
  await init();
  const id = product.id || "prod-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6);
  await getPool().query(
    `INSERT INTO products (id, name, description, price, status, category, currency, delivery_type, deliverable, api_endpoint, docs_url, pipeline_item_id, system_prompt, input_hint, tool, created_at, launched_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,NOW(),$16)
     ON CONFLICT (id) DO UPDATE SET name=$2, description=$3, price=$4, status=$5, category=$6, currency=$7, delivery_type=$8, deliverable=$9, api_endpoint=$10, docs_url=$11, system_prompt=$13, input_hint=$14, tool=$15`,
    [
      id, product.name, product.description || "", product.price || 0,
      product.status || "live", product.category || "ai-tool", product.currency || "USD",
      product.deliveryType || "api", product.deliverable || null,
      product.apiEndpoint || null, product.docsUrl || null, product.pipelineItemId || null,
      product.systemPrompt || null, product.inputHint || null, product.tool || null,
      product.status === "live" ? new Date().toISOString() : null,
    ]
  );
  return { id };
}

export async function updateProduct(id, data) {
  await init();
  const fields = Object.keys(data).map((k, i) => k + " = $" + (i + 2)).join(", ");
  await getPool().query("UPDATE products SET " + fields + " WHERE id = $1", [id, ...Object.values(data)]);
}

// Products available to buy (live). Used by the storefront + agent catalog.
export async function getProducts({ onlyLive = true } = {}) {
  await init();
  const q = onlyLive
    ? "SELECT * FROM products WHERE status = 'live' ORDER BY created_at DESC"
    : "SELECT * FROM products ORDER BY created_at DESC";
  const res = await getPool().query(q);
  return res.rows.map(mapProduct);
}

export async function getProduct(id) {
  await init();
  const res = await getPool().query("SELECT * FROM products WHERE id = $1", [id]);
  return res.rows[0] ? mapProduct(res.rows[0]) : null;
}

// Result cache: cheap repeat-serves + the start of a proprietary dataset.
export async function getCachedResult(productId, inputHash) {
  await init();
  const res = await getPool().query("SELECT result FROM result_cache WHERE product_id = $1 AND input_hash = $2", [productId, inputHash]);
  return res.rows[0]?.result ?? null;
}
export async function setCachedResult(productId, inputHash, result) {
  await init();
  await getPool().query(
    "INSERT INTO result_cache (product_id, input_hash, result) VALUES ($1,$2,$3) ON CONFLICT (product_id, input_hash) DO UPDATE SET result = $3, created_at = NOW()",
    [productId, inputHash, result]
  );
}

// ===== ORDERS (completed purchases) =====

export async function createOrder(order) {
  await init();
  const res = await getPool().query(
    `INSERT INTO orders (product_id, buyer, amount, currency, channel, payment_ref, status, deliverable)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id, created_at`,
    [
      order.productId || null, order.buyer || "agent", order.amount || 0,
      order.currency || "USD", order.channel || "credits", order.paymentRef || null,
      order.status || "paid", order.deliverable || null,
    ]
  );
  // Count paid revenue immediately.
  if ((order.status || "paid") === "paid") {
    await getPool().query("UPDATE financials SET revenue = revenue + $1 WHERE id = 1", [Number(order.amount) || 0]);
  }
  return res.rows[0];
}

export async function getOrders(limit = 50) {
  await init();
  const res = await getPool().query("SELECT * FROM orders ORDER BY created_at DESC LIMIT $1", [limit]);
  return res.rows.map(o => ({ ...o, amount: Number(o.amount) }));
}

// ===== API KEYS + CREDITS (PayPal-funded, agent-spent) =====

export async function createApiKey(label) {
  await init();
  const key = "nexk_" + randomBytes(24).toString("hex");
  await getPool().query("INSERT INTO api_keys (key, label, credits) VALUES ($1, $2, 0)", [key, label || "agent key"]);
  return { key, credits: 0 };
}

export async function getApiKey(key) {
  await init();
  const res = await getPool().query("SELECT key, label, credits, status FROM api_keys WHERE key = $1", [key]);
  if (!res.rows[0]) return null;
  return { ...res.rows[0], credits: Number(res.rows[0].credits) };
}

// Pending PayPal invoice that will credit `apiKey` with `amount` once paid.
export async function createTopupInvoice(id, apiKey, amount) {
  await init();
  await getPool().query(
    "INSERT INTO invoices (id, customer, product, amount, status, currency, api_key, created_at) VALUES ($1, $2, $3, $4, 'pending', 'USD', $5, NOW())",
    [id, "Agent credit top-up", "API credits", amount, apiKey]
  );
}

// Atomically debit `amount` only if the key is active and has enough credit.
// Returns { ok, balance } — ok=false (insufficient/invalid) leaves balance unchanged.
export async function debitCredits(key, amount) {
  await init();
  const res = await getPool().query(
    "UPDATE api_keys SET credits = credits - $2, last_used_at = NOW() WHERE key = $1 AND status = 'active' AND credits >= $2 RETURNING credits",
    [key, amount]
  );
  if (!res.rows[0]) {
    const cur = await getApiKey(key);
    return { ok: false, balance: cur ? cur.credits : 0 };
  }
  return { ok: true, balance: Number(res.rows[0].credits) };
}

// Refund credits (e.g. when a paid call fails before producing output).
export async function creditKey(key, amount) {
  await init();
  await getPool().query("UPDATE api_keys SET credits = credits + $2 WHERE key = $1", [key, amount]);
}

// Complete a PayPal credit top-up: idempotently mark the invoice paid and add
// its amount to the linked API key's balance. Safe to call repeatedly (webhooks
// can fire more than once).
export async function completeTopup(invoiceId) {
  await init();
  const pool = getPool();
  const inv = await pool.query("SELECT id, amount, status, api_key FROM invoices WHERE id = $1", [invoiceId]);
  const row = inv.rows[0];
  if (!row || !row.api_key) return { credited: false, reason: "not a key top-up" };
  if (row.status === "paid") return { credited: false, reason: "already credited" };
  const amount = Number(row.amount);
  await pool.query("UPDATE invoices SET status = 'paid', paid_at = NOW() WHERE id = $1", [invoiceId]);
  await pool.query("UPDATE api_keys SET credits = credits + $2 WHERE key = $1", [row.api_key, amount]);
  await pool.query("UPDATE financials SET revenue = revenue + $1 WHERE id = 1", [amount]);
  return { credited: true, key: row.api_key, amount };
}

// Promote any launched pipeline item that isn't in the store yet into a live
// product. Idempotent — called every cycle so the storefront tracks launches
// however they happen (CEO launch phase or the launch-validated endpoint).
export async function syncLaunchedToStore() {
  await init();
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT p.* FROM pipeline p
     WHERE p.status = 'launched'
       AND NOT EXISTS (SELECT 1 FROM products pr WHERE pr.pipeline_item_id = p.id)`
  );
  let created = 0;
  for (const p of rows) {
    await addProduct({
      name: p.name,
      description: p.description || "",
      price: Number(p.price) || 0,
      category: p.category || "ai-tool",
      status: "live",
      deliveryType: "api",
      pipelineItemId: p.id,
    });
    created++;
  }
  return created;
}

// ===== CEO AGENT MANAGEMENT =====

export async function addAgent(key, name, description) {
  await init();
  await getPool().query(
    "INSERT INTO agents (key, name, status, description, tasks_completed, updated_at) VALUES ($1, $2, 'active', $3, 0, NOW()) ON CONFLICT (key) DO UPDATE SET name = $2, description = $3, updated_at = NOW()",
    [key, name, description || ""]
  );
}

export async function removeAgent(key) {
  if (key === "ceo") return false; // Can't remove the CEO
  await init();
  await getPool().query("UPDATE agents SET status = 'disabled', updated_at = NOW() WHERE key = $1", [key]);
  return true;
}

export async function updateAgentConfig(key, data) {
  await init();
  const fields = Object.keys(data).map((k, i) => k + " = $" + (i + 2)).join(", ");
  await getPool().query("UPDATE agents SET " + fields + ", updated_at = NOW() WHERE key = $1", [key, ...Object.values(data)]);
}

// ===== ANALYTICS & REPORTING =====

export async function generateReport(reportType, title, data, summary, period = 'daily') {
  await init();
  const res = await getPool().query(
    "INSERT INTO reports (report_type, title, data, summary, period) VALUES ($1, $2, $3, $4, $5) RETURNING *",
    [reportType, title, JSON.stringify(data), summary, period]
  );
  return res.rows[0];
}

export async function getReports(reportType = null, limit = 20) {
  await init();
  let query = "SELECT * FROM reports";
  const params = [];
  if (reportType) {
    query += " WHERE report_type = $1";
    params.push(reportType);
  }
  query += " ORDER BY created_at DESC LIMIT $" + (params.length + 1);
  params.push(limit);
  const res = await getPool().query(query, params);
  return res.rows.map(r => ({ ...r, data: typeof r.data === 'string' ? JSON.parse(r.data) : r.data }));
}

export async function getAnalytics() {
  await init();
  
  // Gather all data for analytics
  const pool = getPool();
  const [agentsRes, pipelineRes, invoicesRes, logsRes, leadsRes, productsRes, financialsRes, topProdRes] = await Promise.all([
    pool.query("SELECT * FROM agents"),
    pool.query("SELECT * FROM pipeline"),
    pool.query("SELECT * FROM invoices"),
    pool.query("SELECT * FROM logs ORDER BY created_at DESC LIMIT 100"),
    pool.query("SELECT * FROM leads"),
    pool.query("SELECT * FROM products"),
    pool.query("SELECT * FROM financials ORDER BY id DESC LIMIT 1"),
    // Top products by real sales (orders), revenue desc
    pool.query(`SELECT p.id, p.name, p.price, p.category, p.status,
                       COUNT(o.id)::int AS sales,
                       COALESCE(SUM(o.amount),0)::float AS revenue
                FROM products p LEFT JOIN orders o ON o.product_id = p.id
                GROUP BY p.id, p.name, p.price, p.category, p.status
                ORDER BY revenue DESC, sales DESC, p.created_at DESC
                LIMIT 8`).catch(() => ({ rows: [] })),
  ]);
  
  const agents = agentsRes.rows;
  const pipeline = pipelineRes.rows;
  const invoices = invoicesRes.rows;
  const logs = logsRes.rows;
  const leads = leadsRes.rows;
  const products = productsRes.rows;
  const financials = financialsRes.rows[0] || { revenue: 0, costs: 0, growth: "+0%" };
  
  // Calculate metrics
  const totalRevenue = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.amount), 0);
  const pendingRevenue = invoices.filter(i => i.status === 'pending').reduce((s, i) => s + Number(i.amount), 0);
  const totalInvoices = invoices.length;
  const paidInvoices = invoices.filter(i => i.status === 'paid').length;
  
  const pipelineByStatus = {};
  pipeline.forEach(p => { pipelineByStatus[p.status] = (pipelineByStatus[p.status] || 0) + 1; });
  
  const leadsByStatus = {};
  leads.forEach(l => { leadsByStatus[l.status] = (leadsByStatus[l.status] || 0) + 1; });
  
  const agentActivity = {};
  logs.forEach(l => {
    const agent = l.agent;
    if (!agentActivity[agent]) agentActivity[agent] = { actions: 0, lastAction: null };
    agentActivity[agent].actions++;
    if (!agentActivity[agent].lastAction) agentActivity[agent].lastAction = l.created_at;
  });
  
  // Revenue over time (last 7 days)
  const now = new Date();
  const revenueByDay = {};
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    revenueByDay[key] = 0;
  }
  invoices.filter(i => i.status === 'paid' && i.paid_at).forEach(i => {
    const key = new Date(i.paid_at).toISOString().split('T')[0];
    if (revenueByDay[key] !== undefined) revenueByDay[key] += Number(i.amount);
  });
  
  // Agent performance
  const agentPerformance = agents.map(a => ({
    name: a.name,
    key: a.key,
    status: a.status,
    tasksCompleted: a.tasks_completed || 0,
    lastRun: a.last_run,
    recentActions: agentActivity[a.key]?.actions || 0,
  }));
  
  return {
    generated_at: new Date().toISOString(),
    financials: {
      total_revenue: totalRevenue,
      pending_revenue: pendingRevenue,
      total_invoices: totalInvoices,
      paid_invoices: paidInvoices,
      collection_rate: totalInvoices > 0 ? Math.round((paidInvoices / totalInvoices) * 100) : 0,
      revenue_by_day: revenueByDay,
    },
    pipeline: {
      total: pipeline.length,
      by_status: pipelineByStatus,
      items: pipeline.map(p => ({ name: p.name, status: p.status, price: Number(p.price) })),
    },
    leads: {
      total: leads.length,
      by_status: leadsByStatus,
      top_leads: leads.sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 5).map(l => ({
        company: l.company_name, status: l.status, score: l.score,
      })),
    },
    agents: agentPerformance,
    products: products.map(p => ({ name: p.name, status: p.status, price: Number(p.price) })),
    top_products: (topProdRes.rows || []).map(r => ({ id: r.id, name: r.name, price: Number(r.price), category: r.category, status: r.status, sales: Number(r.sales) || 0, revenue: Number(r.revenue) || 0 })),
    recent_logs: logs.slice(0, 20).map(l => ({
      agent: l.agent, action: l.action, details: l.details,
      created_at: l.created_at,
    })),
  };
}
