import { useState, useEffect } from "react";
import { getInsights } from "../api/journalApi";

export default function InsightsPanel({ userId, refreshTrigger }) {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchInsights = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getInsights(userId);
      setInsights(res.data.data);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load insights");
    } finally {
      setLoading(false);
    }
  };

  // Refresh whenever entries change or analyses complete
  useEffect(() => {
    fetchInsights();
  }, [userId, refreshTrigger]);

  if (loading) return <div className="card"><p>Loading insights...</p></div>;
  if (error) return <div className="card"><div className="alert alert-error">{error}</div></div>;
  if (!insights) return null;

  if (insights.totalEntries === 0) {
    return (
      <div className="card">
        <h2>📊 Your Insights</h2>
        <p className="empty-state">Complete some sessions and analyze entries to see insights!</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h2>📊 Your Insights</h2>

      {/* Summary Stats */}
      <div className="stats-grid">
        <div className="stat-box">
          <div className="stat-value">{insights.totalEntries}</div>
          <div className="stat-label">Total Entries</div>
        </div>
        <div className="stat-box">
          <div className="stat-value">{insights.topEmotion || "—"}</div>
          <div className="stat-label">Top Emotion</div>
        </div>
        <div className="stat-box">
          <div className="stat-value">{insights.mostUsedAmbience || "—"}</div>
          <div className="stat-label">Fav Ambience</div>
        </div>
      </div>

      {/* Recent Keywords */}
      {insights.recentKeywords.length > 0 && (
        <div className="insights-section">
          <h3>Recent Keywords</h3>
          <div className="keywords">
            {insights.recentKeywords.map((k) => (
              <span key={k} className="keyword-tag">{k}</span>
            ))}
          </div>
        </div>
      )}

      {/* Emotion Breakdown */}
      {insights.emotionBreakdown.length > 0 && (
        <div className="insights-section">
          <h3>Emotion Breakdown</h3>
          {insights.emotionBreakdown.map((e) => (
            <div key={e.emotion} className="bar-row">
              <span className="bar-label">{e.emotion}</span>
              <div className="bar-track">
                <div
                  className="bar-fill"
                  style={{
                    width: `${(e.count / insights.totalEntries) * 100}%`,
                  }}
                />
              </div>
              <span className="bar-count">{e.count}</span>
            </div>
          ))}
        </div>
      )}

      {/* Ambience Breakdown */}
      {insights.ambienceBreakdown.length > 0 && (
        <div className="insights-section">
          <h3>Ambience Usage</h3>
          {insights.ambienceBreakdown.map((a) => (
            <div key={a.ambience} className="bar-row">
              <span className="bar-label">{a.ambience}</span>
              <div className="bar-track">
                <div
                  className="bar-fill bar-fill-green"
                  style={{
                    width: `${(a.count / insights.totalEntries) * 100}%`,
                  }}
                />
              </div>
              <span className="bar-count">{a.count}</span>
            </div>
          ))}
        </div>
      )}

      <button className="btn-refresh" onClick={fetchInsights}>
        🔄 Refresh Insights
      </button>
    </div>
  );
}
