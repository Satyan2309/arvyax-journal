import { useState } from "react";
import { createEntry } from "../api/journalApi";

const AMBIENCES = ["forest", "ocean", "mountain"];

export default function JournalForm({ userId, onEntryCreated }) {
  const [ambience, setAmbience] = useState("forest");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;

    setLoading(true);
    setMessage(null);

    try {
      await createEntry(userId, ambience, text.trim());
      setText("");
      setMessage({ type: "success", text: "Entry saved successfully!" });
      onEntryCreated(); // refresh entries list
    } catch (err) {
      setMessage({
        type: "error",
        text: err.response?.data?.error || "Failed to save entry",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h2>📝 New Journal Entry</h2>

      <div className="form-group">
        <label>Ambience</label>
        <div className="ambience-buttons">
          {AMBIENCES.map((a) => (
            <button
              key={a}
              type="button"
              className={`ambience-btn ${ambience === a ? "active" : ""}`}
              onClick={() => setAmbience(a)}
            >
              {a === "forest" ? "🌲" : a === "ocean" ? "🌊" : "⛰️"} {a}
            </button>
          ))}
        </div>
      </div>

      <div className="form-group">
        <label>How are you feeling?</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Describe your experience during this session..."
          rows={4}
          disabled={loading}
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={loading || !text.trim()}
        className="btn-primary"
      >
        {loading ? "Saving..." : "Save Entry"}
      </button>

      {message && (
        <div className={`alert alert-${message.type}`}>{message.text}</div>
      )}
    </div>
  );
}
