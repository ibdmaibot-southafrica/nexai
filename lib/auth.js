/**
 * Shared authorization gate for sensitive endpoints.
 *
 * Protects internal/admin/cron routes that must NOT be triggerable by the
 * public. Callers pass the incoming Request; if the call is not authorized this
 * returns a Response (401/503) to return directly, otherwise null.
 *
 * Authorization model: a single shared secret in the CRON_SECRET env var,
 * supplied as `Authorization: Bearer <secret>`. Vercel Cron automatically sends
 * this header when CRON_SECRET is configured on the project, so scheduled runs
 * work with no extra wiring. Manual triggers (curl / setup-cron.ps1) must send
 * the same header.
 *
 * Fail-closed: if CRON_SECRET is not set, every protected route is denied. Set
 * CRON_SECRET in the Vercel project env (and locally in .env.local) to enable
 * cron + manual admin access.
 */

import { timingSafeEqual } from "crypto";

function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * @param {Request} request
 * @returns {Response|null} a Response if unauthorized, otherwise null
 */
export function requireSecret(request) {
  const configured = process.env.CRON_SECRET;
  if (!configured) {
    return Response.json(
      { error: "Endpoint disabled: CRON_SECRET is not configured on the server." },
      { status: 503 }
    );
  }

  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : header;

  if (!token || !safeEqual(token, configured)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
