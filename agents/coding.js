import { logAction, updateAgentStatus, getStatus, getPool } from "../lib/db.js";

// The Coding Agent reads CEO-appointed agents from the database,
// generates code, and stores it in the agent_code table.
// The /api/agents/deploy endpoint then pushes to GitHub via API → Vercel auto-deploys.

function sanitize(str) {
  return (str || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ").replace(/\r/g, "").substring(0, 200);
}

export function generateAgentCode(agentKey, agentName, agentDescription) {
  const capKey = agentKey.charAt(0).toUpperCase() + agentKey.slice(1);
  const safeName = sanitize(agentName);
  const safeDesc = sanitize(agentDescription || agentName + " for NexAI");
  const lines = [];
  lines.push('import { chat } from "../lib/llm.js";');
  lines.push('import { logAction, updateAgentStatus, getStatus } from "../lib/db.js";');
  lines.push("");
  lines.push("export async function run" + capKey + "Cycle() {");
  lines.push('  await updateAgentStatus("' + agentKey + '", "running", 0);');
  lines.push("  try {");
  lines.push("    const status = await getStatus();");
  lines.push("    const action = {};");
  lines.push("    const response = await chat(");
  lines.push('      "You are the ' + safeName + ' of NexAI. ' + safeDesc + '",');
  lines.push('      "Pipeline: " + status.pipeline.length + " items, Revenue: $" + (status.financials?.revenue || 0) + ". What should you do? JSON: {action, details}",');
  lines.push("      { temperature: 0.6 }");
  lines.push("    );");
  lines.push("    try {");
  lines.push("      const m = response.match(/\\{[\\s\\S]*\\}/);");
  lines.push("      if (m) action.result = JSON.parse(m[0]);");
  lines.push("    } catch {}");
  lines.push('    await logAction("' + safeName + '", "cycle_complete", action);');
  lines.push('    await updateAgentStatus("' + agentKey + '", "active", 1);');
  lines.push('    return { agent: "' + safeName + '", action: "' + agentKey + '_cycle", ...action };');
  lines.push("  } catch (err) {");
  lines.push('    await updateAgentStatus("' + agentKey + '", "error", 0);');
  lines.push('    return { agent: "' + safeName + '", action: "error", error: err.message };');
  lines.push("  }");
  lines.push("}");
  return lines.join("\n");
}

export async function runCodingCycle() {
  await updateAgentStatus("coding", "running", 0);
  const decisions = {};
  try {
    const pool = getPool();
    const status = await getStatus();
    const { rows: allAgents } = await pool.query(
      "SELECT key, name, description FROM agents WHERE status = 'active' ORDER BY key"
    );
    const { rows: existingCode } = await pool.query(
      "SELECT DISTINCT agent_key FROM agent_code WHERE status IN ('pending', 'deployed')"
    );
    const existingKeys = new Set(existingCode.map((c) => c.agent_key));
    const coreAgents = new Set(["ceo", "marketing", "tech", "product", "sales", "finance", "analytics"]);
    const agentsToBuild = allAgents.filter((a) => !existingKeys.has(a.key) && !coreAgents.has(a.key));
    decisions.agentsToBuild = agentsToBuild.map((a) => a.key);
    let built = 0;
    for (const agent of agentsToBuild) {
      try {
        const code = generateAgentCode(agent.key, agent.name, agent.description);
        await pool.query(
          "INSERT INTO agent_code (agent_key, file_path, code, status) VALUES ($1, $2, $3, 'pending')",
          [agent.key, "agents/" + agent.key + ".js", code]
        );
        built++;
        decisions["built_" + agent.key] = true;
        await logAction("Coding", "agent_code_generated", { key: agent.key, name: agent.name });
      } catch (err) {
        decisions["failed_" + agent.key] = err.message;
      }
    }
    decisions.built = built;
    await updateAgentStatus("coding", "active", 1);
    return { agent: "Coding", action: "coding_cycle", ...decisions };
  } catch (err) {
    await updateAgentStatus("coding", "error", 0);
    return { agent: "Coding", action: "error", error: err.message };
  }
}
