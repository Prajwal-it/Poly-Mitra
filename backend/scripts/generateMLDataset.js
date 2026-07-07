/**
 * generateMLDataset.js
 *
 * Merges all cutoff data (2023 & 2024, all 3 CAP rounds) into a single
 * clean JSON file suitable for ML model training.
 *
 * Steps:
 *  1. Load all 6 round JSON files.
 *  2. Filter out corrupted records where the "category" field accidentally
 *     contains a rank/percentage string (e.g. "120202\n(48.83)") instead
 *     of a valid category code (e.g. "NGOPENH").
 *  3. Drop any records missing required fields.
 *  4. Encode categorical features as integers (label encoding) for ML use.
 *  5. Write the merged, clean dataset to `ml_training_data.json`.
 *  6. Write encoding maps to `ml_encoding_maps.json` so the model can
 *     decode predictions back to human-readable values.
 *
 * Output schema per record:
 *  {
 *    // Raw fields (kept for reference / human readability)
 *    "year"         : 2024,
 *    "round"        : 1,
 *    "collegeCode"  : "1006",
 *    "collegeName"  : "Government Polytechnic, Murtijapur",
 *    "branchCode"   : "100619110",
 *    "branchName"   : "Civil Engineering",
 *    "category"     : "NGOPENH",
 *    "rank"         : 28692,
 *    "percentage"   : 84.6,
 *
 *    // Encoded features ready for ML (integer label-encoded)
 *    "collegeCode_enc"  : 42,
 *    "branchCode_enc"   : 17,
 *    "category_enc"     : 55,
 *  }
 */

const fs   = require("fs");
const path = require("path");

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns true if the category string looks like a valid category code
 * (starts with a letter, all upper-case ASCII + digits, no newlines).
 */
function isValidCategory(cat) {
  if (!cat || typeof cat !== "string") return false;
  // Valid codes are all-caps alpha + digits only, no newline / parenthesis
  return /^[A-Z][A-Z0-9]*$/.test(cat.trim());
}

/**
 * Build a label-encoding map from an array of unique string values.
 * Returns { value → integer index } and the reverse array.
 */
function buildEncoding(values) {
  const sorted = [...new Set(values)].sort();
  const map    = {};
  sorted.forEach((v, i) => { map[v] = i; });
  return { map, values: sorted };
}

/**
 * Convert an array of objects to a CSV string.
 * Strings containing commas or quotes are double-quoted and escaped.
 */
