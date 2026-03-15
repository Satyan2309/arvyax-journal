# ArvyaX Journal — Architecture Document

## System Overview

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT (React)                        │
│  JournalForm  │  EntryList  │  InsightsPanel             │
└───────────────────────┬─────────────────────────────────┘
                        │ HTTP / SSE
┌───────────────────────▼─────────────────────────────────┐
│              BACKEND (Node.js + Express)                 │
│                                                          │
│  POST /api/journal          → createEntry()              │
│  GET  /api/journal/:userId  → getEntries()               │
│  POST /api/journal/analyze  → analyzeEntry() [+ cache]   │
│  GET  /api/journal/insights → getInsights()  [pipeline]  │
│                                                          │
│  Middleware: CORS │ Rate Limiter │ Error Handler          │
└──────┬──────────────────────────────────┬───────────────┘
       │                                  │
┌──────▼──────────┐              ┌────────▼───────────────┐
│    MongoDB      │              │     NVIDIA NIM API     │
│                 │              │ (llama-3.1-8b-instruct)│
│  journals       │              │                        │
│  collection     │              │  Prompt → JSON out     │
│  (indexed)      │              │  Streaming supported   │
└─────────────────┘              └────────────────────────┘
```

---

## Data Model

```js
// journals collection
{
  _id:           ObjectId,
  userId:        String,     // indexed
  ambience:      String,     // "forest" | "ocean" | "mountain"
  text:          String,     // raw journal text
  emotion:       String,     // LLM result — null until analyzed
  keywords:     [String],    // LLM result — [] until analyzed
  summary:       String,     // LLM result — null until analyzed
  analyzed:      Boolean,    // false → not yet sent to LLM
  analysisHash:  String,     // MD5(text) — used for cache lookup
  createdAt:     Date,       // auto
  updatedAt:     Date        // auto
}

// Indexes
{ userId: 1 }                      // fast per-user queries
{ analysisHash: 1 }                // fast cache lookups
{ userId: 1, createdAt: -1 }       // sorted user feed
{ userId: 1, analyzed: 1 }         // insights filter
```

---

## Question 1: How Would You Scale This to 100,000 Users?

### Current bottlenecks at scale
- Single Node.js process handles all requests
- Single MongoDB instance — no replication
- No load balancing
- LLM calls are synchronous per request

### Scaling Strategy

**Horizontal Scaling — Application Layer**

Run multiple instances of the Node.js backend behind a load balancer.
Node.js is stateless by design, so scaling out is straightforward.

```
                    ┌──────────────┐
         ┌──────────│ Load Balancer│──────────┐
         │          │  (Nginx/ALB) │          │
         │          └──────────────┘          │
  ┌──────▼──────┐                    ┌────────▼────┐
  │  Backend #1 │                    │ Backend #2  │   ... #N
  └─────────────┘                    └─────────────┘
```

**Database Layer — MongoDB Atlas / Replica Set**

- Use MongoDB Atlas (managed) or deploy a 3-node replica set
- Primary node handles writes, secondaries handle reads
- Add read preference `secondaryPreferred` for GET endpoints
- Shard by `userId` once data exceeds single-node capacity

```
  Write ──→ Primary ──→ Secondary 1
                    └──→ Secondary 2
  Read  ──→ Secondary 1 / 2 (round robin)
```

**Queue LLM Calls — Bull + Redis**

At 100k users, synchronous LLM calls will bottleneck the API.
Move analysis to a background job queue:

```
POST /analyze → Push job to Redis Queue → Return job ID (202 Accepted)
                         ↓
                  Worker processes LLM
                         ↓
                  MongoDB updated with results
                         ↓
                  Client polls GET /journal/:userId
                  or WebSocket notifies client
```

**Infrastructure Summary for 100k Users**

| Component | Solution |
|---|---|
| App servers | 3–5 Node.js instances behind ALB |
| Database | MongoDB Atlas M30+ cluster (replica set) |
| Cache | Redis (ElastiCache) for analysis results |
| LLM Queue | Bull queue with 5–10 worker processes |
| CDN | CloudFront for frontend static assets |
| Monitoring | Datadog / CloudWatch for latency, error rates |

---

## Question 2: How Would You Reduce LLM Cost?

LLM calls are the most expensive operation in this system. There are four strategies to reduce cost:

**Strategy 1 — Aggressive Caching (already implemented)**

Before every LLM call, compute `MD5(text)` and check if an identical analysis exists in MongoDB. If yes, return cached result — zero LLM cost.

This is particularly effective because users often repeat similar emotional phrases ("felt calm", "felt relaxed") across sessions.

```
Estimated cache hit rate: 20–40% in practice
Cost reduction: 20–40% fewer API calls
```

**Strategy 2 — Choose a Smaller, Cheaper Model**

`meta/llama-3.1-8b-instruct` via NVIDIA NIM is already a highly efficient model for structured extraction tasks like emotion detection. It performs as well as much larger models at a fraction of the cost.

Alternative free/cheap options if costs grow:
- Groq + Llama 3.1 8B (free tier, very fast)
- Together AI + Mistral 7B
- Self-host Ollama (zero cost, requires GPU server)

**Strategy 3 — Batch Processing**

Instead of calling the LLM immediately when a user clicks Analyze, accumulate entries and process them in batches during off-peak hours.

```
Midnight cron job:
  - Find all entries where analyzed = false
  - Group into batches of 20
  - Process each batch → update MongoDB
