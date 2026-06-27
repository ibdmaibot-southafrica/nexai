import { getFullStatus } from "../../../lib/database.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const status = getFullStatus();
  return Response.json(status);
}
