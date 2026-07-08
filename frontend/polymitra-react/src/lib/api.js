const BASE = import.meta.env.VITE_API_BASE_URL ?? "https://poly-mitra.onrender.com";

// ── Colleges (derived from cutoff records) ─────────────────────────────────────

/**
 * GET /api/cutoffs/college-list
 * Returns distinct { collegeCode, collegeName } pairs from the cutoff collection.
 * Optional: ?year=
 */
export async function fetchCollegeList(year) {
  const qs = year ? `?year=${year}` : "";
  const res = await fetch(`${BASE}/api/cutoffs/college-list${qs}`);
  if (!res.ok) throw new Error("Failed to fetch college list");
  const json = await res.json();
  return json.data; // [{ collegeCode, collegeName }]
}

// ── Cutoffs ────────────────────────────────────────────────────────────────────

/**
 * GET /api/cutoffs
 * Supported params: year, round, collegeCode, collegeName, branchCode, branchName, category, page, limit
 */
export async function fetchCutoffs(params = {}) {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== "" && v !== null))
  ).toString();
  const res = await fetch(`${BASE}/api/cutoffs${qs ? "?" + qs : ""}`);
  if (!res.ok) throw new Error("Failed to fetch cutoffs");
  return res.json(); // { success, currentPage, totalPages, totalRecords, data: [...] }
}

/** GET /api/cutoffs/branches → distinct branch names (optional ?year=) */
export async function fetchBranches(year) {
  const qs = year ? `?year=${year}` : "";
  const res = await fetch(`${BASE}/api/cutoffs/branches${qs}`);
  if (!res.ok) throw new Error("Failed to fetch branches");
  const json = await res.json();
  return json.data; // string[]
}

/** GET /api/cutoffs/categories → distinct category codes (optional ?year=) */
export async function fetchCategories(year) {
  const qs = year ? `?year=${year}` : "";
  const res = await fetch(`${BASE}/api/cutoffs/categories${qs}`);
  if (!res.ok) throw new Error("Failed to fetch categories");
  const json = await res.json();
  return json.data; // string[]
}

/** GET /api/cutoffs/years → [{ year, rounds[] }] */
export async function fetchYears() {
  const res = await fetch(`${BASE}/api/cutoffs/years`);
  if (!res.ok) throw new Error("Failed to fetch years");
  const json = await res.json();
  return json.data; // [{ year: 2025, rounds: [1,2,3,4] }]
}

/** GET /api/cutoffs/college/:collegeCode → all cutoff records for one college */
export async function fetchCutoffsByCollege(collegeCode, params = {}) {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ""))
  ).toString();
  const res = await fetch(`${BASE}/api/cutoffs/college/${encodeURIComponent(collegeCode)}${qs ? "?" + qs : ""}`);
  if (!res.ok) throw new Error("Failed to fetch college cutoffs");
  const json = await res.json();
  return json.data; // cutoff record[]
}

// ── Predict ────────────────────────────────────────────────────────────────────

/**
 * POST /api/predict  (with automatic retry + exponential back-off)
 *
 * Body: { percentage, college, branch, category, round, year?, college_type?, quota? }
 * Returns: { success, data: { predicted_cutoff, student_percentage, probability, chance, resolved_category } }
 *
 * Retries up to `maxRetries` times on transient network/server errors.
 * Does NOT retry on 400/422 validation errors (those are the caller's fault).
 */
export async function postPredict(body, { maxRetries = 2, baseDelayMs = 5000 } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      const res = await fetch(`${BASE}/api/predict`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });
      const json = await res.json();

      // 400 / 422 = user input problem — never retry
      if (res.status === 400 || res.status === 422) {
        throw new Error(json.message || "Invalid request.");
      }

      // 5xx / 503 / 504 — retryable server errors
      if (!res.ok) {
        const err = new Error(json.message || `Server error ${res.status}`);
        err.status = res.status;
        err.retryable = true;
        throw err;
      }

      return json; // success ✓

    } catch (err) {
      lastErr = err;

      // Non-retryable errors (validation, parse errors, explicit user errors)
      if (!err.retryable && err.status !== undefined) throw err;

      // Network errors (Failed to fetch, etc.) and 5xx are retryable
      const isTransient =
        err.retryable ||
        err.message === "Failed to fetch" ||
        err.message?.includes("network") ||
        err.message?.includes("timeout") ||
        err.status >= 500;

      if (!isTransient || attempt > maxRetries) throw err;

      const delay = baseDelayMs * attempt; // 5s, 10s
      console.warn(
        `[postPredict] Attempt ${attempt}/${maxRetries + 1} failed: "${err.message}". ` +
        `Retrying in ${delay / 1000}s…`
      );
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

// ── Warmup ─────────────────────────────────────────────────────────────────────

/**
 * GET /api/predict/warmup
 * Pings the Python ML service so it wakes from Render free-tier sleep.
 * Returns { success, modelReady, message } — use this to track warmup state.
 */
export async function warmupML() {
  try {
    const res  = await fetch(`${BASE}/api/predict/warmup`);
    const json = await res.json();
    return json; // { success, modelReady, message }
  } catch {
    return { success: false, modelReady: false, message: "Could not reach server." };
  }
}

/**
 * GET /api/predict/status
 * Returns in-memory ML service status that Node.js keeps from keep-warm pings.
 * Very fast (no outbound request from Node to Flask).
 */
export async function fetchMLStatus() {
  try {
    const res  = await fetch(`${BASE}/api/predict/status`);
    const json = await res.json();
    return json.ml; // { alive, modelReady, lastPingAt, lastError }
  } catch {
    return { alive: false, modelReady: false, lastPingAt: null, lastError: "Network error" };
  }
}
