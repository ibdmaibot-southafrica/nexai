import { getPool } from "../../../../lib/db.js";
import { requireSecret } from "../../../../lib/auth.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const GITHUB_REPO = "ibdmaibot-southafrica/nexai";
const GITHUB_API = "https://api.github.com";

// Only allow writing agent files under agents/ with a safe, flat filename.
// Defends the auto-deploy pipeline against path traversal / overwriting other
// files if a bad file_path ever lands in the agent_code table.
function isSafeAgentPath(filePath) {
  return typeof filePath === "string" && /^agents\/[a-z][a-z0-9_]{1,30}\.js$/.test(filePath);
}

// POST /api/agents/deploy — reads agent_code table, pushes to GitHub via API
export async function POST(request) {
  const denied = requireSecret(request);
  if (denied) return denied;

  try {
    const pool = getPool();

    // Get all pending code that hasn't been deployed
    const { rows: pendingCode } = await pool.query(
      "SELECT * FROM agent_code WHERE status = 'pending' ORDER BY created_at ASC"
    );

    if (pendingCode.length === 0) {
      return Response.json({ success: true, message: "No pending code to deploy", deployed: 0 });
    }

    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      return Response.json({ error: "GITHUB_TOKEN not set" }, { status: 500 });
    }

    const results = [];
    let deployed = 0;

    for (const item of pendingCode) {
      try {
        const filePath = item.file_path;

        // Reject anything that isn't a safe agents/<key>.js path. Mark it failed
        // so it isn't retried forever.
        if (!isSafeAgentPath(filePath)) {
          await pool.query(
            "UPDATE agent_code SET status = 'rejected' WHERE id = $1",
            [item.id]
          );
          results.push({ file: filePath, status: "rejected", error: "unsafe file path" });
          continue;
        }

        const content = Buffer.from(item.code).toString("base64");

        // Check if file exists
        let sha = null;
        try {
          const existingRes = await fetch(
            `${GITHUB_API}/repos/${GITHUB_REPO}/contents/${filePath}`,
            {
              headers: {
                Authorization: `token ${token}`,
                Accept: "application/vnd.github.v3+json",
                "User-Agent": "NexAI-Coding-Agent",
              },
            }
          );
          if (existingRes.ok) {
            const existingData = await existingRes.json();
            sha = existingData.sha;
          }
        } catch {}

        // Create or update file
        const body = {
          message: `Coding Agent: ${sha ? "Update" : "Create"} ${filePath}`,
          content,
          ...(sha ? { sha } : {}),
        };

        const res = await fetch(
          `${GITHUB_API}/repos/${GITHUB_REPO}/contents/${filePath}`,
          {
            method: "PUT",
            headers: {
              Authorization: `token ${token}`,
              "Content-Type": "application/json",
              Accept: "application/vnd.github.v3+json",
              "User-Agent": "NexAI-Coding-Agent",
            },
            body: JSON.stringify(body),
          }
        );

        if (res.ok) {
          await pool.query(
            "UPDATE agent_code SET status = 'deployed', deployed_at = NOW() WHERE id = $1",
            [item.id]
          );
          deployed++;
          results.push({ file: filePath, status: "deployed" });
        } else {
          const errText = await res.text();
          results.push({ file: filePath, status: "failed", error: errText.substring(0, 200) });
        }
      } catch (err) {
        results.push({ file: item.file_path, status: "failed", error: err.message });
      }
    }

    return Response.json({
      success: true,
      deployed,
      total: pendingCode.length,
      results,
      message: `Deployed ${deployed}/${pendingCode.length} files. Vercel will auto-deploy.`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// GET /api/agents/deploy — check pending code count
export async function GET(request) {
  const denied = requireSecret(request);
  if (denied) return denied;

  try {
    const pool = getPool();
    const { rows } = await pool.query(
      "SELECT agent_key, file_path, status, created_at FROM agent_code ORDER BY created_at DESC LIMIT 20"
    );
    const { rows: countRes } = await pool.query(
      "SELECT COUNT(*) as pending FROM agent_code WHERE status = 'pending'"
    );
    return Response.json({
      success: true,
      pending: Number(countRes[0]?.pending || 0),
      items: rows,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
