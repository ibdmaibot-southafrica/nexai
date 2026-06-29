import { getPool } from "../../../../lib/db.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const GITHUB_REPO = "ibdmaibot-southafrica/nexai";
const GITHUB_API = "https://api.github.com";

// POST /api/agents/deploy — reads agent_code table, pushes to GitHub via API
export async function POST() {
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
        const content = Buffer.from(item.code).toString("base64");

        // Check if file already exists on GitHub
        let sha = null;
        try {
          const existingRes = await fetch(
            `${GITHUB_API}/repos/${GITHUB_REPO}/contents/${filePath}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
                Accept: "application/vnd.github.v3+json",
              },
            }
          );
          if (existingRes.ok) {
            const existingData = await existingRes.json();
            sha = existingData.sha;
          }
        } catch {}

        // Create or update file via GitHub API
        const body = {
          message: `Coding Agent: ${sha ? "Update" : "Create"} ${filePath} [agent: ${item.agent_key}]`,
          content,
          ...(sha ? { sha } : {}),
        };

        const res = await fetch(
          `${GITHUB_API}/repos/${GITHUB_REPO}/contents/${filePath}`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
              Accept: "application/vnd.github.v3+json",
            },
            body: JSON.stringify(body),
          }
        );

        if (res.ok) {
          // Mark as deployed
          await pool.query(
            "UPDATE agent_code SET status = 'deployed', deployed_at = NOW() WHERE id = $1",
            [item.id]
          );
          deployed++;
          results.push({ file: filePath, status: "deployed" });
        } else {
          const err = await res.text();
          results.push({ file: filePath, status: "failed", error: err });
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
export async function GET() {
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
