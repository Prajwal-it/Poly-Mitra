import os
import time
import logging
import joblib
import numpy as np
import pandas as pd

# ── Logging setup ──────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger(__name__)

# ── Model state ────────────────────────────────────────────────────────────────
_BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
_MODEL_PATH = os.path.join(_BASE_DIR, "models", "cutoff_model.pkl")

model        = None
_model_error = None   # stores the last load exception message


def _load_model(retries: int = 3, delay: float = 2.0):
    """
    Attempt to load the CatBoost model up to `retries` times.
    Sets the module-level `model` and `_model_error` accordingly.
    Returns True if successful, False otherwise.
    """
    global model, _model_error
    for attempt in range(1, retries + 1):
        try:
            logger.info(
                f"[model-load] Attempt {attempt}/{retries}: loading {_MODEL_PATH}"
            )
            model        = joblib.load(_MODEL_PATH)
            _model_error = None
            logger.info("[model-load] Model loaded successfully.")
            return True
        except Exception as exc:
            _model_error = str(exc)
            logger.error(f"[model-load] Attempt {attempt} failed: {exc}")
            if attempt < retries:
                time.sleep(delay)

    logger.critical(
        "[model-load] All attempts failed. "
        "Predictions will return 503 until the service is restarted."
    )
    return False


def is_model_loaded() -> bool:
    """Return True if the model is currently in memory and ready."""
    return model is not None


def get_model_error() -> str | None:
    """Return the last load error message, or None if model is healthy."""
    return _model_error


# ── Load model at startup (non-fatal) ─────────────────────────────────────────
_load_model(retries=3, delay=2.0)


# ── All 143 valid Maharashtra CAP category codes (from training data) ──────────
VALID_CAP_CODES = {
    "DEFOBCS", "DEFOPENS", "DEFROBCS", "DEFRSCS", "DEFRSEBCS",
    "DEFSCS", "DEFSEBCS", "EPHST", "EWS", "MGBS", "MGCS", "MGJS",
    "MGMS", "MGPS", "MGSS", "MI", "MLBS", "MLCS", "MLJS", "MLMS",
    "NGNTAH", "NGNTAO", "NGNTAS", "NGNTBH", "NGNTBO", "NGNTBS",
    "NGNTCH", "NGNTCO", "NGNTCS", "NGNTDH", "NGNTDO", "NGNTDS",
    "NGOBCH", "NGOBCO", "NGOBCS", "NGOPENH", "NGOPENO", "NGOPENS",
    "NGSCH",  "NGSCO",  "NGSCS",  "NGSEBCH", "NGSEBCO", "NGSEBCS",
    "NGSTH",  "NGSTO",  "NGSTS",
    "NLNTAH", "NLNTAO", "NLNTAS", "NLNTBH", "NLNTBO", "NLNTBS",
    "NLNTCH", "NLNTCO", "NLNTCS", "NLNTDH", "NLNTDO", "NLNTDS",
    "NLOBCH", "NLOBCO", "NLOBCS", "NLOPENH", "NLOPENO", "NLOPENS",
    "NLSCH",  "NLSCO",  "NLSCS",  "NLSEBCH", "NLSEBCO", "NLSEBCS",
    "NLSTH",  "NLSTO",  "NLSTS",
    "ORPHAN", "PWDOBCH", "PWDOPENH", "PWDOPENS", "PWDRNTCH",
    "PWDROBCH", "PWDROBCS", "PWDRSCH", "PWDRSCS", "PWDRSEBCH",
    "PWDRSEBCS", "PWDRSTH", "PWDSCH", "PWDSEBCH",
    "TFWS",
    "TGNTAH", "TGNTAO", "TGNTAS", "TGNTBH", "TGNTBO", "TGNTBS",
    "TGNTCH", "TGNTCO", "TGNTCS", "TGNTDH", "TGNTDO", "TGNTDS",
    "TGOBCH", "TGOBCO", "TGOBCS", "TGOPENH", "TGOPENO", "TGOPENS",
    "TGSCH",  "TGSCO",  "TGSCS",  "TGSEBCH", "TGSEBCO", "TGSEBCS",
    "TGSTH",  "TGSTO",  "TGSTS",
    "TLNTAH", "TLNTAO", "TLNTAS", "TLNTBH", "TLNTBO", "TLNTBS",
    "TLNTCH", "TLNTCO", "TLNTCS", "TLNTDH", "TLNTDO", "TLNTDS",
    "TLOBCH", "TLOBCO", "TLOBCS", "TLOPENH", "TLOPENO", "TLOPENS",
    "TLSCH",  "TLSCO",  "TLSCS",  "TLSEBCH", "TLSEBCO", "TLSEBCS",
    "TLSTH",  "TLSTO",  "TLSTS",
}

