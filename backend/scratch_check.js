const fs = require('fs');
const files = [
  'cutoffs2023_round1.json',
  'cutoffs2023_round2.json',
  'cutoffs2023_round3.json',
  'cutoffs2024_round1.json',
  'cutoffs2024_round2.json',
  'cutoffs2024_round3.json',
  'cutoffs2025_round1.json',
  'cutoffs2025_round2.json',
  'cutoffs2025_round3.json',
  'cutoffs2025_round4.json'
];

files.forEach(file => {
  if (fs.existsSync(file)) {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    const cats = [...new Set(data.map(r => r.category))];
    const lCats = cats.filter(c => c.startsWith('L'));
    const gCats = cats.filter(c => c.startsWith('G'));
    console.log(`${file} length: ${data.length}`);
    console.log(`  L cats count: ${lCats.length}, G cats count: ${gCats.length}`);
    console.log(`  Sample L:`, lCats.slice(0, 3));
    console.log(`  Sample G:`, gCats.slice(0, 3));
  } else {
    console.log(`${file} does not exist`);
  }
});
