import { getLogs } from "../../../lib/db.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const url = new URL(request.url);
  const count = parseInt(url.searchParams.get("count")) || 50;
  const logs = getLogs(count);
  return Response.json(logs);
}
