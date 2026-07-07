const BASE = import.meta.env.VITE_API_BASE_URL ?? "https://poly-mitra.onrender.com";


// ── Colleges (derived from cutoff records) ─────────────────────────────────────

/**
 * GET /api/cutoffs/college-list
 * Returns distinct { collegeCode, collegeName } pairs from the cutoff collection.
 * This replaces the deleted College model.
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
 * POST /api/predict
 * Body: { percentage, college, branch, category, round, year?, college_type?, quota? }
 * Returns: { success, data: { predicted_cutoff, student_percentage, probability, chance, resolved_category } }
 */
export async function postPredict(body) {
  const res = await fetch(`${BASE}/api/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || "Prediction failed");
  return json;
}
