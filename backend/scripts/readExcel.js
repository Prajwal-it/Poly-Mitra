const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

function parseWorkbookFile(filePath, round, year = 2023) {
  const workbook = XLSX.readFile(filePath);

  const records = [];

  for (const sheetName of workbook.SheetNames) {
    try {
      const sheet = workbook.Sheets[sheetName];

      const data = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
      });

      if (!data.length || !data[0] || !data[0][0]) {
        continue;
      }

      const header = data[0][0];
      const lines = header.split("\n");
      if (lines.length < 2) continue;

      const collegeLine = lines[0];
      const branchLine = lines[1];

      // Expect header lines in format "CODE - Name". If not present, skip sheet.
      if (!collegeLine.includes(" - ") || !branchLine.includes(" - ")) {
        console.log(`Skipping sheet ${sheetName}: header not in 'CODE - Name' format ->`, {
          header: header,
        });
        continue;
      }

      const collegeCode = collegeLine.split(" - ")[0]?.trim();
      const collegeName = collegeLine.split(" - ")[1]?.trim();

      const branchCode = branchLine.split(" - ")[0]?.trim();
      const branchName = branchLine.split(" - ")[1]?.trim();

      for (let row = 0; row < data.length - 1; row++) {
        const currentRow = data[row];
        const nextRow = data[row + 1];

        if (!currentRow || !nextRow) continue;

        const categories = currentRow.filter(
          (cell) =>
            typeof cell === "string" &&
            !cell.includes("Stage") &&
            !cell.includes("Seats") &&
            !cell.includes("Candidates")
        );

        if (categories.length === 0) continue;

        for (let col = 1; col < currentRow.length; col++) {
          const category = currentRow[col];
          if (!category || typeof category !== "string") continue;

          const value = nextRow[col];
          if (!value || typeof value !== "string" || !value.includes("(")) continue;

          try {
            const parts = value.split("\n");
            const rank = parseInt(parts[0]);
            const percentage = parseFloat(parts[1].replace("(", "").replace(")", ""));

            if (isNaN(rank) || isNaN(percentage)) continue;

            records.push({
              year,
              round,
              collegeCode,
              collegeName,
              branchCode,
              branchName,
              category: category.trim(),
              rank,
              percentage,
            });
          } catch (err) {
            continue;
          }
        }
      }
    } catch (err) {
      console.log(`Error processing ${sheetName} in ${filePath}:`, err.message || err);
    }
  }

  return records;
}

// Discover CAP files in current directory
const cwd = process.cwd();
const files = fs.readdirSync(cwd);

let capFiles = files.filter((f) => /POST_SSC_CAP\d+_CutOff_2023_24\.xlsx/i.test(f));

// Allow passing a specific file path as CLI argument (handles non-standard names)
const cliFile = process.argv[2];
if (cliFile) {
  const provided = path.isAbsolute(cliFile) ? cliFile : path.join(cwd, cliFile);
  if (!fs.existsSync(provided)) {
    console.log("Provided file not found:", provided);
    process.exit(1);
  }

  capFiles = [provided];
}

if (capFiles.length === 0) {
  console.log("No CAP cutoff Excel files found in", cwd);
  process.exit(1);
}

for (const fileName of capFiles) {
  const filePath = path.isAbsolute(fileName) ? fileName : path.join(cwd, fileName);
  const match = path.basename(filePath).match(/CAP(\d+)/i);
  const round = match ? parseInt(match[1], 10) : null;

  if (!round) {
    console.log("Could not determine round from filename:", fileName);
    continue;
  }

  console.log(`Processing ${fileName} as round ${round}...`);

  const records = parseWorkbookFile(filePath, round, 2023);

  console.log(`Total Records Extracted for round ${round}: ${records.length}`);

  const outName = `cutoffs2023_round${round}.json`;
  fs.writeFileSync(outName, JSON.stringify(records, null, 2));
  console.log(`Wrote ${outName}`);

  // Basic validation
  const badRecords = records.filter(
    (record) =>
      !record.collegeCode ||
      !record.branchCode ||
      !record.category ||
      !record.rank ||
      !record.percentage
  );

  console.log(`Bad records for round ${round}:`, badRecords.length);

  const unique = new Set();
  let duplicates = 0;
  for (const record of records) {
    const key = `${record.collegeCode}-${record.branchCode}-${record.category}`;
    if (unique.has(key)) duplicates++;
    unique.add(key);
  }
  console.log(`Duplicates for round ${round}:`, duplicates);
}