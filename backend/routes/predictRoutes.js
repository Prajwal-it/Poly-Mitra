'use strict';

const express = require('express');
const router  = express.Router();
const { smartPredict } = require('../utils/smartPredictor');

// ── Valid inputs ───────────────────────────────────────────────────────────────
const VALID_COLLEGE_TYPES = ['NG', 'NL', 'TG', 'TL', 'GOVT', 'GOVERNMENT', 'LM', 'TRUST'];
const VALID_QUOTAS        = ['H', 'O', 'S'];

/**
 * POST /api/predict
 *
 * Predicts the admission cutoff and probability for a given student/college/branch
 * using weighted linear trend extrapolation on 3 years of real historical data.
 * No external service required — runs entirely inside Node.js.
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
 *                             Full CAP:   "NGOPENH" | "NGOBCH" | "NGSCH" | …
 *   round        : number   — CAP round number: 1 | 2 | 3 | 4      [required]
 *   year         : number   — target year for prediction            [optional, default 2026]
 *   college_type : string   — college quota prefix                  [optional, default "NG"]
 *   quota        : string   — home/other state suffix               [optional, default "H"]
 * }
 *
 * ── Response ──────────────────────────────────────────────────────────────────
 * {
 *   success : true,
 *   data: {
 *     resolved_category  : string  — actual CAP code used
 *     predicted_cutoff   : number  — projected cutoff percentage
 *     student_percentage : number  — input student percentage
 *     probability        : number  — admission probability (0–100)
 *     chance             : "Very High" | "High" | "Moderate" | "Low" | "Very Low"
 *     confidence         : "HIGH" | "MEDIUM" | "LOW" | "ESTIMATED"
 *     trend_slope        : number  — cutoff trend per year (+ve rising, -ve falling)
 *     data_years         : number  — years of data used
 *   }
 * }
 */
router.post('/', (req, res) => {
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

  // ── Required field presence ───────────────────────────────────────────────
  const missing = Object.entries({ percentage, college, branch, category, round })
    .filter(([, v]) => v === undefined || v === null || v === '')
    .map(([k]) => k);

  if (missing.length > 0) {
    return res.status(400).json({
      success: false,
      message: `Missing required fields: ${missing.join(', ')}.`,
      missing_fields: missing,
    });
  }

  // ── Type & range validation ───────────────────────────────────────────────
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

  const yr = Number(year);
  if (isNaN(yr) || yr < 2023 || yr > 2030) {
    return res.status(422).json({
      success: false,
      message: "'year' must be between 2023 and 2030.",
    });
  }

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
      message: `'quota' must be one of: ${VALID_QUOTAS.join(', ')}.`,
    });
  }

  // ── Run prediction ────────────────────────────────────────────────────────
  try {
    const result = smartPredict({
      studentPercentage: pct,
      collegeName:       String(college).trim(),
      branchName:        String(branch).trim(),
      category:          String(category).trim().toUpperCase(),
      roundNo:           rnd,
      year:              yr,
      collegeType:       ctUpper,
      quota:             qUpper,
    });

    if (!result.found) {
      return res.status(404).json({
        success: false,
        message: result.reason ||
          'No historical data found for this college/branch/category combination. ' +
          'Try checking the college name spelling or choosing a different category.',
      });
    }

    return res.status(200).json({
      success: true,
      data:    result.data,
    });

  } catch (err) {
    console.error('[predictRoutes] Unexpected error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'An unexpected error occurred while processing your prediction.',
    });
  }
});

// ── Status route (kept for frontend compatibility) ────────────────────────────
// Returns a static "always ready" response since we no longer depend on
// an external ML service.
router.get('/status', (_req, res) => {
  res.status(200).json({
    success: true,
    ml: {
      alive:      true,
      modelReady: true,
      method:     'statistical_trend',
      lastPingAt: new Date().toISOString(),
      lastError:  null,
    },
  });
});

// ── Warmup route (kept for frontend compatibility) ────────────────────────────
// Previously triggered the Flask ML cold-start. Now it just confirms the
// in-process predictor is ready (index is pre-built at startup).
router.get('/warmup', (_req, res) => {
  res.status(200).json({
    success:    true,
    modelReady: true,
    message:    'Statistical predictor is warm and ready (no external service needed).',
  });
});

module.exports = router;
