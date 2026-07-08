# Dockerfile.ml — PolyMitra Flask ML Service
# Optimized for Fly.io (also works on any container platform)

FROM python:3.11-slim

WORKDIR /app

# Install libgomp (required by CatBoost for OpenMP threading)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies first (Docker layer cache)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app.py predictor.py ./

# Copy the trained model
COPY models/ ./models/

ENV PORT=8080 \
    FLASK_ENV=production \
    FLASK_DEBUG=0

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=15s --start-period=40s --retries=3 \
  CMD python -c \
    "import urllib.request, json; \
     r = urllib.request.urlopen('http://localhost:8080/health', timeout=10); \
     d = json.loads(r.read()); \
     exit(0 if d.get('model_loaded') else 1)"

# preload_app=True: model loads ONCE in master, workers fork with model ready
CMD ["gunicorn", \
     "--bind", "0.0.0.0:8080", \
     "--workers", "1", \
     "--threads", "4", \
     "--worker-class", "gthread", \
     "--timeout", "120", \
     "--preload", \
     "--access-logfile", "-", \
     "--error-logfile", "-", \
     "app:app"]
