# ============================================================
#  PolyMitra — Fly.io Deployment Guide
#  One-time setup + deploy commands
# ============================================================

## PREREQUISITES
# 1. Install flyctl: https://fly.io/docs/getting-started/installing-flyctl/
#    Windows: powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"
# 2. Sign up at fly.io (free, credit card required to prevent abuse)
# 3. Login: fly auth login

# ============================================================
# STEP 1 — Deploy the Flask ML Service
# ============================================================

cd "backend/project/python backend"

# First-time setup (run ONCE):
fly launch --no-deploy --name polymitra-ml --region bom

# Set secrets (environment variables — never hardcode these):
fly secrets set FLASK_ENV=production
fly secrets set FLASK_DEBUG=0

# Deploy:
fly deploy

# Get the ML service URL (you'll need it for the Node.js service):
fly status
# URL will be: https://polymitra-ml.fly.dev


# ============================================================
# STEP 2 — Deploy the Node.js API
# ============================================================

cd backend/

# First-time setup (run ONCE):
fly launch --no-deploy --name polymitra-api --region bom

# Set secrets:
fly secrets set MONGODB_URI="mongodb+srv://YOUR_USER:YOUR_PASS@YOUR_CLUSTER.mongodb.net/polymitra"
fly secrets set PYTHON_ML_URL="https://polymitra-ml.fly.dev"
fly secrets set NODE_ENV=production

# Deploy:
fly deploy

# Your API will be at: https://polymitra-api.fly.dev


# ============================================================
# STEP 3 — Update Vercel Frontend
# ============================================================
# In your Vercel dashboard → polymitra frontend → Settings → Environment Variables:
# VITE_API_URL = https://polymitra-api.fly.dev


# ============================================================
# USEFUL COMMANDS (Day-to-day)
# ============================================================

# View live logs:
fly logs --app polymitra-ml
fly logs --app polymitra-api

# Check status:
fly status --app polymitra-ml
fly status --app polymitra-api

# Redeploy after code changes:
fly deploy --app polymitra-ml   # from python backend directory
fly deploy --app polymitra-api  # from backend directory

# SSH into the machine (debugging):
fly ssh console --app polymitra-ml

# View secret names (not values):
fly secrets list --app polymitra-api

# Scale up if needed (during CAP season):
fly scale count 2 --app polymitra-api


# ============================================================
# FREE TIER LIMITS (as of 2026)
# ============================================================
# - 3 shared-cpu-1x VMs with 256MB RAM: FREE
# - Up to 3GB persistent storage: FREE
# - 160GB outbound data transfer: FREE
# - polymitra-ml uses 1GB RAM → within hobby plan allowance
# - hobby plan: ~$5/mo for the 1GB RAM ML machine
# - polymitra-api (512MB): likely within free allowance
#
# Expected total: $0–8/mo
