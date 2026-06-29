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
 * Opt-in: if CRON_SECRET is NOT set, the gate is dormant and lets the request
 * through, so the autonomous loop is never blocked by default. Set CRON_SECRET
 * (in Vercel env + local .env.local) to switch protection on; then every caller
 * must send `Authorization: Bearer <CRON_SECRET>`.
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
  // Gate is opt-in: with no secret configured, allow through (don't block autonomy).
  if (!configured) return null;

  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : header;

  if (!token || !safeEqual(token, configured)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