function toCSV(records) {
  if (!records.length) return "";
  const headers = Object.keys(records[0]);
  const escape  = (v) => {
    const s = String(v ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const lines = [
    headers.join(","),
    ...records.map(r => headers.map(h => escape(r[h])).join(",")),
  ];
  return lines.join("\n");
}

// ─── Load data ────────────────────────────────────────────────────────────────

const dataDir = path.join(__dirname, "..");

// ─── Parse 2025-26 Excel files on-the-fly ────────────────────────────────────

const XLSX = require("xlsx");

/**
 * Parse a rank/percentage string like "31722\n(83.80)".
 * Returns { rank, percentage } or null.
 */
function parseRankPercentage(val) {
  if (!val || typeof val !== "string") return null;
  if (!val.includes("(")) return null;
  try {
    const parts = val.split("\n");
    const rank = parseInt(parts[0]);
    const pctPart = parts.find((p) => p.includes("("));
    if (!pctPart) return null;
    const percentage = parseFloat(pctPart.replace("(", "").replace(")", ""));
    if (isNaN(rank) || isNaN(percentage)) return null;
    return { rank, percentage };
  } catch { return null; }
}

function isCategoryHeaderRow(row) {
  if (!row || row.length === 0) return false;
  if (row[0] != null) return false;
  return row.slice(1).some((c) => c && typeof c === "string" && c.trim().length > 0);
}

function isSectionLabel(row) {
  if (!row || row.length === 0) return false;
  if (typeof row[0] !== "string") return false;
  return row.slice(1).filter((c) => c != null && c !== "").length === 0;
}

/**
 * Parse a 2025-26 CAP workbook (same per-sheet format as 2024).
 */
function parseWorkbook2025(filePath, round, year = 2025) {
  const workbook = XLSX.readFile(filePath);
  const records = [];
  for (const sheetName of workbook.SheetNames) {
    try {
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      if (!data.length || !data[0] || !data[0][0]) continue;
      const headerCell = String(data[0][0]);
      const headerLines = headerCell.split("\n");
      if (headerLines.length < 2) continue;
      const collegeLine = headerLines[0];
      const branchLine  = headerLines[1];
      if (!collegeLine.includes(" - ") || !branchLine.includes(" - ")) continue;
      const collegeCode = collegeLine.split(" - ")[0]?.trim();
      const collegeName = collegeLine.split(" - ").slice(1).join(" - ")?.trim();
      const branchCode  = branchLine.split(" - ")[0]?.trim();
      const branchName  = branchLine.split(" - ").slice(1).join(" - ")?.trim();
      if (!collegeCode || !collegeName || !branchCode || !branchName) continue;
      let currentCategories = [];
      for (let rowIdx = 1; rowIdx < data.length; rowIdx++) {
        const row = data[rowIdx];
        if (!row || row.length === 0) continue;
        if (isSectionLabel(row)) { currentCategories = []; continue; }
        if (isCategoryHeaderRow(row)) {
          currentCategories = [];
          for (let col = 1; col < row.length; col++) {
            const cat = row[col];
            if (cat && typeof cat === "string" && cat.trim().length > 0)
              currentCategories.push({ col, category: cat.trim() });
          }
          continue;
        }
        if (currentCategories.length === 0) continue;
        for (const { col, category } of currentCategories) {
          const cellVal = row[col];
          if (!cellVal) continue;
          const parsed = parseRankPercentage(String(cellVal));
          if (!parsed) continue;
          records.push({ year, round, collegeCode, collegeName, branchCode, branchName, category, rank: parsed.rank, percentage: parsed.percentage });
        }
      }
    } catch (err) {
      // skip problematic sheets silently
    }
  }
  return records;
}

// Map 2025-26 Excel filenames to round numbers
const EXCEL_2025 = [
  { excelFile: "POST_SSC_Diploma_CAP1_Cutoff.xlsx", jsonFile: "cutoffs2025_round1.json", round: 1 },
  { excelFile: "POLY25_CAP_II_CUTOFF.xlsx",         jsonFile: "cutoffs2025_round2.json", round: 2 },
  { excelFile: "POLY_CAPIII_CUTOFF.xlsx",            jsonFile: "cutoffs2025_round3.json", round: 3 },
  { excelFile: "POLY_CAPIV_CUTOFF.xlsx",             jsonFile: "cutoffs2025_round4.json", round: 4 },
];

console.log("=".repeat(60));
console.log("  Poly-Mitra  .  ML Dataset Generator");
console.log("=".repeat(60));
console.log("  Parsing 2025-26 Excel files...");
console.log("-".repeat(60));

for (const { excelFile, jsonFile, round } of EXCEL_2025) {
  const excelPath = path.join(dataDir, excelFile);
  const jsonPath  = path.join(dataDir, jsonFile);
  if (!fs.existsSync(excelPath)) {
    console.warn(`  [WARN] Not found, skipping: ${excelFile}`);
    continue;
  }
  console.log(`  Parsing ${excelFile} (round ${round})...`);
  const records = parseWorkbook2025(excelPath, round, 2025);
  fs.writeFileSync(jsonPath, JSON.stringify(records, null, 2), "utf8");
  console.log(`  -> Extracted ${records.length} records  -> ${jsonFile}`);
}

console.log("-".repeat(60));

// ─── All data sources ─────────────────────────────────────────────────────────

const files = [
  { file: "cutoffs2023_round1.json", year: 2023, round: 1 },
  { file: "cutoffs2023_round2.json", year: 2023, round: 2 },
  { file: "cutoffs2023_round3.json", year: 2023, round: 3 },
  { file: "cutoffs2024_round1.json", year: 2024, round: 1 },
  { file: "cutoffs2024_round2.json", year: 2024, round: 2 },
  { file: "cutoffs2024_round3.json", year: 2024, round: 3 },
  { file: "cutoffs2025_round1.json", year: 2025, round: 1 },
  { file: "cutoffs2025_round2.json", year: 2025, round: 2 },
  { file: "cutoffs2025_round3.json", year: 2025, round: 3 },
  { file: "cutoffs2025_round4.json", year: 2025, round: 4 },
];

let allRecords   = [];
let totalLoaded  = 0;
let totalDropped = 0;

console.log("  Loading all JSON data sources...");
console.log("-".repeat(60));

for (const { file, year, round } of files) {
  const filePath = path.join(dataDir, file);

  if (!fs.existsSync(filePath)) {
    console.warn(`  [WARN] File not found, skipping: ${file}`);
    continue;
  }

  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  totalLoaded += raw.length;

  let kept    = 0;
  let dropped = 0;

  for (const rec of raw) {
    // --- Validation ---
    const missingField =
      !rec.year        ||
      !rec.round       ||
      !rec.collegeCode ||
      !rec.collegeName ||
      !rec.branchCode  ||
      !rec.branchName  ||
      !isValidCategory(rec.category) ||
      rec.rank      == null ||
      rec.percentage == null;

    if (missingField) {
      dropped++;
      continue;
    }

    allRecords.push({
      year:         Number(rec.year),
      round:        Number(rec.round),
      collegeCode:  String(rec.collegeCode).trim(),
      collegeName:  String(rec.collegeName).trim(),
      branchCode:   String(rec.branchCode).trim(),
      branchName:   String(rec.branchName).trim(),
      category:     String(rec.category).trim(),
      rank:         Number(rec.rank),
      percentage:   Number(rec.percentage),
    });
    kept++;
  }

  totalDropped += dropped;
  console.log(
    `  ${file.padEnd(38)} loaded: ${String(raw.length).padStart(6)}` +
    `  kept: ${String(kept).padStart(6)}  dropped: ${dropped}`
  );
}

console.log("-".repeat(60));
console.log(`  Total loaded : ${totalLoaded}`);
console.log(`  Total dropped: ${totalDropped}  (corrupted / missing fields)`);
console.log(`  Total clean  : ${allRecords.length}`);
console.log("-".repeat(60));

// ─── Build label encodings ────────────────────────────────────────────────────

const collegeEnc  = buildEncoding(allRecords.map(r => r.collegeCode));
const branchEnc   = buildEncoding(allRecords.map(r => r.branchCode));
const categoryEnc = buildEncoding(allRecords.map(r => r.category));

console.log(`  Unique colleges  : ${collegeEnc.values.length}`);
console.log(`  Unique branches  : ${branchEnc.values.length}`);
console.log(`  Unique categories: ${categoryEnc.values.length}`);
console.log("-".repeat(60));

// ─── Attach encoded features ──────────────────────────────────────────────────

for (const rec of allRecords) {
  rec.collegeCode_enc  = collegeEnc.map[rec.collegeCode];
  rec.branchCode_enc   = branchEnc.map[rec.branchCode];
  rec.category_enc     = categoryEnc.map[rec.category];
}

// ─── Write outputs ────────────────────────────────────────────────────────────

// 1. Main training dataset — JSON
const outDataPath = path.join(dataDir, "ml_training_data.json");
fs.writeFileSync(outDataPath, JSON.stringify(allRecords, null, 2), "utf8");
console.log(`  [OK] Wrote training dataset -> ml_training_data.json`);

// 2. Main training dataset — CSV
const outCsvPath = path.join(dataDir, "ml_training_data.csv");
fs.writeFileSync(outCsvPath, toCSV(allRecords), "utf8");
console.log(`  [OK] Wrote training dataset -> ml_training_data.csv`);

// 3. Encoding maps (needed to decode model predictions)
const encodingMaps = {
  description: "Label encoding maps for ML training. Index -> value (for decoding).",
  collegeCode:  collegeEnc.values,   // array index = encoded int, value = original code
  branchCode:   branchEnc.values,
  category:     categoryEnc.values,
};
const outMapsPath = path.join(dataDir, "ml_encoding_maps.json");
fs.writeFileSync(outMapsPath, JSON.stringify(encodingMaps, null, 2), "utf8");
console.log(`  [OK] Wrote encoding maps   -> ml_encoding_maps.json`);

// 4. Quick stats summary
const years  = [...new Set(allRecords.map(r => r.year))].sort();
const rounds = [...new Set(allRecords.map(r => r.round))].sort();

const summary = {
  generatedAt      : new Date().toISOString(),
  totalRecords     : allRecords.length,
  totalDropped     : totalDropped,
  years,
  rounds,
  uniqueColleges   : collegeEnc.values.length,
  uniqueBranches   : branchEnc.values.length,
  uniqueCategories : categoryEnc.values.length,
  features: [
    "year (numeric)",
    "round (numeric: 1-3)",
    "collegeCode_enc (label-encoded int)",
    "branchCode_enc (label-encoded int)",
    "category_enc (label-encoded int)",
  ],
  targets: [
    "rank (numeric -- cutoff merit rank)",
    "percentage (numeric -- cutoff percentage)",
  ],
  note: "See ml_encoding_maps.json to decode collegeCode_enc, branchCode_enc, category_enc back to string values.",
};

const outSummaryPath = path.join(dataDir, "ml_dataset_summary.json");
fs.writeFileSync(outSummaryPath, JSON.stringify(summary, null, 2), "utf8");
console.log(`  [OK] Wrote dataset summary -> ml_dataset_summary.json`);

console.log("=".repeat(60));
console.log("  Done! Your ML dataset is ready.");
console.log("=".repeat(60));
