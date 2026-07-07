/**
 * inspectExcel.js - Inspect the first N sheets of a workbook to understand structure
 * Usage: node scripts/inspectExcel.js <filename.xlsx> [numSheets=10]
 */
const XLSX = require("xlsx");
const path = require("path");

const filePath = process.argv[2];
const numSheets = parseInt(process.argv[3] || "10");

if (!filePath) {
  console.error("Usage: node scripts/inspectExcel.js <filename.xlsx> [numSheets=10]");
  process.exit(1);
}

const absPath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
console.log(`\nInspecting: ${absPath}`);
console.log(`Showing first ${numSheets} sheets\n`);

// Use lazy loading - only read sheet names first
const wb = XLSX.readFile(absPath, { bookSheets: true });
console.log(`Total sheets: ${wb.SheetNames.length}`);
console.log(`First sheet names:`, wb.SheetNames.slice(0, numSheets));

// Now read full workbook but only process first N sheets
const wbFull = XLSX.readFile(absPath, { sheetStubs: false });

for (let i = 0; i < Math.min(numSheets, wbFull.SheetNames.length); i++) {
  const sheetName = wbFull.SheetNames[i];
  const sheet = wbFull.Sheets[sheetName];
  
  const cells = {};
  for (const key of Object.keys(sheet)) {
    if (!key.startsWith("!")) cells[key] = sheet[key];
  }
  
  const cellCount = Object.keys(cells).length;
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Sheet [${i}]: "${sheetName}" (${cellCount} cells)`);
  
  if (cellCount === 0) {
    console.log("  (empty)");
    continue;
  }
  
  // Show first cell (A1) raw value
  if (cells["A1"]) {
    const v = cells["A1"].v;
    const w = cells["A1"].w;
    const t = cells["A1"].t;
    console.log(`  A1 type="${t}" raw_value="${String(v).substring(0, 200)}"`);
    if (w) console.log(`  A1 formatted="${String(w).substring(0, 200)}"`);
  }
  
  // Show data as 2D array (first 5 rows)
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  console.log(`  Rows: ${data.length}`);
  for (let r = 0; r < Math.min(5, data.length); r++) {
    const row = data[r];
    const preview = row ? row.slice(0, 8).map(c => 
      c == null ? "null" : String(c).replace(/\n/g, "\\n").substring(0, 40)
    ) : [];
    console.log(`  Row[${r}]: ${JSON.stringify(preview)}`);
  }
}
