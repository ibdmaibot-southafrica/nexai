/**
 * Database using Vercel Blob for persistence
 */

async function readBlob(name, defaultValue) {
  try {
    const { get } = await import('@vercel/blob');
    const blob = await get('nexai/' + name);
    if (!blob) return defaultValue;
    const res = await fetch(blob.url);
    return await res.json();
  } catch { return defaultValue; }
}

async function writeBlob(name, data) {
  const { put } = await import('@vercel/blob');
  await put('nexai/' + name, JSON.stringify(data, null, 2), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
  });
}

export async function getStatus() {
  const [agents, pipeline, invoices, financials, strategy, logs] = await Promise.all([
    readBlob('agents', [
      {key:'ceo',name:'CEO Agent',status:'active',lastRun:null,tasksCompleted:0},
      {key:'marketing',name:'Marketing Agent',status:'active',lastRun:null,tasksCompleted:0},
      {key:'tech',name:'Tech Agent',status:'active',lastRun:null,tasksCompleted:0},
      {key:'finance',name:'Finance Agent',status:'active',lastRun:null,tasksCompleted:0},
      {key:'analytics',name:'Analytics Agent',status:'active',lastRun:null,tasksCompleted:0}
    ]),
    readBlob('pipeline', []),
    readBlob('invoices', []),
    readBlob('financials', {revenue:0,costs:0,growth:'+0%'}),
    readBlob('strategy', 'Build AI products for solo founders.'),
    readBlob('logs', [])
  ]);
  const inv = invoices;
  return {
    company:'NexAI', status:'running', timestamp:new Date().toISOString(),
    agents, pipeline,
    invoices:{total:inv.length,paid:inv.filter(i=>i.status==='paid').length,pending:inv.filter(i=>i.status==='pending').length,overdue:inv.filter(i=>i.status==='overdue').length,totalAmount:inv.reduce((s,i)=>s+(i.amount||0),0),paidAmount:inv.filter(i=>i.status==='paid').reduce((s,i)=>s+(i.amount||0),0)},
    financials, strategy, recentLogs:logs.slice(0,20)
  };
}

export async function updateAgentStatus(key, status, delta) {
  const agents = await readBlob('agents', []);
  const a = agents.find(x => x.key === key);
  if (a) { a.status = status; a.lastRun = new Date().toISOString(); a.tasksCompleted = (a.tasksCompleted||0) + (delta||0); await writeBlob('agents', agents); }
}

export async function addPipelineItem(item) {
  const pipeline = await readBlob('pipeline', []);
  pipeline.push({id:item.id||'product-'+Date.now(),status:item.status||'research_complete',name:item.name,description:item.description||'',target_audience:item.targetAudience||'',price:item.price||0,category:item.category||'saas',quality_score:item.qualityScore||null,files:item.files||null,created_at:new Date().toISOString()});
  await writeBlob('pipeline', pipeline);
}

export async function updatePipelineItem(id, data) {
  const pipeline = await readBlob('pipeline', []);
  const idx = pipeline.findIndex(p => p.id === id);
  if (idx >= 0) { Object.assign(pipeline[idx], data, {updated_at:new Date().toISOString()}); await writeBlob('pipeline', pipeline); }
}

export async function addInvoice(inv) {
  const invoices = await readBlob('invoices', []);
  invoices.push({id:inv.id||'inv-'+Date.now(),customer:inv.customer,product:inv.product||'',amount:inv.amount,status:inv.status||'pending',created_at:new Date().toISOString()});
  await writeBlob('invoices', invoices);
}

export async function updateInvoiceStatus(id, status) {
  const invoices = await readBlob('invoices', []);
  const inv = invoices.find(i => i.id === id);
  if (inv) {
    inv.status = status;
    if (status === 'paid') {
      inv.paid_at = new Date().toISOString();
      const f = await readBlob('financials', {revenue:0,costs:0,growth:'+0%'});
      f.revenue = (f.revenue||0) + inv.amount;
      await writeBlob('financials', f);
    }
    await writeBlob('invoices', invoices);
  }
}

export async function logAction(agent, action, details) {
  const logs = await readBlob('logs', []);
  logs.unshift({id:Date.now(),agent,action,details:details?JSON.stringify(details).substring(0,500):null,created_at:new Date().toISOString()});
  if (logs.length > 200) logs.length = 200;
  await writeBlob('logs', logs);
}

export async function getLogs(count=50) { const logs = await readBlob('logs', []); return logs.slice(0, count); }
export async function getInvoices() { return await readBlob('invoices', []); }
export async function getInvoice(id) { const invoices = await readBlob('invoices', []); return invoices.find(i => i.id === id) || null; }
