const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

/**
 * Parse a rank/percentage string like "31722\n(83.80)" or "31722\n(83.80)\n..."
 * Returns { rank, percentage } or null if not valid.
 */
function parseRankPercentage(val) {
  if (!val || typeof val !== "string") return null;
  // Must contain "(" to have a percentage
  if (!val.includes("(")) return null;
  try {
    const parts = val.split("\n");
    const rank = parseInt(parts[0]);
    // Find the part with parentheses for percentage
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
 * Determines if a row is a category header row.
 * A category header row has null/empty in col 0 and at least one known
 * category-like string (all caps, no spaces) in the other columns.
 */
function isCategoryHeaderRow(row) {
  if (!row || row.length === 0) return false;
  // col 0 must be null or undefined
  if (row[0] != null) return false;
  // At least one non-null string in cols 1+
  const cats = row.slice(1).filter(
    (c) => c && typeof c === "string" && c.trim().length > 0
  );
  return cats.length > 0;
}

/**
 * Determines if a row is a section/subsection label (single string in col 0, all others empty).
 * These are rows like "Home District Seats", "Home District Non-Technical..."
 */
function isSectionLabel(row) {
  if (!row || row.length === 0) return false;
  if (typeof row[0] !== "string") return false;
  const rest = row.slice(1).filter((c) => c != null && c !== "");
  return rest.length === 0;
}

/**
 * Parse a single workbook file for 2024-25 data.
 * Each sheet represents one college+branch combination.
 */
function parseWorkbookFile2024(filePath, round, year = 2024) {
  const workbook = XLSX.readFile(filePath);
  const records = [];

  for (const sheetName of workbook.SheetNames) {
    try {
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      if (!data.length || !data[0] || !data[0][0]) continue;

      // Row 0 should contain "COLLEGECODE - CollegeName\nBRANCHCODE - BranchName\nStatus: ..."
      const headerCell = String(data[0][0]);
      const headerLines = headerCell.split("\n");

      if (headerLines.length < 2) {
        console.log(`Skipping sheet ${sheetName}: header has < 2 lines`);
        continue;
      }

      const collegeLine = headerLines[0];
      const branchLine = headerLines[1];

      if (!collegeLine.includes(" - ") || !branchLine.includes(" - ")) {
        console.log(
          `Skipping sheet ${sheetName}: header not in 'CODE - Name' format`
        );
        continue;
      }

      const collegeCode = collegeLine.split(" - ")[0]?.trim();
      const collegeName = collegeLine.split(" - ").slice(1).join(" - ")?.trim();
      const branchCode = branchLine.split(" - ")[0]?.trim();
      const branchName = branchLine.split(" - ").slice(1).join(" - ")?.trim();

      if (!collegeCode || !collegeName || !branchCode || !branchName) {
        console.log(`Skipping sheet ${sheetName}: could not extract codes/names`);
        continue;
      }

      // Now scan rows starting from row 1
      // Keep track of the current category header row
      let currentCategories = []; // array of { col, category }

      for (let rowIdx = 1; rowIdx < data.length; rowIdx++) {
        const row = data[rowIdx];
        if (!row || row.length === 0) continue;

        // Section label rows - reset categories and skip
        if (isSectionLabel(row)) {
          currentCategories = [];
          continue;
        }

        // Category header row - update current categories
        if (isCategoryHeaderRow(row)) {
          currentCategories = [];
          for (let col = 1; col < row.length; col++) {
            const cat = row[col];
            if (cat && typeof cat === "string" && cat.trim().length > 0) {
              currentCategories.push({ col, category: cat.trim() });
            }
          }
          continue;
        }

        // Data row - row[0] is a stage label like "Stage-I", "Stage-IV", "I-Non PWD / DEF" etc.
        // Extract rank/percentage for each known category column
        if (currentCategories.length === 0) continue;

        for (const { col, category } of currentCategories) {
          const cellVal = row[col];
          if (!cellVal) continue;
          const parsed = parseRankPercentage(String(cellVal));
          if (!parsed) continue;

          records.push({
            year,
            round,
            collegeCode,
            collegeName,
            branchCode,
            branchName,
            category,
            rank: parsed.rank,
            percentage: parsed.percentage,
          });
        }
      }
    } catch (err) {
      console.log(
        `Error processing sheet ${sheetName} in ${path.basename(filePath)}:`,
        err.message || err
      );
    }
  }

  return records;
}

// ─── File mapping ────────────────────────────────────────────────────────────
// Map known 2024-25 filenames to their round numbers
const FILE_TO_ROUND = {
  "POST_SSC_CAP1_CutOff_2024_25.xlsx": 1,
  "Cap2_2024_25.xlsx": 2,
  "POLY_CAP_ROUND_III_CUTOFF_2024_25.xlsx": 3,
};

const cwd = process.cwd();

// If a CLI argument is given, use that file only
const cliFile = process.argv[2];
let filesToProcess = [];

if (cliFile) {
  const provided = path.isAbsolute(cliFile)
    ? cliFile
    : path.join(cwd, cliFile);
  if (!fs.existsSync(provided)) {
    console.log("Provided file not found:", provided);
    process.exit(1);
  }
  const basename = path.basename(provided);
  const round = FILE_TO_ROUND[basename];
  if (!round) {
    console.log(
      `Cannot determine round for file: ${basename}. ` +
        `Known files: ${Object.keys(FILE_TO_ROUND).join(", ")}`
    );
    process.exit(1);
  }
  filesToProcess = [{ filePath: provided, round }];
} else {
  // Auto-discover the 3 known 2024-25 files in cwd
  for (const [fileName, round] of Object.entries(FILE_TO_ROUND)) {
    const filePath = path.join(cwd, fileName);
    if (fs.existsSync(filePath)) {
      filesToProcess.push({ filePath, round });
    } else {
      console.log(`Warning: expected file not found: ${fileName}`);
    }
  }
}

if (filesToProcess.length === 0) {
  console.log("No 2024-25 CAP cutoff Excel files found in", cwd);
  process.exit(1);
}

for (const { filePath, round } of filesToProcess) {
  console.log(
    `Processing ${path.basename(filePath)} as round ${round} (year 2024)...`
  );
  const records = parseWorkbookFile2024(filePath, round, 2024);
  console.log(`Total Records Extracted for round ${round}: ${records.length}`);

  const outName = `cutoffs2024_round${round}.json`;
  const outPath = path.join(cwd, outName);
  fs.writeFileSync(outPath, JSON.stringify(records, null, 2));
  console.log(`Wrote ${outName}`);

  // Validation
  const badRecords = records.filter(
    (r) =>
      !r.collegeCode ||
      !r.branchCode ||
      !r.category ||
      !r.rank ||
      !r.percentage
  );
  console.log(`Bad records for round ${round}: ${badRecords.length}`);

  const unique = new Set();
  let duplicates = 0;
  for (const record of records) {
    const key = `${record.collegeCode}-${record.branchCode}-${record.category}`;
    if (unique.has(key)) duplicates++;
    unique.add(key);
  }
  console.log(`Duplicates for round ${round}: ${duplicates}`);
}
