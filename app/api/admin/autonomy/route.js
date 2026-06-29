import { getSetting, setSetting } from "../../../../lib/db.js";
import { requireSecret } from "../../../../lib/auth.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/admin/autonomy — current kill-switch state
export async function GET(request) {
  const denied = requireSecret(request);
  if (denied) return denied;
  const enabled = (await getSetting("autonomy_enabled", "true")) !== "false";
  return Response.json({ autonomy_enabled: enabled });
}

// POST /api/admin/autonomy { enabled: true|false } — flip the kill switch
export async function POST(request) {
  const denied = requireSecret(request);
  if (denied) return denied;
  let body = {};
  try { body = await request.json(); } catch {}
  if (typeof body.enabled !== "boolean") {
    return Response.json({ error: "Body must be { enabled: true|false }" }, { status: 400 });
  }
  await setSetting("autonomy_enabled", body.enabled ? "true" : "false");
  return Response.json({ autonomy_enabled: body.enabled });
}
