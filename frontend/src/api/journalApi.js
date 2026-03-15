import axios from "axios";


const BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : "/api";

const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
});


// Create a new journal entry
export const createEntry = (userId, ambience, text) =>
  api.post("/journal", { userId, ambience, text });

// Get all entries for a user
export const getEntries = (userId) => api.get(`/journal/${userId}`);

// Analyze text with LLM (entryId optional — updates DB if provided)
export const analyzeText = (text, entryId = null) =>
  api.post("/journal/analyze", { text, entryId });

// Get insights for a user
export const getInsights = (userId) => api.get(`/journal/insights/${userId}`);

export default api;