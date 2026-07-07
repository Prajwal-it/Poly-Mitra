import os
import logging
from flask import Flask, request, jsonify
from flask_cors import CORS

from predictor import predict_admission

# ── Logging ────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger(__name__)

# ── Config from environment ────────────────────────────────────────────────────
PORT       = int(os.environ.get("FLASK_PORT", 3000))
DEBUG      = os.environ.get("FLASK_DEBUG", "0") == "1"
FLASK_ENV  = os.environ.get("FLASK_ENV", "production")

# ── App ────────────────────────────────────────────────────────────────────────
app = Flask(__name__)
CORS(app)


# ── Routes ─────────────────────────────────────────────────────────────────────

@app.route("/")
def home():
    return jsonify({
        "success": True,
        "message": "Polytechnic Cutoff Predictor ML API is running!",
        "env": FLASK_ENV,
    })


@app.route("/predict", methods=["POST"])
def predict():
    data = request.get_json(silent=True)

    if not data:
        return jsonify({
            "success": False,
            "message": "Request body must be JSON."
        }), 400

    # ── Required fields ────────────────────────────────────────────────────────
    required_fields = ["percentage", "college", "branch", "category", "round"]
    missing = [f for f in required_fields if data.get(f) is None]
    if missing:
        return jsonify({
            "success": False,
            "message": f"Missing required fields: {', '.join(missing)}",
            "missing_fields": missing,
        }), 400

    # ── Type validation ────────────────────────────────────────────────────────
    try:
        percentage = float(data["percentage"])
        round_no   = int(data["round"])
        year       = int(data.get("year", 2026))
    except (ValueError, TypeError) as e:
        return jsonify({
            "success": False,
            "message": f"Invalid numeric value: {str(e)}. "
                       "'percentage' must be a number, 'round' and 'year' must be integers."
        }), 422

    if not (0 <= percentage <= 100):
        return jsonify({
            "success": False,
            "message": "percentage must be a number between 0 and 100."
        }), 422

    if round_no not in (1, 2, 3, 4):
        return jsonify({
            "success": False,
            "message": "round must be one of: 1, 2, 3, 4."
        }), 422

    # ── Optional fields ────────────────────────────────────────────────────────
    college_type = str(data.get("college_type", "NG")).strip().upper()
    quota        = str(data.get("quota",        "H")).strip().upper()

    # ── Run prediction ─────────────────────────────────────────────────────────
    try:
        result = predict_admission(
            student_percentage = percentage,
            college_name       = str(data["college"]).strip(),
            branch_name        = str(data["branch"]).strip(),
            category           = str(data["category"]).strip(),
            round_no           = round_no,
            year               = year,
            college_type       = college_type,
            quota              = quota,
        )

        return jsonify({
            "success": True,
            "data":    result,
        })

    except Exception as e:
        logger.exception("Prediction failed")
        return jsonify({
            "success": False,
            "message": f"Prediction failed: {str(e)}"
        }), 500


# ── Health check ───────────────────────────────────────────────────────────────

@app.route("/health")
def health():
    return jsonify({
        "success": True,
        "status":  "ok",
        "env":     FLASK_ENV,
    })


# ── Entry point ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    logger.info(f"Starting Flask ML service on port {PORT} (debug={DEBUG}, env={FLASK_ENV})")
    app.run(
        host  = "0.0.0.0",
        port  = PORT,
        debug = DEBUG,
    )