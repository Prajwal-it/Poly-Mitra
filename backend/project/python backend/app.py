import os
import logging
from flask import Flask, request, jsonify
from flask_cors import CORS

from predictor import predict_admission, is_model_loaded, get_model_error, _load_model

# ── Logging ────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger(__name__)

# ── Config from environment ────────────────────────────────────────────────────
PORT      = int(os.environ.get("PORT", 3000))
DEBUG     = os.environ.get("FLASK_DEBUG", "0") == "1"
FLASK_ENV = os.environ.get("FLASK_ENV", "production")

# ── App ────────────────────────────────────────────────────────────────────────
app = Flask(__name__)
CORS(app)


# ── Routes ─────────────────────────────────────────────────────────────────────

@app.route("/")
def home():
    return jsonify({
        "success":     True,
        "message":     "Polytechnic Cutoff Predictor ML API is running!",
        "env":         FLASK_ENV,
        "model_ready": is_model_loaded(),
    })


@app.route("/predict", methods=["POST"])
def predict():
    # ── Guard: refuse requests if model not ready ──────────────────────────────
    if not is_model_loaded():
        # Attempt a fresh load before giving up (handles transient startup failures)
        logger.warning("/predict called but model not loaded — attempting reload…")
        _load_model(retries=1, delay=0)
        if not is_model_loaded():
            return jsonify({
                "success": False,
                "message": (
                    "ML model is not loaded. "
                    f"Last error: {get_model_error()}. "
                    "Please try again in a few seconds or contact support."
                ),
                "model_error": get_model_error(),
            }), 503

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
            "message": (
                f"Invalid numeric value: {str(e)}. "
                "'percentage' must be a number, 'round' and 'year' must be integers."
            )
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

    except RuntimeError as e:
        # Model not ready (raised by predict_admission guard)
        logger.error(f"Model not ready during prediction: {e}")
        return jsonify({
            "success": False,
            "message": str(e),
        }), 503

    except Exception as e:
        logger.exception("Prediction failed")
        return jsonify({
            "success": False,
            "message": f"Prediction failed: {str(e)}"
        }), 500


# ── Health check ───────────────────────────────────────────────────────────────
# Returns 200 + model_loaded=true when healthy.
# Returns 503 + model_loaded=false if the model failed to load — so the
# keep-warm pinger in Node.js can detect real problems vs. just "server is up".

@app.route("/health")
def health():
    loaded = is_model_loaded()
    status_code = 200 if loaded else 503
    return jsonify({
        "success":     loaded,
        "status":      "ok" if loaded else "model_not_loaded",
        "model_loaded": loaded,
        "model_error": get_model_error(),
        "env":         FLASK_ENV,
    }), status_code


# ── Entry point ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    logger.info(
        f"Starting Flask ML service on port {PORT} "
        f"(debug={DEBUG}, env={FLASK_ENV}, model_ready={is_model_loaded()})"
    )
    app.run(
        host  = "0.0.0.0",
        port  = PORT,
        debug = DEBUG,
    )