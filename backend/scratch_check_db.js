const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/PolyMitra').then(async () => {
  const Cutoff = require('./model/cutoff');
  
  const cats = await Cutoff.distinct('category');
  const lCats = cats.filter(c => c.startsWith('L'));
  const gCats = cats.filter(c => c.startsWith('G'));
  
  console.log('Total unique categories in DB:', cats.length);
  console.log('Categories starting with L count:', lCats.length, 'Sample:', lCats.slice(0, 10));
  console.log('Categories starting with G count:', gCats.length, 'Sample:', gCats.slice(0, 10));

  process.exit();
});
