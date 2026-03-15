const express = require("express");
const router = express.Router();
const {
  createEntry,
  getEntries,
  analyzeEntry,
  analyzeStream,
  getInsights,
} = require("../controllers/journalController");
const { llmLimiter } = require("../middleware/rateLimiter");


// POST /api/journal — Create a new journal entry
router.post("/", createEntry);

// POST /api/journal/analyze — LLM emotion analysis (with caching)
router.post("/analyze", llmLimiter, analyzeEntry);

// POST /api/journal/analyze/stream — Streaming LLM analysis (Bonus)
router.post("/analyze/stream", llmLimiter, analyzeStream);

// GET /api/journal/insights/:userId — Get aggregated insights
router.get("/insights/:userId", getInsights);

// GET /api/journal/:userId — Get all entries for a user
router.get("/:userId", getEntries);

module.exports = router;
