import { logAction, updateAgentStatus, getStatus, getPool } from "../lib/db.js";
import fs from "fs";
import path from "path";

// The Coding Agent reads CEO-appointed agents from the database
// and generates fully functional agent code for them.

function sanitize(str) {
  return (str || "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, " ")
    .replace(/\r/g, "")
    .substring(0, 200);
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
    const { rows: allAgents } = await pool.query(
      "SELECT key, name, description FROM agents WHERE key NOT IN ('ceo', 'coding') AND status = 'active' ORDER BY key"
    );

    // Check which agents already have code files on disk
    const agentsDir = path.join(process.cwd(), "agents");
    const agentsToBuild = [];
    for (const agent of allAgents) {
      const filePath = path.join(agentsDir, agent.key + ".js");
      if (fs.existsSync(filePath)) {
        // File exists — check if it has a valid run function
        try {
          const content = fs.readFileSync(filePath, "utf8");
          const capKey = agent.key.charAt(0).toUpperCase() + agent.key.slice(1);
          const fnName = `run${capKey}Cycle`;
          if (!content.includes(fnName)) {
            // File exists but doesn't have the right function — rebuild
            agentsToBuild.push(agent);
          }
        } catch {
          agentsToBuild.push(agent);
        }
      } else {
        // No file — need to build
        agentsToBuild.push(agent);
      }
    }

    decisions.agentsToBuild = agentsToBuild.map((a) => a.key);
    decisions.totalAgents = allAgents.length;

    let built = 0;
    for (const agent of agentsToBuild) {
      try {
        const code = generateAgentCode(agent.key, agent.name, agent.description);
        // Write to /tmp/agents/ — writable on Vercel
        const tmpDir = "/tmp/agents";
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
        fs.writeFileSync(path.join(tmpDir, agent.key + ".js"), code);
        built++;
        decisions["built_" + agent.key] = true;
        await logAction("Coding", "agent_built", { key: agent.key, name: agent.name });
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