```

This reduces per-call overhead and allows use of batch APIs if available.

**Strategy 4 — Reduce Token Count**

The current prompt sends the full journal text. For very long entries, truncate to first 500 characters before sending — emotional content is typically front-loaded in journal writing.

```js
const truncatedText = text.slice(0, 500);
// Reduces avg prompt tokens by ~60% for long entries
```

---

## Question 3: How Would You Cache Repeated Analysis?

Caching is already implemented in the current system. Here is the full strategy:

**Layer 1 — MongoDB Hash Cache (implemented)**

Every journal entry stores `analysisHash = MD5(text.trim().toLowerCase())`.

Before calling the LLM, the system queries:
```js
const cached = await Journal.findOne({
  analysisHash: hash,
  analyzed: true
});
```

If a match is found, the cached `emotion`, `keywords`, and `summary` are returned immediately — no LLM call made.

**How it works end-to-end:**

```
User submits: "I felt calm after the rain"
    ↓
Compute: MD5("i felt calm after the rain") = "a3f9..."
    ↓
Query MongoDB: { analysisHash: "a3f9...", analyzed: true }
    ↓
  FOUND? → Return cached result (0ms LLM latency, $0 cost)
NOT FOUND? → Call NVIDIA NIM → Store result → Return to user
```

**Layer 2 — Redis Cache (production recommendation)**

For production at scale, add Redis as an in-memory cache layer in front of MongoDB:

```js
// Check Redis first (sub-millisecond)
const redisKey = `analysis:${hash}`;
const redisHit = await redis.get(redisKey);
if (redisHit) return JSON.parse(redisHit);

// Check MongoDB second
const mongoHit = await Journal.findOne({ analysisHash: hash, analyzed: true });
if (mongoHit) {
  await redis.setex(redisKey, 86400, JSON.stringify(result)); // 24hr TTL
  return result;
}

// Call LLM as last resort
const result = await analyzeEmotion(text);
await redis.setex(redisKey, 86400, JSON.stringify(result));
return result;
```

**Cache Hierarchy:**

```
Request
  → Redis (< 1ms)        ── HIT → return immediately
  → MongoDB (5ms)        ── HIT → populate Redis, return
  → NVIDIA NIM (1–3s)    → populate both, return
```

---

## Question 4: How Would You Protect Sensitive Journal Data?

Journal entries contain personal mental health information — this is sensitive data requiring multiple layers of protection.

**1 — Encryption at Rest**

Enable MongoDB Encrypted Storage Engine (available in MongoDB Atlas with all paid tiers). This encrypts all data files on disk — if a server is compromised, raw disk access reveals nothing.

For field-level sensitivity, encrypt the `text` field before storing:

```js
const crypto = require("crypto");
const ENCRYPTION_KEY = process.env.DATA_ENCRYPTION_KEY; // 32-byte key

const encryptText = (plaintext) => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
  return iv.toString("hex") + ":" + cipher.update(plaintext, "utf8", "hex") + cipher.final("hex");
};

const decryptText = (ciphertext) => {
  const [iv, encrypted] = ciphertext.split(":");
  const decipher = crypto.createDecipheriv("aes-256-cbc", ENCRYPTION_KEY, Buffer.from(iv, "hex"));
  return decipher.update(encrypted, "hex", "utf8") + decipher.final("utf8");
};
```

**2 — Encryption in Transit**

All traffic must use HTTPS/TLS. In production:
- Issue SSL certificate via Let's Encrypt (free) or AWS ACM
- Enforce HTTPS redirect at Nginx/load balancer level
- Set `Strict-Transport-Security` header

**3 — Authentication & Authorization**

Currently the system uses a plain `userId` string — this must be replaced with proper auth:

```
Recommended: JWT Authentication
  1. User logs in → server issues signed JWT
  2. Every request sends JWT in Authorization header
  3. Backend middleware verifies JWT before processing
  4. userId is extracted FROM the verified token — not from request body
```

This prevents a user from querying another user's entries by changing the userId.

**4 — Data Minimization**

Do not send the full journal text to the LLM API — truncate to 500 characters. Raw personal data leaving the system boundary should be minimized.

Consider NVIDIA NIM's enterprise deployment options for data residency compliance if serving users in regulated regions (e.g. EU/GDPR).

**5 — Rate Limiting & Abuse Prevention**

Already implemented via `express-rate-limit`. Prevents brute-force enumeration of userId values.

**6 — GDPR / Right to Erasure**

Implement a `DELETE /api/journal/:userId` endpoint that permanently removes all entries for a user — required for GDPR compliance.

```js
router.delete("/:userId", async (req, res) => {
  await Journal.deleteMany({ userId: req.params.userId });
  res.json({ success: true, message: "All user data deleted" });
});
```

**Security Checklist Summary**

| Concern | Solution |
|---|---|
| Data at rest | MongoDB Encrypted Storage + field-level AES-256 |
| Data in transit | HTTPS/TLS with HSTS header |
| Access control | JWT authentication + userId from token |
| API abuse | Rate limiting (express-rate-limit) |
| LLM data leakage | Truncate text before sending to external API |
| User deletion | DELETE endpoint for GDPR right to erasure |
| Payload attacks | `express.json({ limit: "10kb" })` prevents large payload injection |

---

## Bonus Architecture Notes

**Streaming Implementation**

The `/analyze/stream` endpoint uses Server-Sent Events (SSE) with NVIDIA NIM's native streaming API (`stream: true` on the OpenAI-compatible client). The frontend connects with `EventSource` and renders chunks progressively as they arrive, giving a "typewriter" effect instead of waiting 2–3 seconds for the full response.

**LLM Abstraction Layer**

`llmService.js` is a pure abstraction — the rest of the codebase never imports the LLM client directly. The entire system uses the OpenAI-compatible interface, so switching from NVIDIA NIM to Groq, Together AI, or a self-hosted Ollama model requires changing only the `baseURL` and `apiKey` in this one file — zero changes elsewhere.