# ── Simplified category aliases → CAP base code ───────────────────────────────
SIMPLIFIED_TO_BASE = {
    "OPEN":    "OPEN",
    "GEN":     "OPEN",
    "GENERAL": "OPEN",
    "OBC":     "OBC",
    "SC":      "SC",
    "ST":      "ST",
    "EWS":     "EWS",
    "SEBC":    "SEBC",
    "NTA":     "NTA",
    "NTB":     "NTB",
    "NTC":     "NTC",
    "NTD":     "NTD",
    "TFWS":    "TFWS",
    "MI":      "MI",
    "ORPHAN":  "ORPHAN",
    "PWD":     "PWDOPEN",
    "PWDOPEN": "PWDOPEN",
    "PWDOBC":  "PWDOB",
    "PWDSC":   "PWDS",
    "DEF":     "DEFOPEN",
}

_STANDALONE_CODES = {"EWS", "TFWS", "MI", "ORPHAN", "EPHST"}

COLLEGE_TYPE_PREFIXES = {
    "NG":         "NG",
    "NL":         "NL",
    "TG":         "TG",
    "TL":         "TL",
    "GOVT":       "NG",
    "GOVERNMENT": "NG",
    "LM":         "NL",
    "TRUST":      "TG",
}

QUOTA_SUFFIXES = {
    "H": "H",
    "O": "O",
    "S": "S",
}


def normalize_category(
        category: str,
        college_type: str = "NG",
        quota: str = "H") -> str:
    """
    Normalize a user-provided category string to a valid Maharashtra CAP code.
    """
    cat_upper = category.strip().upper()

    if cat_upper in VALID_CAP_CODES:
        return cat_upper
    if cat_upper in _STANDALONE_CODES:
        return cat_upper

    base = SIMPLIFIED_TO_BASE.get(cat_upper)
    if base is None:
        logger.warning(
            f"Unknown category '{category}'. Falling back to NGOPENH (OPEN/Home)."
        )
        return "NGOPENH"

    if base in _STANDALONE_CODES:
        return base

    prefix    = COLLEGE_TYPE_PREFIXES.get(college_type.strip().upper(), "NG")
    suffix    = QUOTA_SUFFIXES.get(quota.strip().upper(), "H")
    full_code = f"{prefix}{base}{suffix}"

    if full_code in VALID_CAP_CODES:
        return full_code

    fallback = f"NG{base}H"
    if fallback in VALID_CAP_CODES:
        logger.warning(
            f"Category '{full_code}' not in training data. "
            f"Using fallback '{fallback}'."
        )
        return fallback

    logger.warning(
        f"Cannot resolve category '{category}' → '{full_code}'. "
        f"Using NGOPENH as final fallback."
    )
    return "NGOPENH"


def sigmoid(x):
    return 1 / (1 + np.exp(-x))


def predict_admission(
        student_percentage: float,
        college_name: str,
        branch_name: str,
        category: str,
        round_no: int,
        year: int = 2026,
        college_type: str = "NG",
        quota: str = "H") -> dict:
    """
    Predict admission chance for a student.

    Raises
    ------
    RuntimeError  — if the model is not loaded (surfaced as 503 from app.py).
    """
    # Guard: fail fast and clearly if model is not ready
    if not is_model_loaded():
        raise RuntimeError(
            f"ML model is not loaded. Last error: {get_model_error()}"
        )

    resolved_category = normalize_category(
        category, college_type=college_type, quota=quota
    )

    row = {
        "year":        int(year),
        "round":       int(round_no),
        "collegeName": str(college_name),
        "branchName":  str(branch_name),
        "category":    resolved_category,
    }

    X = pd.DataFrame([row])

    predicted_cutoff = float(model.predict(X)[0])

    difference  = float(student_percentage) - predicted_cutoff
    probability = round(sigmoid(difference / 2) * 100, 2)

    if probability >= 90:
        chance = "Very High"
    elif probability >= 70:
        chance = "High"
    elif probability >= 40:
        chance = "Moderate"
    elif probability >= 20:
        chance = "Low"
    else:
        chance = "Very Low"

    logger.info(
        f"Prediction: college={college_name!r} branch={branch_name!r} "
        f"category={resolved_category!r} (input={category!r}) "
        f"round={round_no} year={year} "
        f"percentage={student_percentage} → cutoff={predicted_cutoff:.2f} "
        f"prob={probability}% chance={chance}"
    )

    return {
        "resolved_category":  resolved_category,
        "predicted_cutoff":   round(predicted_cutoff, 2),
        "student_percentage": float(student_percentage),
        "probability":        probability,
        "chance":             chance,
    }