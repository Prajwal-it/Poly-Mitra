const mongoose = require('mongoose');

const connectDB = async () => {
  // NOTE: provide a database name; connect with `/` only can cause unexpected behavior.
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/PolyMitra';

  mongoose.set('strictQuery', false);

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
    });
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    throw err;
  }
};

module.exports = connectDB;
