import os
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

# ── Load model once at startup ─────────────────────────────────────────────────
_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
_MODEL_PATH = os.path.join(_BASE_DIR, "models", "cutoff_model.pkl")

logger.info(f"Loading model from {_MODEL_PATH}")
model = joblib.load(_MODEL_PATH)
logger.info("Model loaded successfully.")

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
# Users can send simplified codes (OPEN, OBC, SC, ST, EWS, SEBC, NTB, etc.)
# These are combined with the college_type prefix and home_state suffix.
SIMPLIFIED_TO_BASE = {
    # Standard categories
    "OPEN":   "OPEN",
    "GEN":    "OPEN",   # alias
    "GENERAL":"OPEN",   # alias
    "OBC":    "OBC",
    "SC":     "SC",
    "ST":     "ST",
    "EWS":    "EWS",    # standalone — no prefix/suffix
    "SEBC":   "SEBC",
    "NTA":    "NTA",
    "NTB":    "NTB",
    "NTC":    "NTC",
    "NTD":    "NTD",
    "TFWS":   "TFWS",   # standalone
    "MI":     "MI",     # standalone
    "ORPHAN": "ORPHAN", # standalone
    # PWD
    "PWD":     "PWDOPEN",
    "PWDOPEN": "PWDOPEN",
    "PWDOBC":  "PWDOB",
    "PWDSC":   "PWDS",
    # DEF
    "DEF":    "DEFOPEN",
}

# ── Standalone codes that are NOT built by combining prefix + base + suffix ────
_STANDALONE_CODES = {"EWS", "TFWS", "MI", "ORPHAN", "EPHST"}

# ── College type prefixes ─────────────────────────────────────────────────────
COLLEGE_TYPE_PREFIXES = {
    "NG": "NG",   # Government
    "NL": "NL",   # Linguistic Minority
    "TG": "TG",   # Trust - Government
    "TL": "TL",   # Trust - Linguistic Minority
    # Aliases
    "GOVT":       "NG",
    "GOVERNMENT": "NG",
    "LM":         "NL",
    "TRUST":      "TG",
}

# ── Quota/home-state suffixes ──────────────────────────────────────────────────
QUOTA_SUFFIXES = {
    "H": "H",  # Home State (default — most common)
    "O": "O",  # Other State / Outside
    "S": "S",  # State Level / NRI
}


def normalize_category(
        category: str,
        college_type: str = "NG",
        quota: str = "H") -> str:
    """
    Normalize a user-provided category string to a valid Maharashtra CAP code.

    Parameters
    ----------
    category     : str  — simplified or full CAP code
                          Simplified: "OPEN", "OBC", "SC", "ST", "EWS", "SEBC",
                                      "NTB", "NTC", "NTD", "TFWS", "PWD" …
                          Full:       "NGOPENH", "NGOBCH", "NGSCH", etc.
    college_type : str  — college quota type prefix (default "NG" = Govt)
                          Accepts: "NG", "NL", "TG", "TL" or aliases
    quota        : str  — home/other state suffix (default "H" = Home State)
                          Accepts: "H", "O", "S"

    Returns
    -------
    str — a valid CAP category code from VALID_CAP_CODES,
          OR the cleaned input if it's already a known code,
          OR a best-effort code with a logged warning.
    """
    cat_upper = category.strip().upper()

    # 1. Already a valid full CAP code → pass through as-is
    if cat_upper in VALID_CAP_CODES:
        return cat_upper

    # 2. Standalone codes that don't need prefix/suffix
    if cat_upper in _STANDALONE_CODES:
        return cat_upper

    # 3. Map simplified alias → base code
    base = SIMPLIFIED_TO_BASE.get(cat_upper)
    if base is None:
        logger.warning(
            f"Unknown category '{category}'. Falling back to NGOPENH (OPEN/Home)."
        )
        return "NGOPENH"

    # 4. Standalone base → no prefix/suffix
    if base in _STANDALONE_CODES:
        return base

    # 5. Resolve prefix and suffix
    prefix = COLLEGE_TYPE_PREFIXES.get(college_type.strip().upper(), "NG")
    suffix = QUOTA_SUFFIXES.get(quota.strip().upper(), "H")

    # 6. Build full code and validate
    full_code = f"{prefix}{base}{suffix}"
    if full_code in VALID_CAP_CODES:
        return full_code

    # 7. If exact combination not in training data, fall back to NG + base + H
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

    Parameters
    ----------
    student_percentage : float  — student's percentage score (0–100)
    college_name       : str    — college name as stored in DB
    branch_name        : str    — branch name as stored in DB
    category           : str    — simplified ("OPEN","OBC","SC","ST","EWS","SEBC",
                                  "NTB","NTC","NTD","TFWS","PWD") OR full CAP code
    round_no           : int    — CAP round number (1–4)
    year               : int    — prediction year (default 2026)
    college_type       : str    — college quota prefix (default "NG" = Govt)
    quota              : str    — home/other state suffix (default "H" = Home State)

    Returns
    -------
    dict with keys:
        resolved_category   : str   — the actual CAP code used for prediction
        predicted_cutoff    : float — model-predicted cutoff percentage
        student_percentage  : float — input student percentage
        probability         : float — admission probability (0–100)
        chance              : str   — "Very High" / "High" / "Moderate" / "Low" / "Very Low"
    """
    # Normalize category to a valid CAP code
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

    difference = float(student_percentage) - predicted_cutoff
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