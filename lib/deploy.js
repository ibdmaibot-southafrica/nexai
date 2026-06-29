/**
 * Build-gate state machine for the autonomous self-build loop.
 *
 * advanceDeploy() is called once per heartbeat and moves the deploy forward by one
 * step (never blocks for a build):
 *
 *   idle + pending code -> push files to a throwaway branch, record 'building'
 *   building            -> read the Vercel build result (via GitHub status/checks)
 *                            success -> merge to master, mark code 'deployed'
 *                            failure -> delete branch, mark code 'failed' (master safe)
 *                            pending -> wait for next heartbeat (until MAX_AGE)
 *
 * At most one deploy is in flight at a time. Generated code can never reach master
 * unless its preview build passed.
 */

import {
  getAgentCodeByStatus,
  setAgentCodeStatus,
  createDeployment,
  getActiveDeployment,
  updateDeployment,
  logAction,
} from "./db.js";
import {
  pushFilesToBranch,
  getCommitBuildState,
  mergeBranch,
  deleteBranch,
} from "./github.js";

const MAX_AGE_MS = 15 * 60 * 1000; // give a preview build up to 15 min, then abort

// Only ship files that are a safe agents/<key>.js path (path-traversal guard).
export function isSafeAgentPath(filePath) {
  return typeof filePath === "string" && /^agents\/[a-z][a-z0-9_]{1,30}\.js$/.test(filePath);
}

export async function advanceDeploy() {
  const active = await getActiveDeployment();
  if (active) return pollDeployment(active);
  return startDeployment();
}

async function startDeployment() {
  const pending = await getAgentCodeByStatus("pending");
  if (pending.length === 0) return { state: "idle" };

  const safe = pending.filter((c) => isSafeAgentPath(c.file_path));
  const unsafe = pending.filter((c) => !isSafeAgentPath(c.file_path));
  if (unsafe.length) {
    await setAgentCodeStatus(unsafe.map((c) => c.id), "rejected");
    await logAction("Deploy", "rejected_unsafe_paths", { files: unsafe.map((c) => c.file_path) });
  }
  if (safe.length === 0) return { state: "idle" };

  const branch = `auto/deploy-${Date.now()}`;
  const ids = safe.map((c) => c.id);
  try {
    const headSha = await pushFilesToBranch(
      branch,
      safe.map((c) => ({ file_path: c.file_path, code: c.code }))
    );
    await setAgentCodeStatus(ids, "building");
    await createDeployment({ branch, head_sha: headSha, agent_code_ids: ids });
    await logAction("Deploy", "build_started", { branch, files: safe.map((c) => c.file_path) });
    return { state: "building", branch };
  } catch (err) {
    // Push failed -> leave code 'pending' to retry next heartbeat; clean up branch.
    await deleteBranch(branch).catch(() => {});
    await logAction("Deploy", "build_start_error", { branch, error: err.message });
    return { state: "error", error: err.message };
  }
}

async function pollDeployment(active) {
  const ageMs = Date.now() - new Date(active.created_at).getTime();
  let buildState;
  try {
    buildState = await getCommitBuildState(active.head_sha);
  } catch (err) {
    await logAction("Deploy", "poll_error", { id: active.id, error: err.message });
    return { state: "building", waiting: "poll_error" };
  }

  if (buildState === "success") {
    try {
      await mergeBranch(active.branch);
      await deleteBranch(active.branch).catch(() => {});
      await setAgentCodeStatus(active.agent_code_ids, "deployed");
      await updateDeployment(active.id, { status: "merged", detail: "build passed, merged to master" });
      await logAction("Deploy", "merged", { branch: active.branch });
      return { state: "merged", branch: active.branch };
    } catch (err) {
      await deleteBranch(active.branch).catch(() => {});
      await setAgentCodeStatus(active.agent_code_ids, "failed");
      await updateDeployment(active.id, { status: "failed", detail: `merge error: ${err.message}` });
      await logAction("Deploy", "merge_error", { branch: active.branch, error: err.message });
      return { state: "failed", error: err.message };
    }
  }

  if (buildState === "failure") {
    await deleteBranch(active.branch).catch(() => {});
    await setAgentCodeStatus(active.agent_code_ids, "failed");
    await updateDeployment(active.id, { status: "failed", detail: "preview build failed; master untouched" });
    await logAction("Deploy", "build_failed", { branch: active.branch });
    return { state: "failed", branch: active.branch };
  }

  // 'none' (build not started) or 'pending'
  if (ageMs > MAX_AGE_MS) {
    await deleteBranch(active.branch).catch(() => {});
    await setAgentCodeStatus(active.agent_code_ids, "failed");
    await updateDeployment(active.id, { status: "failed", detail: "timed out waiting for build" });
    await logAction("Deploy", "build_timeout", { branch: active.branch, ageMs });
    return { state: "timeout", branch: active.branch };
  }

  return { state: "building", branch: active.branch, waiting: buildState };
}
