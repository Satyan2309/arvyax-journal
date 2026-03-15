require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const journalRoutes = require("./routes/journal");
const { apiLimiter } = require("./middleware/rateLimiter");

const app = express();


connectDB();

// ── Global Middleware ─────────────────────────────
app.use(cors({
  origin: [
    "http://localhost:5173",                        
    process.env.FRONTEND_URL,                       
  ].filter(Boolean),
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type"],
}));

app.use(express.json({ limit: "10kb" })); 
app.use(express.urlencoded({ extended: true }));

// ── Apply general rate limiter to all API routes ──
app.use("/api", apiLimiter);

// ── Routes ────────────────────────────────────────
app.use("/api/journal", journalRoutes);

// ── Health Check ──────────────────────────────────
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "ArvyaX Journal API is running",
    timestamp: new Date().toISOString(),
  });
});

// ── 404 Handler ───────────────────────────────────
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.originalUrl} not found`,
  });
});

// ── Global Error Handler ──────────────────────────
app.use((err, req, res, next) => {
  console.error("Unhandled Error:", err);
  res.status(500).json({
    success: false,
    error: "Internal server error",
  });
});

// ── Start Server ──────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📋 Environment: ${process.env.NODE_ENV || "development"}`);
});

module.exports = app;