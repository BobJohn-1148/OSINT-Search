/**
 * SocialAnalyzerView renders candidate public profiles separately from verified
 * findings. If generated URLs looked like confirmed accounts, investigators
 * could mistake template coverage for cited OSINT evidence.
 */
import { Search, Users } from "lucide-react";
import { useState } from "react";
import type { SocialCandidate } from "../../shared/schemas/social";
import { useReacherClient } from "../hooks/use-reacher-client";

export function SocialAnalyzerView() {
  const { invoke } = useReacherClient();
  const [username, setUsername] = useState("jdoe");
  const [candidates, setCandidates] = useState<SocialCandidate[]>([]);
  const [totalNetworks, setTotalNetworks] = useState(0);
  const [recommendedTools, setRecommendedTools] = useState<string[]>([]);
  const [status, setStatus] = useState("Social analyzer ready");

  async function analyze(): Promise<void> {
    const result = await invoke("social:analyze", { username, limit: 320 });
    if (!result.ok) {
      setStatus(result.error.message);
      return;
    }
    setCandidates(result.value.candidates);
    setTotalNetworks(result.value.totalNetworks);
    setRecommendedTools(result.value.recommendedTools);
    setStatus(`Generated ${result.value.candidates.length} candidates from ${result.value.totalNetworks} networks`);
  }

  return (
    <section className="route-surface" aria-labelledby="social-title">
      <header className="route-header">
        <h1 className="route-title" id="social-title">
          Social analyzer
        </h1>
        <p className="route-summary">Generate candidate public profiles across the offline WhatsMyName catalog for follow-up verification.</p>
      </header>

      <section className="console-panel social-command-panel">
        <label className="compact-field">
          Username
          <input className="field-control" value={username} onChange={(event) => setUsername(event.target.value)} />
        </label>
        <button className="action-button" type="button" onClick={() => void analyze()}>
          <Search size={16} aria-hidden="true" />
          Analyze
        </button>
        <span className="status-text" role="status">
          {status}
        </span>
      </section>

      <div className="social-layout">
        <section className="console-panel social-panel">
          <h2 className="section-title">Coverage</h2>
          <div className="mobile-device-row">
            <Users size={18} aria-hidden="true" />
            <div>
              <strong>{totalNetworks}</strong>
              <span className="status-text">Public networks in the offline catalog</span>
            </div>
          </div>
          <p className="status-text">Recommended verification tools: {recommendedTools.join(", ") || "Run analysis"}</p>
        </section>

        <section className="console-panel social-panel">
          <h2 className="section-title">Candidates</h2>
          <div className="table-list">
            {candidates.map((candidate) => (
              <div className="social-candidate-row" key={`${candidate.network}-${candidate.url}`}>
                <strong>{candidate.network}</strong>
                <a href={candidate.url} target="_blank" rel="noreferrer">
                  {candidate.url}
                </a>
                <span className="status-text">
                  {candidate.status} / fields:{candidate.fields.join(", ")}
                </span>
              </div>
            ))}
            {candidates.length === 0 ? <p className="status-text">No candidates generated yet.</p> : null}
          </div>
        </section>
      </div>
    </section>
  );
}
