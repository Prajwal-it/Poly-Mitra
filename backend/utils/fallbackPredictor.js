/**
 * fallbackPredictor.js
 *
 * A pure-JS, zero-dependency fallback prediction engine that runs entirely
 * inside Node.js. It reads real historical cutoff data from the JSON files
 * that already live on the server and produces a prediction WITHOUT needing
 * the Flask / Python ML service at all.
 *
 * Strategy
 * ────────
 * 1. Look up the exact match (collegeName + branchName + category + round) in the
 *    most recent year's data → use that percentage as the predicted cutoff.
 * 2. If no exact match, try adjacent rounds of the same year.
 * 3. If still no match, try the previous year (2024, then 2023) with same criteria.
 * 4. If nothing found, return null (caller should tell the user "no data available").
 *
 * The probability formula is identical to the Python ML service so the numbers
 * are consistent.
 */

const path = require('path');
const fs   = require('fs');

// ── Lazy-loaded cutoff index ───────────────────────────────────────────────────
// Built once on first use and cached in memory for the lifetime of the process.
let _index = null; // Map<key, number[]>  key = "collegeName||branchName||category||round"

const DATA_FILES = [
  // Ordered newest → oldest so we prefer recent data
  { year: 2025, round: 1, file: 'cutoffs2025_round1.json' },
  { year: 2025, round: 2, file: 'cutoffs2025_round2.json' },
  { year: 2025, round: 3, file: 'cutoffs2025_round3.json' },
  { year: 2025, round: 4, file: 'cutoffs2025_round4.json' },
  { year: 2024, round: 1, file: 'cutoffs2024_round1.json' },
  { year: 2024, round: 2, file: 'cutoffs2024_round2.json' },
  { year: 2024, round: 3, file: 'cutoffs2024_round3.json' },
  { year: 2023, round: 1, file: 'cutoffs2023_round1.json' },
  { year: 2023, round: 2, file: 'cutoffs2023_round2.json' },
  { year: 2023, round: 3, file: 'cutoffs2023_round3.json' },
];

const DATA_DIR = path.join(__dirname, '..'); // backend/ directory

function _buildIndex() {
  const index = new Map();

  for (const { year, round, file } of DATA_FILES) {
    const filePath = path.join(DATA_DIR, file);
    if (!fs.existsSync(filePath)) continue;

    let records;
    try {
      records = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
      console.error(`[fallback] Failed to parse ${file}:`, e.message);
      continue;
    }

    for (const r of records) {
      if (r.percentage == null) continue;
      const key = _makeKey(r.collegeName, r.branchName, r.category, r.round ?? round);
      if (!index.has(key)) index.set(key, []);
      index.get(key).push({ year, percentage: r.percentage });
    }
  }

  console.log(`[fallback] Index built — ${index.size} unique (college, branch, category, round) combos.`);
  return index;
}

function _getIndex() {
  if (!_index) _index = _buildIndex();
  return _index;
}

function _makeKey(college, branch, category, round) {
  return `${String(college).trim().toLowerCase()}||${String(branch).trim().toLowerCase()}||${String(category).trim().toUpperCase()}||${round}`;
}

// ── Simplified → full CAP code (mirrors predictor.py logic) ──────────────────
const SIMPLIFIED_TO_BASE = {
  OPEN: 'OPEN', GEN: 'OPEN', GENERAL: 'OPEN',
  OBC: 'OBC', SC: 'SC', ST: 'ST',
  EWS: 'EWS', SEBC: 'SEBC',
  NTA: 'NTA', NTB: 'NTB', NTC: 'NTC', NTD: 'NTD',
  TFWS: 'TFWS', MI: 'MI', ORPHAN: 'ORPHAN',
  PWD: 'PWDOPEN', PWDOPEN: 'PWDOPEN', PWDOBC: 'PWDOB', PWDSC: 'PWDS',
  DEF: 'DEFOPEN',
};

const STANDALONE_CODES = new Set(['EWS', 'TFWS', 'MI', 'ORPHAN', 'EPHST']);

const PREFIX_MAP = {
  NG: 'NG', NL: 'NL', TG: 'TG', TL: 'TL',
  GOVT: 'NG', GOVERNMENT: 'NG', LM: 'NL', TRUST: 'TG',
};

