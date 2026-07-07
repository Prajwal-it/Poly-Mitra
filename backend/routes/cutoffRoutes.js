const express = require("express");

const router = express.Router();

const {
  getCutoffs,
  getAllColleges,
  getAllBranches,
  getAllCategories,
  getAvailableYears,
  getCutoffsByCollege,
  getCollegeList,
} = require("../controllers/cutoffcontrollers");

// ── Meta / lookup routes (defined before "/" to avoid shadowing) ──────────────

// GET /api/cutoffs/years   → available years and their rounds
router.get("/years", getAvailableYears);

// GET /api/cutoffs/colleges  → distinct college names (optional ?year=)
router.get("/colleges", getAllColleges);

// GET /api/cutoffs/branches  → distinct branch names (optional ?year=)
router.get("/branches", getAllBranches);

// GET /api/cutoffs/categories → distinct category codes (optional ?year=)
router.get("/categories", getAllCategories);

// GET /api/cutoffs/college-list  → distinct { collegeCode, collegeName } from cutoffs
router.get("/college-list", getCollegeList);

// GET /api/cutoffs/college/:collegeCode → all records for a specific college
router.get("/college/:collegeCode", getCutoffsByCollege);

// ── Main search route ─────────────────────────────────────────────────────────

// GET /api/cutoffs  → paginated search with filters
// Query params: year, round, collegeCode, collegeName, branchCode, branchName, category, page, limit
router.get("/", getCutoffs);

module.exports = router;