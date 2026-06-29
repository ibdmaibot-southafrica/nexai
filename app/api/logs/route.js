import { getLogs } from "../../../lib/db.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const count = parseInt(url.searchParams.get("count")) || 50;
    const logs = await getLogs(count);
    return Response.json(logs);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
