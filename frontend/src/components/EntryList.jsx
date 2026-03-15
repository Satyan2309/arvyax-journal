import { useState } from "react";
import { analyzeText } from "../api/journalApi";

const AMBIENCE_ICONS = { forest: "🌲", ocean: "🌊", mountain: "⛰️" };

export default function EntryList({ entries, onAnalyzed }) {
  const [analyzingId, setAnalyzingId] = useState(null);
  const [error, setError] = useState(null);

  const handleAnalyze = async (entry) => {
    setAnalyzingId(entry._id);
    setError(null);

    try {
      const res = await analyzeText(entry.text, entry._id);
      const result = res.data.data;
      // Notify parent to refresh entries with updated analysis
      onAnalyzed(entry._id, result, res.data.cached);
    } catch (err) {
      setError(err.response?.data?.error || "Analysis failed");
    } finally {
      setAnalyzingId(null);
    }
  };

  if (!entries.length) {
    return (
      <div className="card">
        <h2>📖 Your Entries</h2>
        <p className="empty-state">No entries yet. Write your first journal entry above!</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h2> Your Entries ({entries.length})</h2>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="entries-list">
        {entries.map((entry) => (
          <div key={entry._id} className="entry-item">
            <div className="entry-header">
              <span className="ambience-tag">
                {AMBIENCE_ICONS[entry.ambience]} {entry.ambience}
              </span>
              <span className="entry-date">
                {new Date(entry.createdAt).toLocaleDateString("en-IN", {
                  day: "numeric", month: "short", year: "numeric",
                  hour: "2-digit", minute: "2-digit",
                })}
              </span>
            </div>

            <p className="entry-text">{entry.text}</p>

            {/* Show analysis results if already analyzed */}
            {entry.analyzed && (
              <div className="analysis-result">
                <div className="analysis-row">
                  <span className="label">Emotion:</span>
                  <span className="emotion-badge">{entry.emotion}</span>
                </div>
                <div className="analysis-row">
                  <span className="label">Keywords:</span>
                  <div className="keywords">
                    {entry.keywords.map((k) => (
                      <span key={k} className="keyword-tag">{k}</span>
                    ))}
                  </div>
                </div>
                <div className="analysis-row">
                  <span className="label">Summary:</span>
                  <span className="summary-text">{entry.summary}</span>
                </div>
              </div>
            )}

            {/* Analyze button */}
            {!entry.analyzed && (
              <button
                className="btn-analyze"
                onClick={() => handleAnalyze(entry)}
                disabled={analyzingId === entry._id}
              >
                {analyzingId === entry._id ? " Analyzing..." : " Analyze"}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
