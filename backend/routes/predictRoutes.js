const express = require('express');
const axios   = require('axios');

const router = express.Router();

const ML_URL = process.env.PYTHON_ML_URL || 'http://localhost:3000';

/**
 * POST /api/predict
 *
 * Predicts the admission cutoff and probability for a given student/college/branch.
 * Proxies the request to the Flask ML service (CatBoost model).
 *
 * ── Request Body ──────────────────────────────────────────────────────────────
 * {
 *   percentage   : number   — student's percentage score (0–100)   [required]
 *   college      : string   — college name (must match DB records)  [required]
 *   branch       : string   — branch name (must match DB records)   [required]
 *   category     : string   — simplified OR full CAP code           [required]
 *                             Simplified: "OPEN" | "OBC" | "SC" | "ST" |
 *                                         "EWS" | "SEBC" | "NTB" | "NTC" |
 *                                         "NTD" | "TFWS" | "PWD"
 *                             Full CAP:   "NGOPENH" | "NGOBCH" | "NGSCH" |
 *                                         "NGSTH" | "TGOPENH" | … (143 codes)
 *   round        : number   — CAP round number: 1 | 2 | 3 | 4      [required]
 *   year         : number   — target year for prediction            [optional, default 2026]
 *   college_type : string   — college quota prefix                  [optional, default "NG"]
 *                             "NG" = Govt | "NL" = Ling. Minority |
 *                             "TG" = Trust-Govt | "TL" = Trust-Ling.
 *   quota        : string   — home/other state suffix               [optional, default "H"]
 *                             "H" = Home State | "O" = Other State | "S" = State Level
 * }
 *
 * ── Response ──────────────────────────────────────────────────────────────────
 * {
 *   success            : true,
 *   data: {
 *     resolved_category   : string  — actual CAP code used for prediction
 *     predicted_cutoff    : number  — model-predicted cutoff percentage
 *     student_percentage  : number  — input student percentage
 *     probability         : number  — admission probability (0–100)
 *     chance              : "Very High" | "High" | "Moderate" | "Low" | "Very Low"
 *   }
 * }
 */

const VALID_SIMPLIFIED_CATEGORIES = [
  'OPEN', 'GEN', 'GENERAL', 'OBC', 'SC', 'ST',
  'EWS', 'SEBC', 'NTA', 'NTB', 'NTC', 'NTD',
  'TFWS', 'MI', 'ORPHAN', 'PWD', 'DEF',
];

const VALID_COLLEGE_TYPES = ['NG', 'NL', 'TG', 'TL', 'GOVT', 'GOVERNMENT', 'LM', 'TRUST'];
const VALID_QUOTAS        = ['H', 'O', 'S'];

router.post('/', async (req, res) => {
  try {
    const {
      percentage,
      college,
      branch,
      category,
      round,
      year         = 2026,
      college_type = 'NG',
      quota        = 'H',
    } = req.body;

    // ── Required field presence ─────────────────────────────────────────────
    const requiredFields = { percentage, college, branch, category, round };
    const missing = Object.entries(requiredFields)
      .filter(([, val]) => val === undefined || val === null || val === '')
      .map(([key]) => key);

    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missing.join(', ')}.`,
        missing_fields: missing,
      });
    }

    // ── Type validation ─────────────────────────────────────────────────────
    const pct = Number(percentage);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      return res.status(422).json({
        success: false,
        message: "'percentage' must be a number between 0 and 100.",
      });
    }

    const rnd = Number(round);
    if (![1, 2, 3, 4].includes(rnd)) {
      return res.status(422).json({
        success: false,
        message: "'round' must be one of: 1, 2, 3, 4.",
      });
    }

    const yr = year ? Number(year) : 2026;
    if (isNaN(yr) || yr < 2023 || yr > 2030) {
      return res.status(422).json({
        success: false,
        message: "'year' must be a valid year between 2023 and 2030.",
      });
    }

    // ── Optional field validation ────────────────────────────────────────────
    const ctUpper = String(college_type).toUpperCase();
    if (!VALID_COLLEGE_TYPES.includes(ctUpper)) {
      return res.status(422).json({
        success: false,
        message: `'college_type' must be one of: ${VALID_COLLEGE_TYPES.join(', ')}.`,
      });
    }

    const qUpper = String(quota).toUpperCase();
    if (!VALID_QUOTAS.includes(qUpper)) {
      return res.status(422).json({
        success: false,
        message: `'quota' must be one of: ${VALID_QUOTAS.join(', ')}. H=Home State, O=Other State, S=State Level.`,
      });
    }

    // ── Proxy to Flask ML service ───────────────────────────────────────────
    const payload = {
      percentage:   pct,
      college:      String(college).trim(),
      branch:       String(branch).trim(),
      category:     String(category).trim().toUpperCase(),
      round:        rnd,
      year:         yr,
      college_type: ctUpper,
      quota:        qUpper,
    };

    const mlResponse = await axios.post(`${ML_URL}/predict`, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 60000, // 60 s (helps with Render free-tier cold starts)
    });

    return res.status(200).json(mlResponse.data);

  } catch (err) {
    // Flask returned a structured error (400, 422, 500)
    if (err.response) {
      return res.status(err.response.status).json(err.response.data);
    }

    // Flask is unreachable
    if (err.code === 'ECONNREFUSED') {
      return res.status(503).json({
        success: false,
        message: 'ML prediction service is not running. Please start the Python ML service on port 3000.',
      });
    }

    if (err.code === 'ETIMEDOUT' || err.code === 'ECONNABORTED') {
      return res.status(504).json({
        success: false,
        message: 'ML prediction service timed out. The model may still be loading.',
      });
    }

    console.error('[predictRoutes] Unexpected error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'An unexpected error occurred while processing your prediction.',
    });
  }
});

module.exports = router;