function normalizeCategory(category, collegeType = 'NG', quota = 'H') {
  const cat = String(category).trim().toUpperCase();

  // Already a full code — use as-is
  if (cat.length >= 5) return cat;

  if (STANDALONE_CODES.has(cat)) return cat;

  const base = SIMPLIFIED_TO_BASE[cat];
  if (!base) return 'NGOPENH';
  if (STANDALONE_CODES.has(base)) return base;

  const prefix = PREFIX_MAP[String(collegeType).toUpperCase()] || 'NG';
  const suffix = ['H', 'O', 'S'].includes(String(quota).toUpperCase()) ? quota.toUpperCase() : 'H';

  return `${prefix}${base}${suffix}`;
}

// ── Sigmoid (same formula as Python) ─────────────────────────────────────────
function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

function classifyChance(prob) {
  if (prob >= 90) return 'Very High';
  if (prob >= 70) return 'High';
  if (prob >= 40) return 'Moderate';
  if (prob >= 20) return 'Low';
  return 'Very Low';
}

// ── Main fallback predict function ────────────────────────────────────────────
/**
 * @param {object} opts
 * @param {number} opts.studentPercentage
 * @param {string} opts.collegeName
 * @param {string} opts.branchName
 * @param {string} opts.category          simplified or full CAP code
 * @param {number} opts.roundNo           1–4
 * @param {string} [opts.collegeType]     default "NG"
 * @param {string} [opts.quota]           default "H"
 *
 * @returns {{ found: true, data: object } | { found: false }}
 */
function fallbackPredict({
  studentPercentage,
  collegeName,
  branchName,
  category,
  roundNo,
  collegeType = 'NG',
  quota       = 'H',
}) {
  const index            = _getIndex();
  const resolvedCategory = normalizeCategory(category, collegeType, quota);

  // ── Search order ────────────────────────────────────────────────────────────
  // Priority 1: exact college + branch + category + requested round
  // Priority 2: same, any nearby round (±1) in most recent year
  // Priority 3: same, any round, any year (take average of most recent year)
  // Priority 4: same college + branch, fallback category NGOPENH (last resort)

  let predictedCutoff = null;
  let dataSource       = null;

  const tryKey = (col, br, cat, rnd) => {
    const key = _makeKey(col, br, cat, rnd);
    const entries = index.get(key);
    if (!entries || entries.length === 0) return null;
    // Pick most recent year, average if multiple entries for same year
    const latestYear = Math.max(...entries.map(e => e.year));
    const latest = entries.filter(e => e.year === latestYear);
    return {
      cutoff: latest.reduce((s, e) => s + e.percentage, 0) / latest.length,
      year:   latestYear,
    };
  };

  // Priority 1: exact round
  let found = tryKey(collegeName, branchName, resolvedCategory, roundNo);
  if (found) {
    predictedCutoff = found.cutoff;
    dataSource = `${found.year} Round ${roundNo} (exact match)`;
  }

  // Priority 2: adjacent rounds of same category
  if (predictedCutoff == null) {
    for (const adj of [roundNo - 1, roundNo + 1, roundNo - 2, roundNo + 2]) {
      if (adj < 1 || adj > 4) continue;
      found = tryKey(collegeName, branchName, resolvedCategory, adj);
      if (found) {
        predictedCutoff = found.cutoff;
        dataSource = `${found.year} Round ${adj} (adjacent round)`;
        break;
      }
    }
  }

  // Priority 3: any round, fallback to NGOPENH if specific category missing
  if (predictedCutoff == null && resolvedCategory !== 'NGOPENH') {
    for (const rnd of [roundNo, 1, 2, 3, 4]) {
      found = tryKey(collegeName, branchName, 'NGOPENH', rnd);
      if (found) {
        predictedCutoff = found.cutoff;
        dataSource = `${found.year} Round ${rnd} (OPEN category fallback)`;
        break;
      }
    }
  }

  if (predictedCutoff == null) {
    return { found: false };
  }

  const cutoff      = Math.round(predictedCutoff * 100) / 100;
  const difference  = studentPercentage - cutoff;
  const probability = Math.round(sigmoid(difference / 2) * 10000) / 100;
  const chance      = classifyChance(probability);

  return {
    found: true,
    data: {
      resolved_category:  resolvedCategory,
      predicted_cutoff:   cutoff,
      student_percentage: studentPercentage,
      probability,
      chance,
      // Extra field to tell frontend this came from fallback (not ML)
      _source:  'historical_fallback',
      _note:    `Based on ${dataSource} historical data (ML service unavailable).`,
    },
  };
}

// ── Pre-warm the index at module load time (async, non-blocking) ──────────────
setImmediate(() => {
  try { _getIndex(); } catch (e) {
    console.error('[fallback] Index pre-warm failed:', e.message);
  }
});

module.exports = { fallbackPredict };
