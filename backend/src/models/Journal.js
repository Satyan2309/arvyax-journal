const mongoose = require("mongoose");

const journalSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: [true, "userId is required"],
      index: true, // Index 
    },
    ambience: {
      type: String,
      required: [true, "ambience is required"],
      enum: {
        values: ["forest", "ocean", "mountain"],
        message: "ambience must be forest, ocean, or mountain",
      },
    },
    text: {
      type: String,
      required: [true, "Journal text is required"],
      minlength: [5, "Entry must be at least 5 characters"],
    },

    // --- LLM Analysis Results ---
    emotion: {
      type: String,
      default: null,
    },
    keywords: {
      type: [String],
      default: [],
    },
    summary: {
      type: String,
      default: null,
    },

    // --- Cache Control ---
    analyzed: {
      type: Boolean,
      default: false,
    },
    // MD5 hash of the text — used to detect duplicate analysis requests
    analysisHash: {
      type: String,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically
  }
);

// Compound index for efficient insight queries
journalSchema.index({ userId: 1, createdAt: -1 });
journalSchema.index({ userId: 1, analyzed: 1 });

module.exports = mongoose.model("Journal", journalSchema);
