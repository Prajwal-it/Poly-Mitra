const express = require('express');
const axios   = require('axios');

const router = express.Router();
const { fallbackPredict } = require('../utils/fallbackPredictor');

const ML_URL = process.env.PYTHON_ML_URL || 'http://localhost:3000';

// ── ML service health state (in-memory) ──────────────────────────────────────
// Updated by keep-warm pings so /status can answer instantly.
let _mlStatus = {
  alive:      false,
  modelReady: false,
  lastPingAt: null,
  lastError:  null,
};

// ── Axios helper with automatic retry ─────────────────────────────────────────
/**
 * Executes an axios request and retries on transient network failures.
 *
 * @param {Function} fn          — () => axios(...) call factory
 * @param {number}   maxRetries  — total extra attempts after first try
 * @param {number}   delayMs     — ms to wait between retries
 */
async function withRetry(fn, maxRetries = 2, delayMs = 4000) {
  let lastErr;
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const isTransient = (
        err.code === 'ETIMEDOUT'    ||
        err.code === 'ECONNABORTED' ||
        err.code === 'ECONNREFUSED' ||
        err.code === 'ENOTFOUND'    ||
        (err.response && err.response.status >= 500)
      );
      if (!isTransient || attempt > maxRetries) throw err;
      console.warn(
        `[predict-retry] Attempt ${attempt}/${maxRetries + 1} failed `  +
        `(${err.code || err.message}). Retrying in ${delayMs}ms…`
      );
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}

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

    // ── Proxy to Flask ML service (with retry) ──────────────────────────────
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

    const mlResponse = await withRetry(
      () => axios.post(`${ML_URL}/predict`, payload, {
        headers: { 'Content-Type': 'application/json' },
        // 90 s — Render free-tier cold start can take 80–90 s
        timeout: 90000,
      }),
      2,    // up to 2 retries (3 total attempts)
      4000  // 4 s between retries
    );

    return res.status(200).json(mlResponse.data);

  } catch (err) {
    // Flask returned a structured error (400, 422) — do NOT fall back, these are input problems
    if (err.response && (err.response.status === 400 || err.response.status === 422)) {
      return res.status(err.response.status).json(err.response.data);
    }

    // ── Flask is down / timed out / errored — try the JS historical fallback ──
    // This ensures students ALWAYS get a prediction even if the ML service is sleeping.
    console.warn('[predictRoutes] ML service unreachable after retries — using historical fallback:', err.message);

    try {
      const fb = fallbackPredict({
        studentPercentage: payload.percentage,
        collegeName:       payload.college,
        branchName:        payload.branch,
        category:          payload.category,
        roundNo:           payload.round,
        collegeType:       payload.college_type,
        quota:             payload.quota,
      });

      if (fb.found) {
        console.log('[predictRoutes] Fallback prediction succeeded.');
        return res.status(200).json({
          success: true,
          data:    fb.data,
          // Surface the fallback notice so the frontend can optionally show it
          _fallback: true,
        });
      }
    } catch (fbErr) {
      console.error('[predictRoutes] Fallback predictor threw:', fbErr.message);
    }

    // Fallback also found nothing — now surface the real error
    if (err.response) {
      return res.status(err.response.status).json(err.response.data);
    }
    if (err.code === 'ECONNREFUSED') {
      return res.status(503).json({
        success: false,
        message: 'Prediction service is not reachable and no historical data matched your inputs. Please try again in 60 seconds.',
      });
    }
    if (err.code === 'ETIMEDOUT' || err.code === 'ECONNABORTED') {
      return res.status(504).json({
        success: false,
        message: 'Prediction service timed out and no historical data matched your inputs. Please try again in a minute.',
      });
    }

    console.error('[predictRoutes] Unexpected error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'An unexpected error occurred while processing your prediction.',
    });
  }
});

// ── Warmup route ─────────────────────────────────────────────────────────────
// Called silently by the frontend when the Predictor page loads.
// Pings the Python ML /health so it wakes from Render free-tier sleep.

router.get('/warmup', async (req, res) => {
  try {
    const r = await axios.get(`${ML_URL}/health`, { timeout: 90000 });
    const modelReady = r.data?.model_loaded !== false; // treat missing field as true
    _mlStatus = {
      alive:      true,
      modelReady,
      lastPingAt: new Date().toISOString(),
      lastError:  null,
    };
    return res.status(200).json({
      success:    true,
      modelReady,
      message:    modelReady ? 'ML service is warm and ready.' : 'ML service is up but model is still loading.',
    });
  } catch (err) {
    _mlStatus = {
      alive:      false,
      modelReady: false,
      lastPingAt: new Date().toISOString(),
      lastError:  err.message,
    };
    // Return 200 even on failure — the frontend will poll again
    return res.status(200).json({
      success:    false,
      modelReady: false,
      message:    'ML service is still waking up. Please wait…',
    });
  }
});

// ── Status route ──────────────────────────────────────────────────────────────
// Frontend can poll this to show a real-time warmup banner.

router.get('/status', (req, res) => {
  res.status(200).json({
    success: true,
    ml:      _mlStatus,
  });
});

// ── Keep-warm: immediate startup ping + recurring every 13 minutes ─────────────
// Render free tier sleeps after 15 minutes of inactivity.
// We ping every 13 min to stay well within the limit.
// The immediate ping fires as soon as this module is first imported (Node start).

async function pingML() {
  try {
    const r = await axios.get(`${ML_URL}/health`, { timeout: 15000 });
    const modelReady = r.data?.model_loaded !== false;
    _mlStatus = {
      alive:      true,
      modelReady,
      lastPingAt: new Date().toISOString(),
      lastError:  null,
    };
    console.log(`[keep-warm] ML service is alive (model_ready=${modelReady}).`);
  } catch (err) {
    _mlStatus = {
      alive:      false,
      modelReady: false,
      lastPingAt: new Date().toISOString(),
      lastError:  err.message,
    };
    console.warn('[keep-warm] ML service ping failed (may be sleeping):', err.message);
  }
}

// Fire immediately on startup — don't wait 13 minutes for the first ping
pingML();

// Then ping every 13 minutes
setInterval(pingML, 13 * 60 * 1000);

module.exports = router;
