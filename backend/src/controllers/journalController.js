const crypto = require("crypto");
const Journal = require("../models/Journal");
const { analyzeEmotion, analyzeEmotionStream } = require("../services/llmService");

// Helper: generate MD5 hash of text for cache lookup
const hashText = (text) =>
  crypto.createHash("md5").update(text.trim().toLowerCase()).digest("hex");

// ─────────────────────────────────────────────
// POST /api/journal
// Create a new journal entry
// ─────────────────────────────────────────────
const createEntry = async (req, res) => {
  try {
    const { userId, ambience, text } = req.body;

    if (!userId || !ambience || !text) {
      return res.status(400).json({
        success: false,
        error: "userId, ambience, and text are required",
      });
    }

    const entry = await Journal.create({
      userId,
      ambience,
      text,
      analysisHash: hashText(text),
    });

    res.status(201).json({
      success: true,
      message: "Journal entry created successfully",
      data: entry,
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, error: messages.join(", ") });
    }
    res.status(500).json({ success: false, error: "Server error: " + error.message });
  }
};

// ─────────────────────────────────────────────
// GET /api/journal/:userId
// Get all journal entries for a user
// ─────────────────────────────────────────────
const getEntries = async (req, res) => {
  try {
    const { userId } = req.params;

    const entries = await Journal.find({ userId })
      .sort({ createdAt: -1 }) // newest first
      .select("-__v"); // hide mongoose version key

    res.status(200).json({
      success: true,
      count: entries.length,
      data: entries,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: "Server error: " + error.message });
  }
};

// ─────────────────────────────────────────────
// POST /api/journal/analyze
// Analyze emotion from text using LLM (with caching)
// ─────────────────────────────────────────────
const analyzeEntry = async (req, res) => {
  try {
    const { text, entryId } = req.body;

    if (!text) {
      return res.status(400).json({ success: false, error: "text is required" });
    }

    const hash = hashText(text);

    // ── CACHE CHECK ──────────────────────────────────────────
    // Before calling LLM, check if we already analyzed identical text
    const cached = await Journal.findOne({
      analysisHash: hash,
      analyzed: true,
    }).select("emotion keywords summary");

    if (cached) {
      console.log("✅ Cache HIT — skipping LLM call");
      const result = {
        emotion: cached.emotion,
        keywords: cached.keywords,
        summary: cached.summary,
      };

      // If entryId provided, update that entry with cached result
      if (entryId) {
        await Journal.findByIdAndUpdate(entryId, {
          ...result,
          analyzed: true,
          analysisHash: hash,
        });
      }

      return res.status(200).json({
        success: true,
        cached: true,
        data: result,
      });
    }
    // ── END CACHE CHECK ───────────────────────────────────────

    console.log("🤖 Cache MISS — calling NVIDIA NIM LLM");
    const result = await analyzeEmotion(text);

    // If entryId provided, update that journal entry with the analysis
    if (entryId) {
      await Journal.findByIdAndUpdate(entryId, {
        ...result,
        analyzed: true,
        analysisHash: hash,
      });
    }

    res.status(200).json({
      success: true,
      cached: false,
      data: result,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ─────────────────────────────────────────────
// POST /api/journal/analyze/stream
// Streaming LLM analysis (Bonus)
// ─────────────────────────────────────────────
const analyzeStream = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ success: false, error: "text is required" });
    }
    await analyzeEmotionStream(text, res);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ─────────────────────────────────────────────
// GET /api/journal/insights/:userId
// Aggregated mental wellness insights
// ─────────────────────────────────────────────
const getInsights = async (req, res) => {
  try {
    const { userId } = req.params;

    // ── 1. Total entries ─────────────────────────────────────
    const totalEntries = await Journal.countDocuments({ userId });

    if (totalEntries === 0) {
      return res.status(200).json({
        success: true,
        data: {
          totalEntries: 0,
          topEmotion: null,
          mostUsedAmbience: null,
          recentKeywords: [],
          emotionBreakdown: [],
          ambienceBreakdown: [],
        },
      });
    }

    // ── 2. Top emotion (aggregation pipeline) ────────────────
    const topEmotionResult = await Journal.aggregate([
      { $match: { userId, analyzed: true } },
      { $group: { _id: "$emotion", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 },
    ]);

    // ── 3. Most used ambience ─────────────────────────────────
    const ambienceResult = await Journal.aggregate([
      { $match: { userId } },
      { $group: { _id: "$ambience", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 },
    ]);

    // ── 4. Recent keywords from latest 5 analyzed entries ────
    const keywordsResult = await Journal.aggregate([
      { $match: { userId, analyzed: true } },
      { $sort: { createdAt: -1 } },
      { $limit: 5 },
      { $unwind: "$keywords" },                         // flatten array
      { $group: { _id: "$keywords", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 8 },
      { $project: { keyword: "$_id", _id: 0 } },
    ]);

    // ── 5. Full emotion breakdown ─────────────────────────────
    const emotionBreakdown = await Journal.aggregate([
      { $match: { userId, analyzed: true } },
      { $group: { _id: "$emotion", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $project: { emotion: "$_id", count: 1, _id: 0 } },
    ]);

    // ── 6. Ambience breakdown ─────────────────────────────────
    const ambienceBreakdown = await Journal.aggregate([
      { $match: { userId } },
      { $group: { _id: "$ambience", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $project: { ambience: "$_id", count: 1, _id: 0 } },
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalEntries,
        topEmotion: topEmotionResult[0]?._id || null,
        mostUsedAmbience: ambienceResult[0]?._id || null,
        recentKeywords: keywordsResult.map((k) => k.keyword),
        emotionBreakdown,
        ambienceBreakdown,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: "Server error: " + error.message });
  }
};

module.exports = {
  createEntry,
  getEntries,
  analyzeEntry,
  analyzeStream,
  getInsights,
};