/**
 * SocialAnalyzerView mirrors the OSINT search shape — one centered input, results
 * below — because the previous card-grid read as confirmed accounts and wasted
 * space. Candidates are rendered as a compact username→sites tree with a status
 * light (green verified, yellow candidate/unverified, red absent) so template
 * coverage is never mistaken for cited evidence.
 */
import { Search, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import type { SocialCandidate, SocialCandidateStatus } from "../../shared/schemas/social";
import { useReacherClient } from "../hooks/use-reacher-client";

type ProfileLight = "verified" | "candidate" | "absent";

export function SocialAnalyzerView() {
  const { invoke } = useReacherClient();
  const [username, setUsername] = useState("");
  const [analyzedUsername, setAnalyzedUsername] = useState("");
  const [candidates, setCandidates] = useState<SocialCandidate[]>([]);
  const [totalNetworks, setTotalNetworks] = useState(0);
  const [recommendedTools, setRecommendedTools] = useState<string[]>([]);
  const [candidateQuery, setCandidateQuery] = useState("");
  const [status, setStatus] = useState("Type a username to sweep public networks");
  const [loadingLabel, setLoadingLabel] = useState("");

  const filteredCandidates = useMemo(() => {
    const needle = candidateQuery.trim().toLowerCase();
    if (!needle) {
      return candidates;
    }
    return candidates.filter((candidate) => {
      const haystack = `${candidate.network} ${candidate.url} ${candidate.status} ${candidate.fields.join(" ")}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [candidateQuery, candidates]);

  async function analyze(): Promise<void> {
    setLoadingLabel("Generating social candidates");
    const result = await invoke("social:analyze", { username, limit: 700 });
    if (!result.ok) {
      setStatus(result.error.message);
      setLoadingLabel("");
      return;
    }
    setCandidates(result.value.candidates);
    setTotalNetworks(result.value.totalNetworks);
    setRecommendedTools(result.value.recommendedTools);
    setAnalyzedUsername(username.trim());
    setCandidateQuery("");
    setStatus(`Generated ${result.value.candidates.length} candidates from ${result.value.totalNetworks} networks`);
    setLoadingLabel("");
  }

  async function verifyAll(): Promise<void> {
    if (!analyzedUsername || candidates.length === 0) {
      return;
    }
    setLoadingLabel(`Checking ${candidates.length} live sites — this can take a minute`);
    const result = await invoke("social:verify", { username: analyzedUsername, limit: candidates.length });
    if (!result.ok) {
      setStatus(result.error.message);
      setLoadingLabel("");
      return;
    }
    setCandidates(result.value.candidates);
    const verifiedCount = result.value.candidates.filter((candidate) => candidate.status === "verified").length;
    const absentCount = result.value.candidates.filter((candidate) => candidate.status === "absent").length;
    setStatus(
      `Checked ${result.value.checkedCount} sites — ${verifiedCount} confirmed, ${absentCount} absent, ` +
        `${result.value.skippedCount} skipped (protected against direct checks)`
    );
    setLoadingLabel("");
  }

  return (
    <section className="route-surface social-surface" aria-labelledby="social-title">
      <header className="search-home">
        <p className="console-line">Username reconnaissance</p>
        <h1 className="route-title" id="social-title">
          Which username are we tracing?
        </h1>
        <div className="search-composer social-composer">
          <input
            className="search-main-input"
            aria-label="Username"
            placeholder="Type a username — no @, just the handle"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                void analyze();
              }
            }}
          />
          <button className="icon-button search-submit" type="button" aria-label="Analyze" title="Analyze" onClick={() => void analyze()}>
            <Search size={17} aria-hidden="true" />
          </button>
        </div>
        <p className="route-summary">{status}</p>
      </header>

      {candidates.length > 0 ? (
        <div className="social-results">
          <section className="console-panel social-plan-panel" aria-label="Verification plan">
            <div className="section-title-row section-title-row-wide">
              <div className="social-legend">
                <span><span className="status-dot status-dot-verified" /> verified profile</span>
                <span><span className="status-dot status-dot-candidate" /> candidate (unverified)</span>
                <span><span className="status-dot status-dot-absent" /> no profile</span>
              </div>
              <button
                className="icon-button"
                type="button"
                aria-label="Verify all candidates against live sites"
                title="Check every candidate for real, using each site's own exists/missing rule"
                onClick={() => void verifyAll()}
              >
                <ShieldCheck size={16} aria-hidden="true" />
              </button>
            </div>
            <p className="status-text">
              {totalNetworks} networks scanned · verify with {recommendedTools.join(", ") || "the recommended tools"}
            </p>
            <label className="search-field social-candidate-search">
              <Search size={16} aria-hidden="true" />
              <input
                aria-label="Search candidates"
                value={candidateQuery}
                onChange={(event) => setCandidateQuery(event.target.value)}
                placeholder="Filter sites"
              />
            </label>
          </section>

          <section className="console-panel social-tree-panel" aria-labelledby="social-tree-title">
            <h2 className="section-title" id="social-tree-title">
              Profiles
            </h2>
            <div className="social-tree" role="tree" aria-label={`Candidates for ${analyzedUsername}`}>
              <div className="social-tree-root">@{analyzedUsername}</div>
              <div className="social-tree-branches">
                {filteredCandidates.map((candidate) => {
                  const light = lightFor(candidate.status);
                  return (
                    <a
                      className="social-tree-row"
                      role="treeitem"
                      key={`${candidate.network}-${candidate.url}`}
                      href={candidate.url}
                      target="_blank"
                      rel="noreferrer"
                      title={`${candidate.status} · ${candidate.fields.join(", ")}`}
                    >
                      <span className={`status-dot status-dot-${light}`} aria-hidden="true" />
                      <strong>{candidate.network}</strong>
                      <span className="social-tree-url">{candidate.url}</span>
                    </a>
                  );
                })}
                {filteredCandidates.length === 0 ? <p className="status-text">No candidates match this search.</p> : null}
              </div>
            </div>
          </section>
        </div>
      ) : null}
      {loadingLabel ? <div className="route-loading" role="status">{loadingLabel}</div> : null}
    </section>
  );
}

/**
 * Map a candidate status to a traffic light. "unknown" (checked but the site's
 * protection made the result unreliable, or the check hasn't run yet) reads
 * the same amber as an unverified candidate -- both mean "not confirmed
 * either way" -- but keeps its own word in the tooltip so a hover still tells
 * the two apart.
 */
function lightFor(status: SocialCandidateStatus): ProfileLight {
  if (status === "verified") {
    return "verified";
  }
  if (status === "absent") {
    return "absent";
  }
  return "candidate";
}
