const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Parse a rank/percentage string like "31722\n(83.80)"
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
  } catch {
    return null;
  }
}

/**
 * Returns true if the value looks like a college+branch header:
 * "CODE - College Name\nCODE - Branch Name\nStatus: ..."
 */
function isCollegeBranchHeader(val) {
  if (!val || typeof val !== "string") return false;
  const lines = val.split("\n");
  return (
    lines.length >= 2 &&
    lines[0].includes(" - ") &&
    lines[1].includes(" - ")
  );
}

/**
 * Get non-metadata cells from a sheet as { address: value }.
 */
function getSheetCells(sheet) {
  const cells = {};
  for (const key of Object.keys(sheet)) {
    if (!key.startsWith("!")) cells[key] = sheet[key].v;
  }
  return cells;
}

/**
 * Parse a data sheet.
 * Scans all rows to find the first "category header row" where col A is
 * empty/null and cols B+ contain category strings (e.g. "NGOPENH", "TFWS").
 * Rows after the header row are data rows with "rank\n(pct)" values.
 * Handles both row-0 and row-1 header offsets.
 * Returns array of { category, rank, percentage }.
 */
function parseDataSheet(sheet) {
  const results = [];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  if (!data || data.length < 1) return results;

  // Find the category header row: col 0 is empty, at least one col 1+ is a string
  let headerRowIdx = -1;
  let categories = [];
  for (let rowIdx = 0; rowIdx < data.length; rowIdx++) {
    const row = data[rowIdx];
    if (!row) continue;
    // col 0 must be empty
    if (row[0] != null && row[0] !== "") continue;
    // look for category strings in cols 1+
    const cats = [];
    for (let col = 1; col < row.length; col++) {
      const cat = row[col];
      if (cat && typeof cat === "string" && cat.trim().length > 0) {
        cats.push({ col, category: cat.trim() });
      }
    }
    if (cats.length > 0) {
      headerRowIdx = rowIdx;
      categories = cats;
      break;
    }
  }
  if (headerRowIdx === -1 || categories.length === 0) return results;

  // Extract rank/pct from rows after the header
  for (let rowIdx = headerRowIdx + 1; rowIdx < data.length; rowIdx++) {
    const row = data[rowIdx];
    if (!row) continue;
    for (const { col, category } of categories) {
      const cellVal = row[col];
      if (!cellVal) continue;
      const parsed = parseRankPercentage(String(cellVal));
      if (parsed) {
        results.push({ category, rank: parsed.rank, percentage: parsed.percentage });
      }
    }
  }
  return results;
}

// ─── Main Parser ──────────────────────────────────────────────────────────────

/**
 * Parse a 2025-26 workbook.
 *
 * The 2025 format spreads each college+branch across MULTIPLE sequential sheets:
 *
 *   Sheet N:   1 cell A1 = "CCODE - CName\nBCODE - BName\nStatus:..."  ← HEADER
 *   Sheet N+1: 1 cell A1 = "Home District Seats"                        ← SECTION
 *   Sheet N+2: 1 cell A1 = "Home District Non-Technical..."             ← SECTION
 *   Sheet N+3: 14+ cells  (categories in row1, ranks in rows2+)        ← DATA ✅
 *   Sheet N+4: 1 cell A1 = "Other than Home District Seats"            ← SECTION
 *   Sheet N+5: DATA ✅
 *   ... next college+branch header ...
 */
