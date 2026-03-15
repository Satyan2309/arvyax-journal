const OpenAI = require("openai");

// ── Initialize NVIDIA NIM Client ─────────────────────────────────────
// OpenAI-compatible API — just different baseURL and API key
const client = new OpenAI({
  baseURL: "https://integrate.api.nvidia.com/v1",
  apiKey: process.env.NVIDIA_API_KEY,
});

const MODEL = "meta/llama-3.1-8b-instruct";

// ─────────────────────────────────────────────────────────────────────
// analyzeEmotion
// Calls NVIDIA NIM (Llama 3.1 8B) to extract emotion, keywords, summary
// Returns a clean parsed JSON object
// ─────────────────────────────────────────────────────────────────────
const analyzeEmotion = async (text) => {
  try {
    const completion = await client.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are a mental wellness assistant analyzing journal entries from nature immersion sessions. " +
            "You ALWAYS respond with valid JSON only — no explanation, no markdown, no extra text whatsoever.",
        },
        {
          role: "user",
          content: `Analyze the emotion in this journal entry and return ONLY a JSON object.

Journal Entry: "${text}"

Return exactly this structure:
{
  "emotion": "single dominant emotion word (e.g. calm, anxious, happy, peaceful, stressed, joyful)",
  "keywords": ["3 to 5 most relevant keywords from the text"],
  "summary": "One concise sentence summarizing the user mental state"
}`,
        },
      ],
      temperature: 0.2,
      top_p: 0.7,
      max_tokens: 300,
      stream: false,
    });

    const raw = completion.choices[0].message.content.trim();

    // Strip markdown fences if model wraps in ```json ... ```
    const cleaned = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```$/i, "")
      .trim();

    const parsed = JSON.parse(cleaned);

    // Validate all required fields exist
    if (!parsed.emotion || !Array.isArray(parsed.keywords) || !parsed.summary) {
      throw new Error("Incomplete LLM response — missing required fields");
    }

    return {
      emotion: parsed.emotion.toLowerCase().trim(),
      keywords: parsed.keywords.map((k) => k.toLowerCase().trim()),
      summary: parsed.summary.trim(),
    };
  } catch (error) {
    console.error("❌ LLM Analysis Error:", error.message);
    throw new Error(`LLM analysis failed: ${error.message}`);
  }
};

// ─────────────────────────────────────────────────────────────────────
// analyzeEmotionStream (Bonus Feature)
// Streams a warm narrative analysis via Server-Sent Events (SSE)
// Uses Llama's native streaming — exact same pattern as user's code
// ─────────────────────────────────────────────────────────────────────
const analyzeEmotionStream = async (text, res) => {
  try {
    // Set SSE headers before streaming starts
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.flushHeaders();

    const completion = await client.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "system",
          content: "You are a compassionate mental wellness assistant.",
        },
        {
          role: "user",
          content: `Analyze this nature immersion journal entry and give a warm, insightful response in 2-3 sentences:
1. The dominant emotion felt
2. How the nature elements contributed
3. A positive observation about their mental state

Journal Entry: "${text}"`,
        },
      ],
      temperature: 0.6,
      top_p: 0.7,
      max_tokens: 300,
      stream: true,
    });

    // Stream each chunk to the client via SSE
    for await (const chunk of completion) {
      const content = chunk.choices?.[0]?.delta?.content;
      if (content != null) {
        res.write(`data: ${JSON.stringify({ chunk: content })}\n\n`);
      }
    }

    // Signal end of stream
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (error) {
    console.error("❌ Streaming Error:", error.message);
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
};

module.exports = { analyzeEmotion, analyzeEmotionStream };