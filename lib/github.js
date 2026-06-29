/**
 * GitHub helpers for the self-build pipeline.
 *
 * Used by the build-gate state machine (lib/deploy.js): push generated files to a
 * throwaway branch, read the Vercel build result via GitHub commit status/checks
 * (so no VERCEL_TOKEN is needed), then merge to master only if the build is green.
 *
 * All calls use the existing GITHUB_TOKEN (needs `repo` scope).
 */

const GITHUB_REPO = process.env.GITHUB_REPO || "ibdmaibot-southafrica/nexai";
const GITHUB_API = "https://api.github.com";
const BASE_BRANCH = process.env.GITHUB_BASE_BRANCH || "master";

function ghHeaders(extra = {}) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN not set");
  return {
    Authorization: `token ${token}`,
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "NexAI-Coding-Agent",
    ...extra,
  };
}

async function gh(path, options = {}) {
  const res = await fetch(`${GITHUB_API}${path}`, { ...options, headers: ghHeaders(options.headers) });
  return res;
}

// Resolve the current head SHA of the base branch.
export async function getBaseSha() {
  const res = await gh(`/repos/${GITHUB_REPO}/git/ref/heads/${BASE_BRANCH}`);
  if (!res.ok) throw new Error(`getBaseSha failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.object.sha;
}

// Create a branch at baseSha. Returns true on success (or if it already exists).
export async function createBranch(branch, baseSha) {
  const res = await gh(`/repos/${GITHUB_REPO}/git/refs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: baseSha }),
  });
  if (res.ok) return true;
  if (res.status === 422) return true; // ref already exists
  throw new Error(`createBranch failed: ${res.status} ${await res.text()}`);
}

// PUT a single file onto a branch. Returns the resulting commit SHA.
async function putFile(branch, filePath, code) {
  // Look up existing file SHA on the branch (required to update an existing file)
  let sha = null;
  const existing = await gh(`/repos/${GITHUB_REPO}/contents/${filePath}?ref=${branch}`);
  if (existing.ok) sha = (await existing.json()).sha;

  const res = await gh(`/repos/${GITHUB_REPO}/contents/${filePath}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: `Coding Agent: ${sha ? "update" : "create"} ${filePath}`,
      content: Buffer.from(code).toString("base64"),
      branch,
      ...(sha ? { sha } : {}),
    }),
  });
  if (!res.ok) throw new Error(`putFile ${filePath} failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.commit.sha;
}

// Create `branch` off base and push all files. Returns the head commit SHA.
// files: [{ file_path, code }]
export async function pushFilesToBranch(branch, files) {
  const baseSha = await getBaseSha();
  await createBranch(branch, baseSha);
  let headSha = baseSha;
  for (const f of files) {
    headSha = await putFile(branch, f.file_path, f.code);
  }
  return headSha;
}

/**
 * Read the build result for a commit by combining GitHub's commit status API and
 * the Check Runs API (Vercel may report via either). Returns one of:
 *   'success' | 'failure' | 'pending' | 'none'
 * 'none' means no status/check has appeared yet (Vercel hasn't started).
 */
export async function getCommitBuildState(sha) {
  let sawPending = false;
  let sawSuccess = false;
  let sawAny = false;

  // Combined commit statuses
  const stRes = await gh(`/repos/${GITHUB_REPO}/commits/${sha}/status`);
  if (stRes.ok) {
    const st = await stRes.json();
    for (const s of st.statuses || []) {
      sawAny = true;
      if (s.state === "failure" || s.state === "error") return "failure";
      if (s.state === "pending") sawPending = true;
      if (s.state === "success") sawSuccess = true;
    }
  }

  // Check runs (GitHub Apps like Vercel often use these)
  const crRes = await gh(`/repos/${GITHUB_REPO}/commits/${sha}/check-runs`);
  if (crRes.ok) {
    const cr = await crRes.json();
    for (const c of cr.check_runs || []) {
      sawAny = true;
      if (c.status !== "completed") { sawPending = true; continue; }
      if (c.conclusion === "failure" || c.conclusion === "timed_out" || c.conclusion === "cancelled") return "failure";
      if (c.conclusion === "success") sawSuccess = true;
    }
  }

  if (!sawAny) return "none";
  if (sawPending) return "pending";
  if (sawSuccess) return "success";
  return "pending";
}

// Merge `branch` into the base branch. Returns true on success.
export async function mergeBranch(branch) {
  const res = await gh(`/repos/${GITHUB_REPO}/merges`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ base: BASE_BRANCH, head: branch, commit_message: `Auto-merge ${branch} (build passed)` }),
  });
  if (res.ok || res.status === 204) return true;
  throw new Error(`mergeBranch failed: ${res.status} ${await res.text()}`);
}

export async function deleteBranch(branch) {
  const res = await gh(`/repos/${GITHUB_REPO}/git/refs/heads/${branch}`, { method: "DELETE" });
  // 204 = deleted, 422/404 = already gone
  return res.ok || res.status === 422 || res.status === 404;
}