function parseWorkbook2025(filePath, round, year = 2025) {
  console.log(`  Reading ${path.basename(filePath)}...`);
  const workbook = XLSX.readFile(filePath);
  const records = [];

  // Current college+branch context (set when we hit a header sheet)
  let collegeCode = null;
  let collegeName = null;
  let branchCode = null;
  let branchName = null;

  let sheetCount = 0;

  for (const sheetName of workbook.SheetNames) {
    sheetCount++;
    if (sheetCount % 1000 === 0) {
      process.stdout.write(
        `    ... ${sheetCount}/${workbook.SheetNames.length} sheets, ${records.length} records\n`
      );
    }

    const sheet = workbook.Sheets[sheetName];
    const cells = getSheetCells(sheet);
    const cellCount = Object.keys(cells).length;

    if (cellCount === 0) continue;

    if (cellCount === 1) {
      // Single-cell sheet: either a header or a section label
      const val = String(Object.values(cells)[0] || "");

      if (isCollegeBranchHeader(val)) {
        // New college+branch group begins
        const lines = val.split("\n");
        const collegeLine = lines[0].trim();
        const branchLine = lines[1].trim();

        if (collegeLine.includes(" - ") && branchLine.includes(" - ")) {
          collegeCode = collegeLine.split(" - ")[0].trim();
          collegeName = collegeLine.split(" - ").slice(1).join(" - ").trim();
          branchCode = branchLine.split(" - ")[0].trim();
          branchName = branchLine.split(" - ").slice(1).join(" - ").trim();
        }
      }
      // Section labels ("Home District Seats", etc.) — no action needed
      continue;
    }

    // Multi-cell sheet = data table
    if (collegeCode && branchCode) {
      const entries = parseDataSheet(sheet);
      for (const { category, rank, percentage } of entries) {
        records.push({
          year,
          round,
          collegeCode,
          collegeName,
          branchCode,
          branchName,
          category,
          rank,
          percentage,
        });
      }
    }
  }

  console.log(`  Done: ${sheetCount} sheets → ${records.length} records`);
  return records;
}

// ─── File mapping ─────────────────────────────────────────────────────────────

const FILE_TO_ROUND = {
  "POST_SSC_Diploma_CAP1_Cutoff.xlsx": 1,
  "POLY25_CAP_II_CUTOFF.xlsx": 2,
  "POLY_CAPIII_CUTOFF.xlsx": 3,
  "POLY_CAPIV_CUTOFF.xlsx": 4,
};

const cwd = process.cwd();
const cliFile = process.argv[2];
let filesToProcess = [];

if (cliFile) {
  const provided = path.isAbsolute(cliFile)
    ? cliFile
    : path.join(cwd, cliFile);
  if (!fs.existsSync(provided)) {
    console.error("File not found:", provided);
    process.exit(1);
  }
  const basename = path.basename(provided);
  const round = FILE_TO_ROUND[basename];
  if (!round) {
    console.error(
      `Unknown file: ${basename}. Known: ${Object.keys(FILE_TO_ROUND).join(", ")}`
    );
    process.exit(1);
  }
  filesToProcess = [{ filePath: provided, round }];
} else {
  for (const [fileName, round] of Object.entries(FILE_TO_ROUND)) {
    const filePath = path.join(cwd, fileName);
    if (fs.existsSync(filePath)) {
      filesToProcess.push({ filePath, round });
    } else {
      console.log(`Warning: not found: ${fileName}`);
    }
  }
}

if (filesToProcess.length === 0) {
  console.error("No 2025-26 Excel files found in", cwd);
  process.exit(1);
}

for (const { filePath, round } of filesToProcess) {
  console.log(`\n=== Round ${round}: ${path.basename(filePath)} ===`);
  const records = parseWorkbook2025(filePath, round, 2025);
  console.log(`  Total: ${records.length} records for round ${round}`);

  const outName = `cutoffs2025_round${round}.json`;
  const outPath = path.join(cwd, outName);
  fs.writeFileSync(outPath, JSON.stringify(records, null, 2));
  console.log(`  Wrote ${outName}`);

  const bad = records.filter(
    (r) => !r.collegeCode || !r.branchCode || !r.category || !r.rank || !r.percentage
  );
  console.log(`  Bad records: ${bad.length}`);

  const seen = new Set();
  let dups = 0;
  for (const r of records) {
    const key = `${r.collegeCode}-${r.branchCode}-${r.category}`;
    if (seen.has(key)) dups++;
    seen.add(key);
  }
  console.log(`  Duplicates: ${dups}`);
}
