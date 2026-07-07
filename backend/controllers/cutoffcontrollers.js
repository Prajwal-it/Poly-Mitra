const Cutoff = require('../model/cutoff');
const { isValidCategory } = require('../utils/category');

/**
 * GET /api/cutoffs
 * Query params: year, round, collegeCode, collegeName, branchCode, branchName, category, page, limit
 */
const getCutoffs = async (req, res) => {
  try {
    const query = {};

    if (req.query.year) {
      query.year = Number(req.query.year);
    }

    if (req.query.round) {
      query.round = Number(req.query.round);
    }

    if (req.query.collegeCode) {
      query.collegeCode = req.query.collegeCode;
    }

    if (req.query.collegeName) {
      // Split into words and join with .* so "Government Polytechnic Nashik"
      // matches "Government Polytechnic, Nashik" (ignoring commas/punctuation)
      const words = req.query.collegeName.trim().split(/\s+/).map(
        w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      );
      query.collegeName = { $regex: new RegExp(words.join('.*'), 'i') };
    }

    if (req.query.branchCode) {
      query.branchCode = req.query.branchCode;
    }

    if (req.query.branchName) {
      query.branchName = { $regex: new RegExp(req.query.branchName, 'i') };
    }

    if (req.query.category) {
      query.category = req.query.category;
    }

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;

    const totalRecords = await Cutoff.countDocuments(query);

    const cutoffs = await Cutoff.find(query)
      .skip((page - 1) * limit)
      .limit(limit);

    res.status(200).json({
      success: true,
      currentPage: page,
      totalRecords,
      totalPages: Math.ceil(totalRecords / limit),
      data: cutoffs,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

/**
 * GET /api/cutoffs/colleges
 * Returns all distinct college names (optionally filtered by year).
 */
const getAllColleges = async (req, res) => {
  try {
    const filter = {};
    if (req.query.year) filter.year = Number(req.query.year);

    const colleges = await Cutoff.distinct("collegeName", filter);
    colleges.sort();

    res.status(200).json({
      success: true,
      count: colleges.length,
      data: colleges,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

/**
 * GET /api/cutoffs/branches
 * Returns all distinct branch names (optionally filtered by year).
 */
const getAllBranches = async (req, res) => {
  try {
    const filter = {};
    if (req.query.year) filter.year = Number(req.query.year);

    const branches = await Cutoff.distinct("branchName", filter);
    branches.sort();

    res.status(200).json({
      success: true,
      count: branches.length,
      data: branches,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

/**
 * GET /api/cutoffs/categories
 * Returns all distinct category codes (optionally filtered by year).
 */
const getAllCategories = async (req, res) => {
  try {
    const filter = {};
    if (req.query.year) filter.year = Number(req.query.year);

    const raw = await Cutoff.distinct("category", filter);
    const categories = raw.filter(isValidCategory).sort();

    res.status(200).json({
      success: true,
      count: categories.length,
      data: categories,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

/**
 * GET /api/cutoffs/years
 * Returns all available years and their respective rounds in the database.
 * Example response:
 * { success: true, data: [ { year: 2023, rounds: [1,2,3] }, { year: 2025, rounds: [1,2,3,4] } ] }
 */
const getAvailableYears = async (req, res) => {
  try {
    const years = await Cutoff.distinct("year");
    years.sort((a, b) => a - b);

    const data = await Promise.all(
      years.map(async (year) => {
        const rounds = await Cutoff.distinct("round", { year });
        rounds.sort((a, b) => a - b);
        return { year, rounds };
      })
    );

    res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

/**
 * GET /api/cutoffs/college/:collegeCode
 * Returns all cutoff records for a specific college code.
 * Supports optional year and round query params.
 */
const getCutoffsByCollege = async (req, res) => {
  try {
    const { collegeCode } = req.params;
    const query = { collegeCode };

    if (req.query.year) query.year = Number(req.query.year);
    if (req.query.round) query.round = Number(req.query.round);

    const cutoffs = await Cutoff.find(query).sort({ year: -1, round: -1 });

    res.status(200).json({
      success: true,
      count: cutoffs.length,
      data: cutoffs,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

/**
 * GET /api/cutoffs/college-list
 * Returns distinct { collegeCode, collegeName } pairs derived from cutoff records.
 * Replaces the deleted College model.
 * Optional query param: ?year=
 */
const getCollegeList = async (req, res) => {
  try {
    const match = {};
    if (req.query.year) match.year = Number(req.query.year);

    const colleges = await Cutoff.aggregate([
      { $match: match },
      { $group: { _id: '$collegeCode', collegeName: { $first: '$collegeName' } } },
      { $project: { _id: 0, collegeCode: '$_id', collegeName: 1 } },
      { $sort: { collegeName: 1 } },
    ]);

    res.status(200).json({
      success: true,
      count: colleges.length,
      data: colleges,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getCutoffs,
  getAllColleges,
  getAllBranches,
  getAllCategories,
  getAvailableYears,
  getCutoffsByCollege,
  getCollegeList,
};