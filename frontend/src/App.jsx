import { useState, useEffect, useCallback } from "react";
import JournalForm from "./components/JournalForm";
import EntryList from "./components/EntryList";
import InsightsPanel from "./components/InsightsPanel";
import { getEntries } from "./api/journalApi";

// Demo userId — in a real app this would come from auth
const USER_ID = "user_123";

export default function App() {
  const [entries, setEntries] = useState([]);
  const [activeTab, setActiveTab] = useState("journal");
  const [insightsTrigger, setInsightsTrigger] = useState(0);

  const fetchEntries = useCallback(async () => {
    try {
      const res = await getEntries(USER_ID);
      setEntries(res.data.data);
    } catch (err) {
      console.error("Failed to fetch entries:", err.message);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // Called after a new entry is created
  const handleEntryCreated = () => {
    fetchEntries();
    setInsightsTrigger((t) => t + 1);
  };

  // Called after an entry is analyzed — update local state
  const handleAnalyzed = (entryId, result, cached) => {
    setEntries((prev) =>
      prev.map((e) =>
        e._id === entryId
          ? { ...e, ...result, analyzed: true }
          : e
      )
    );
    setInsightsTrigger((t) => t + 1);
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <h1>🌿 ArvyaX Journal</h1>
          <p>Your nature immersion wellness companion</p>
        </div>
        <div className="user-badge">👤 {USER_ID}</div>
      </header>

      <nav className="tabs">
        <button
          className={activeTab === "journal" ? "tab active" : "tab"}
          onClick={() => setActiveTab("journal")}
        >
          📝 Journal
        </button>
        <button
          className={activeTab === "entries" ? "tab active" : "tab"}
          onClick={() => setActiveTab("entries")}
        >
          📖 Entries {entries.length > 0 && `(${entries.length})`}
        </button>
        <button
          className={activeTab === "insights" ? "tab active" : "tab"}
          onClick={() => setActiveTab("insights")}
        >
          📊 Insights
        </button>
      </nav>

      <main className="main">
        {activeTab === "journal" && (
          <JournalForm
            userId={USER_ID}
            onEntryCreated={handleEntryCreated}
          />
        )}
        {activeTab === "entries" && (
          <EntryList entries={entries} onAnalyzed={handleAnalyzed} />
        )}
        {activeTab === "insights" && (
          <InsightsPanel userId={USER_ID} refreshTrigger={insightsTrigger} />
        )}
      </main>
    </div>
  );
}
