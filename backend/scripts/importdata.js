const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (e) {
  console.warn('Failed to set custom DNS servers:', e.message);
}
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");

const Cutoff = require('../model/cutoff');
const { isValidCategory } = require('../utils/category');

// ─── Helper: load JSON if file exists, otherwise return [] ────────────────────
function loadJSON(filename) {
  const filePath = path.join(__dirname, '..', filename);
  if (!fs.existsSync(filePath)) {
    console.warn(`  [WARN] File not found, skipping: ${filename}`);
    return [];
  }
  return require(filePath);
}

// ─── 2023-24 rounds ───────────────────────────────────────────────────────────
const round2023_1 = loadJSON('cutoffs2023_round1.json');
const round2023_2 = loadJSON('cutoffs2023_round2.json');
const round2023_3 = loadJSON('cutoffs2023_round3.json');

// ─── 2024-25 rounds ───────────────────────────────────────────────────────────
const round2024_1 = loadJSON('cutoffs2024_round1.json');
const round2024_2 = loadJSON('cutoffs2024_round2.json');
const round2024_3 = loadJSON('cutoffs2024_round3.json');

// ─── 2025-26 rounds ───────────────────────────────────────────────────────────
const round2025_1 = loadJSON('cutoffs2025_round1.json');
const round2025_2 = loadJSON('cutoffs2025_round2.json');
const round2025_3 = loadJSON('cutoffs2025_round3.json');
const round2025_4 = loadJSON('cutoffs2025_round4.json');

async function importData() {

  await mongoose.connect(
    "mongodb://localhost:27017/PolyMitra"
  );

  await Cutoff.deleteMany({});

  const allData = [
    // 2023-24 data
    ...round2023_1,
    ...round2023_2,
    ...round2023_3,
    // 2024-25 data
    ...round2024_1,
    ...round2024_2,
    ...round2024_3,
    // 2025-26 data
    ...round2025_1,
    ...round2025_2,
    ...round2025_3,
    ...round2025_4,
  ];

  // Filter out records missing required fields to avoid validation errors
  const validData = [];
  const invalid = [];

  for (const rec of allData) {
    if (
      rec.collegeName &&
      rec.branchName &&
      rec.collegeCode &&
      rec.branchCode &&
      rec.category &&
      isValidCategory(rec.category)
    ) {
      validData.push(rec);
    } else {
      invalid.push(rec);
    }
  }

  if (invalid.length) {
    console.log(`Skipping ${invalid.length} invalid records (missing required fields).`);
    fs.writeFileSync(
      path.join(__dirname, '..', 'invalid_cutoff_records.json'),
      JSON.stringify(invalid, null, 2)
    );
    console.log('Wrote invalid records to invalid_cutoff_records.json');
  }

  const count2023 = round2023_1.length + round2023_2.length + round2023_3.length;
  const count2024 = round2024_1.length + round2024_2.length + round2024_3.length;
  const count2025 = round2025_1.length + round2025_2.length + round2025_3.length + round2025_4.length;

  console.log(`Total valid records to import: ${validData.length}`);
  console.log(`  2023-24: ${count2023} records`);
  console.log(`  2024-25: ${count2024} records`);
  console.log(`  2025-26: ${count2025} records (rounds 1-4)`);

  try {
    // Insert in batches of 10,000 to avoid memory issues with large datasets
    const BATCH_SIZE = 10000;
    let inserted = 0;
    for (let i = 0; i < validData.length; i += BATCH_SIZE) {
      const batch = validData.slice(i, i + BATCH_SIZE);
      await Cutoff.insertMany(batch, { ordered: false });
      inserted += batch.length;
      console.log(`  Inserted ${inserted}/${validData.length} records...`);
    }
    console.log(`✅ ${validData.length} records imported successfully.`);
  } catch (err) {
    console.error('Error inserting documents:', err);
  }

  process.exit();
}

importData();