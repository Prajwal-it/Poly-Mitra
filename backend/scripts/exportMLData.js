/**
 * scripts/exportMLData.js
 *
 * Exports all cutoff records from MongoDB (all years) to a training CSV.
 * Run this before retraining the ML model to include the latest data.
 *
 * Usage:
 *   node scripts/exportMLData.js
 *
 * Output:
 *   project/python backend/data/ml_training_data_updated.csv
 */

require('dotenv').config({ path: '../.env' });

const mongoose = require('mongoose');
const fs       = require('fs');
const path     = require('path');

const Cutoff   = require('../model/cutoff');

const OUTPUT_PATH = path.join(
  __dirname,
  '../project/python backend/data/ml_training_data_updated.csv'
);

const CSV_HEADER = 'year,round,collegeCode,collegeName,branchCode,branchName,category,rank,percentage';

async function exportData() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected.');

  // Count total records
  const total = await Cutoff.countDocuments({});
  console.log(`Total records in DB: ${total}`);

  // Fetch all records in batches to avoid memory issues
  const BATCH_SIZE = 5000;
  let skip = 0;
  let exported = 0;
  let dropped  = 0;

  // Write header
  const writeStream = fs.createWriteStream(OUTPUT_PATH, { encoding: 'utf8' });
  writeStream.write(CSV_HEADER + '\n');

  console.log(`Exporting to: ${OUTPUT_PATH}`);
  console.log(`Processing in batches of ${BATCH_SIZE}...`);

  while (skip < total) {
    const records = await Cutoff.find({})
      .skip(skip)
      .limit(BATCH_SIZE)
      .lean();

    for (const r of records) {
      // Drop records without a valid percentage target
      if (r.percentage === undefined || r.percentage === null || isNaN(r.percentage)) {
        dropped++;
        continue;
      }

      // Escape any commas/quotes in string fields
      const escape = (val) => {
        if (val === undefined || val === null) return '';
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const line = [
        r.year        ?? '',
        r.round       ?? '',
        escape(r.collegeCode),
        escape(r.collegeName),
        escape(r.branchCode),
        escape(r.branchName),
        escape(r.category),
        r.rank        ?? '',
        r.percentage  ?? '',
      ].join(',');

      writeStream.write(line + '\n');
      exported++;
    }

    skip += BATCH_SIZE;
    process.stdout.write(`  Progress: ${Math.min(skip, total)}/${total} records processed...\r`);
  }

  writeStream.end();

  await new Promise((resolve) => writeStream.on('finish', resolve));

  console.log(`\n\nExport complete.`);
  console.log(`  Exported : ${exported} records`);
  console.log(`  Dropped  : ${dropped} records (missing percentage)`);
  console.log(`  Output   : ${OUTPUT_PATH}`);
  console.log(`\nNext step: retrain the model`);
  console.log(`  cd "project/python backend"`);
  console.log(`  python train_model.py`);

  await mongoose.disconnect();
  process.exit(0);
}

exportData().catch((err) => {
  console.error('Export failed:', err);
  process.exit(1);
});
