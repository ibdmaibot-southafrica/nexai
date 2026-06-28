import { getFullStatus } from "../../../lib/db.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const status = await getFullStatus();
  return Response.json(status);
}
