require('dotenv').config({ path: '../.env' });
const express = require('express');
const cors = require('cors');
const app = express();

const connectDB = require('./config/db');
const cutoffRoutes = require('./routes/cutoffRoutes');
const predictRoutes = require('./routes/predictRoutes');

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Routes ─────────────────────────────────────────────────────────────────────
app.use('/api/cutoffs', cutoffRoutes);
app.use('/api/predict', predictRoutes);

// ── Health check ───────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Start server ───────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    const server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

    // ── Graceful shutdown ───────────────────────────────────────────────────
    const shutdown = (signal) => {
      console.log(`\n${signal} received — shutting down gracefully...`);
      server.close(() => {
        console.log('HTTP server closed.');
        process.exit(0);
      });
      // Force-exit after 10 s if connections hang
      setTimeout(() => process.exit(1), 10000).unref();
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT',  () => shutdown('SIGINT'));
  })
  .catch((err) => {
    console.error('Failed to start server due to DB connection error:', err);
    process.exit(1);
  });
