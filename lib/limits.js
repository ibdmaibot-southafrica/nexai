import { getSetting, setSetting } from "./db.js";

/**
 * Date-stamped daily limits, stored in settings. Used to bound autonomous actions
 * so the system can't run away with itself.
 *
 * WEBSITE_CHANGES_PER_DAY caps how many times the agents may change the WEBSITE
 * itself (app/site code) in a day — separate from generating agent code. Any code
 * path that edits the site must call consumeDailyLimit("website_changes", MAX)
 * and bail if it returns false. (Today the coding agent only writes agents/<key>.js,
 * so website changes are 0/day; this is the guardrail for when that expands.)
 */
export const WEBSITE_CHANGES_PER_DAY = parseInt(process.env.MAX_WEBSITE_CHANGES_PER_DAY) || 2;

function today() {
  return new Date().toISOString().slice(0, 10);
}

// Try to consume one unit of a daily budget. Returns true if allowed, false if
// the cap for today is already reached.
export async function consumeDailyLimit(name, max) {
  const key = `limit:${name}:${today()}`;
  const used = parseInt(await getSetting(key, "0")) || 0;
  if (used >= max) return false;
  await setSetting(key, String(used + 1));
  return true;
}

export async function dailyUsage(name) {
  return parseInt(await getSetting(`limit:${name}:${today()}`, "0")) || 0;
}
