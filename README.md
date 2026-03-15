# 🌿 ArvyaX AI-Assisted Journal System

An AI-powered wellness journal for nature immersion sessions. Users write journal entries after forest, ocean, or mountain sessions — the system analyzes emotions using Google Gemini LLM and shows mental wellness insights over time.

---

## 📋 Features

- ✅ Create journal entries with ambience (forest / ocean / mountain)
- ✅ LLM emotion analysis via Google Gemini 1.5 Flash
- ✅ Aggregated insights (top emotion, most-used ambience, keywords)
- ✅ Analysis caching via MD5 hash (avoids redundant LLM calls)
- ✅ Rate limiting on API and LLM endpoints
- ✅ Streaming LLM response (bonus)
- ✅ Docker setup (bonus)

---

## 🛠️ Tech Stack

| Layer     | Technology               |
|-----------|--------------------------|
| Backend   | Node.js + Express        |
| Database  | MongoDB + Mongoose       |
| LLM       | NVIDIA NIM — meta/llama-3.1-8b-instruct |
| Frontend  | React + Vite             |
| Container | Docker + Docker Compose  |

---

## 🚀 Quick Start (Local — No Docker)

### Prerequisites
- Node.js v18+
- MongoDB running locally (`mongodb://localhost:27017`)
- Google Gemini API key — get free at [aistudio.google.com](https://aistudio.google.com)

### 1. Clone the repository
```bash
git clone https://github.com/your-username/arvyax-journal.git
cd arvyax-journal
```

### 2. Setup Backend
```bash
cd backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env and add your NVIDIA NIM API key
# NVIDIA_API_KEY=nvapi-xxxxxxxxxxxxxxxxxxxx
# MONGODB_URI=mongodb://localhost:27017/arvyax_journal

# Start backend
npm run dev
# Server runs on http://localhost:5000
```

### 3. Setup Frontend
```bash
# Open a new terminal
cd frontend

# Install dependencies
npm install

# Start frontend
npm run dev
# App runs on http://localhost:5173
```

### 4. Open the app
Visit [http://localhost:5173](http://localhost:5173)

---

## 🐳 Quick Start (Docker)

```bash
# Clone repo
git clone https://github.com/your-username/arvyax-journal.git
cd arvyax-journal

# Create .env file in root with your Gemini key
echo "GEMINI_API_KEY=your_gemini_api_key_here" > .env

# Start all services (MongoDB + Backend + Frontend)
docker-compose up --build

# App:      http://localhost:5173
# API:      http://localhost:5000
# MongoDB:  localhost:27017
```

---

## 📡 API Reference

### POST `/api/journal`
Create a new journal entry.

**Request:**
```json
{
  "userId": "123",
  "ambience": "forest",
  "text": "I felt calm today after listening to the rain."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Journal entry created successfully",
  "data": {
    "_id": "...",
    "userId": "123",
    "ambience": "forest",
    "text": "I felt calm today...",
    "analyzed": false,
    "createdAt": "2025-01-01T10:00:00.000Z"
  }
}
```

---

### GET `/api/journal/:userId`
Get all journal entries for a user.

**Response:**
```json
{
  "success": true,
  "count": 3,
  "data": [ ...entries ]
}
```

---

### POST `/api/journal/analyze`
Analyze emotion from text using Gemini LLM.
Results are cached — identical text won't call the LLM twice.

**Request:**
```json
{
  "text": "I felt calm today after listening to the rain",
  "entryId": "optional_mongo_id_to_update_entry"
}
```

**Response:**
```json
{
  "success": true,
  "cached": false,
  "data": {
    "emotion": "calm",
    "keywords": ["rain", "nature", "peace"],
    "summary": "User experienced relaxation during the forest session"
  }
}
```

---

### GET `/api/journal/insights/:userId`
Get aggregated mental wellness insights using MongoDB aggregation pipeline.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalEntries": 8,
    "topEmotion": "calm",
    "mostUsedAmbience": "forest",
    "recentKeywords": ["focus", "nature", "rain"],
    "emotionBreakdown": [
      { "emotion": "calm", "count": 5 },
      { "emotion": "happy", "count": 2 }
    ],
    "ambienceBreakdown": [
      { "ambience": "forest", "count": 5 },
      { "ambience": "ocean", "count": 3 }
    ]
  }
}
```

---

### POST `/api/journal/analyze/stream` (Bonus)
Streaming LLM analysis via Server-Sent Events (SSE).

**Request:**
```json
{ "text": "I felt calm today after listening to the rain" }
```

**Response:** SSE stream of `data: {"chunk": "..."}` events, ending with `data: {"done": true}`

---

## 🔧 Environment Variables

| Variable | Description | Default |
|---|---|---|
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/arvyax_journal` |
| `NVIDIA_API_KEY` | NVIDIA NIM API key (required) | — |
| `PORT` | Backend server port | `5000` |
| `NODE_ENV` | Environment | `development` |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window in ms | `60000` |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | `30` |

---

## 📁 Project Structure

```
arvyax-journal/
├── backend/
│   ├── src/
│   │   ├── config/db.js              # MongoDB connection
│   │   ├── models/Journal.js         # Mongoose schema
│   │   ├── routes/journal.js         # Route definitions
│   │   ├── controllers/
│   │   │   └── journalController.js  # Business logic
│   │   ├── services/
│   │   │   └── llmService.js         # Gemini LLM abstraction
│   │   ├── middleware/
│   │   │   └── rateLimiter.js        # Rate limiting
│   │   └── app.js                    # Express entry point
│   ├── .env.example
│   ├── Dockerfile
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── api/journalApi.js         # Axios API calls
│   │   ├── components/
│   │   │   ├── JournalForm.jsx       # Write new entry
│   │   │   ├── EntryList.jsx         # View entries + analyze
│   │   │   └── InsightsPanel.jsx     # Insights dashboard
│   │   ├── App.jsx                   # Root component
│   │   └── index.css                 # Styles
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
│
├── docker-compose.yml
├── README.md
└── ARCHITECTURE.md
```

---

## ⚡ Rate Limits

| Endpoint | Limit |
|---|---|
| All API routes | 30 requests / minute |
| `/api/journal/analyze` | 10 requests / minute |
| `/api/journal/analyze/stream` | 10 requests / minute |

---

## 🔑 Getting a Free NVIDIA NIM API Key

1. Go to [https://build.nvidia.com](https://build.nvidia.com)
2. Click **Login** → sign up with email or Google
3. Click any model (e.g. llama-3.1-8b-instruct) → click **"Get API Key"**
4. Copy the key — it starts with `nvapi-...`
5. Paste into `.env` as `NVIDIA_API_KEY`

**Free tier:** 1,000 inference credits on signup — more than enough for development and demo.

---

## Health Check

```bash
curl http://localhost:5000/health
# { "status": "ok", "message": "ArvyaX Journal API is running" }
```