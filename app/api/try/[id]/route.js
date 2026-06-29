import { runProduct } from "../../../../lib/execute.js";
import { consumeDailyLimit } from "../../../../lib/limits.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/try/:id { input } — ONE free sample run, no key needed (trust-builder).
// Globally daily-capped so it can't be abused to drain the free LLM quota.
const FREE_TRIES_PER_DAY = parseInt(process.env.FREE_TRIES_PER_DAY) || 40;

export async function POST(request, { params }) {
  const ok = await consumeDailyLimit("free_try", FREE_TRIES_PER_DAY);
  if (!ok) {
    return Response.json(
      { error: "Free samples for today are used up.", getKey: "POST /api/keys/create { amount } to run it for real." },
      { status: 429 }
    );
  }
  let input = "";
  try { const b = await request.json(); input = typeof b?.input === "string" ? b.input : ""; } catch {}

  const r = await runProduct({ productId: params.id, input, free: true });
  const { status, ...payload } = r;
  return Response.json({ ...payload, sample: true }, { status });
}
