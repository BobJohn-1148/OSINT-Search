/**
 * SocialAnalyzerView renders candidate public profiles separately from verified
 * findings. If generated URLs looked like confirmed accounts, investigators
 * could mistake template coverage for cited OSINT evidence.
 */
import { Copy, ExternalLink, Filter, Network, Search, ShieldCheck, Sparkles, Users } from "lucide-react";
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import type { SocialCandidate } from "../../shared/schemas/social";
import { useReacherClient } from "../hooks/use-reacher-client";

export function SocialAnalyzerView() {
  const { invoke } = useReacherClient();
  const [username, setUsername] = useState("jdoe");
  const [candidateFilter, setCandidateFilter] = useState("");
  const [candidates, setCandidates] = useState<SocialCandidate[]>([]);
  const [totalNetworks, setTotalNetworks] = useState(0);
  const [recommendedTools, setRecommendedTools] = useState<string[]>([]);
  const [selectedCandidateKey, setSelectedCandidateKey] = useState("");
  const [status, setStatus] = useState("Social analyzer ready");
  const filteredCandidates = useMemo(
    () => filterCandidates(candidates, candidateFilter),
    [candidateFilter, candidates]
  );
  const fieldCounts = useMemo(() => countFields(candidates), [candidates]);
  const graph = useMemo(() => buildSocialGraph(filteredCandidates, username), [filteredCandidates, username]);
  const coveragePercent = totalNetworks > 0 ? Math.round((candidates.length / totalNetworks) * 100) : 0;

  async function analyze(): Promise<void> {
    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      setStatus("Enter a username before analyzing");
      return;
    }
    setStatus(`Generating candidates for ${trimmedUsername}`);
    const result = await invoke("social:analyze", { username: trimmedUsername, limit: 320 });
    if (!result.ok) {
      setStatus(result.error.message);
      return;
    }
    setCandidates(result.value.candidates);
    setSelectedCandidateKey(candidateKey(result.value.candidates[0] ?? null));
    setTotalNetworks(result.value.totalNetworks);
    setRecommendedTools(result.value.recommendedTools);
    setStatus(`Generated ${result.value.candidates.length} candidates from ${result.value.totalNetworks} networks`);
  }

  async function copyCandidateUrl(url: string): Promise<void> {
    await navigator.clipboard.writeText(url);
    setStatus("Candidate URL copied");
  }

  return (
    <section className="route-surface social-workspace" aria-labelledby="social-title">
      <section className="social-hero">
        <div className="social-hero-copy">
          <span className="eyebrow">SOCMINT candidate builder</span>
          <h1 className="route-title" id="social-title">
            Social analyzer
          </h1>
          <p className="route-summary">
            Generate candidate public profiles across the offline WhatsMyName catalog, then verify them before treating anything as evidence.
          </p>
        </div>

        <form
          className="social-command-card"
          onSubmit={(event) => {
            event.preventDefault();
            void analyze();
          }}
        >
          <label className="compact-field social-username-field">
            Username
            <input
              className="field-control social-username-input"
              value={username}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => setUsername(event.target.value)}
            />
          </label>
          <button className="primary-button social-analyze-button" type="submit">
            <Search size={18} aria-hidden="true" />
            Analyze
          </button>
          <span className="status-text social-status" role="status">
            {status}
          </span>
        </form>
      </section>

      <div className="social-summary-grid" aria-label="Social analyzer summary">
        <SocialMetric icon={<Users size={18} aria-hidden="true" />} label="Catalog coverage" value={`${totalNetworks}`} hint="public networks" />
        <SocialMetric icon={<Sparkles size={18} aria-hidden="true" />} label="Candidates" value={`${candidates.length}`} hint={`${coveragePercent}% of catalog`} />
        <SocialMetric icon={<ShieldCheck size={18} aria-hidden="true" />} label="Evidence status" value="Unverified" hint="review before saving" />
      </div>

      <section className="console-panel social-graph-panel" aria-labelledby="social-graph-title">
        <div className="social-candidates-header">
          <div>
            <h2 className="section-title" id="social-graph-title">Candidate graph</h2>
            <p className="status-text">Dot view of generated profile leads. Select a dot to focus the review queue.</p>
          </div>
          <span className="status-pill status-pill-blue">
            {filteredCandidates.length} dots
          </span>
        </div>
        <SocialCandidateGraph
          graph={graph}
          selectedKey={selectedCandidateKey}
          onSelect={(candidate) => {
            setSelectedCandidateKey(candidateKey(candidate));
            setCandidateFilter(candidate.network);
          }}
        />
      </section>

      <div className="social-layout">
        <aside className="console-panel social-panel social-coverage-panel">
          <div className="panel-heading-row">
            <div>
              <h2 className="section-title">Verification plan</h2>
              <p className="status-text">Use these generated URLs as leads, not proof.</p>
            </div>
            <Filter size={18} aria-hidden="true" />
          </div>

          <div className="social-field-grid">
            <FieldStat label="Profiles" value={fieldCounts.profile} />
            <FieldStat label="Relationships" value={fieldCounts.relationships} />
            <FieldStat label="Images" value={fieldCounts.images} />
          </div>

          <div className="social-tool-box">
            <h3>Recommended tools</h3>
            <div className="chip-row">
              {recommendedTools.map((tool) => (
                <span className="source-chip" key={tool}>
                  {tool}
                </span>
              ))}
              {recommendedTools.length === 0 ? <span className="status-text">Run analysis to get tool suggestions.</span> : null}
            </div>
          </div>

          <ol className="social-checklist">
            <li>Open likely candidates in a browser.</li>
            <li>Compare profile text, imagery, relationships, and timestamps.</li>
            <li>Only save confirmed evidence from the main OSINT search/case flow.</li>
          </ol>
        </aside>

        <section className="console-panel social-panel social-candidates-panel">
          <div className="social-candidates-header">
            <div>
              <h2 className="section-title">Candidates</h2>
              <p className="status-text">{filteredCandidates.length} of {candidates.length} shown</p>
            </div>
            <label className="social-filter-field">
              <Search size={16} aria-hidden="true" />
              <span className="sr-only">Search candidates</span>
              <input
                value={candidateFilter}
                placeholder="Filter network or URL"
                onChange={(event) => setCandidateFilter(event.target.value)}
              />
            </label>
          </div>

          <div className="social-candidate-grid" role="list">
            {filteredCandidates.map((candidate) => (
              <article
                className={candidateKey(candidate) === selectedCandidateKey ? "social-candidate-card is-selected" : "social-candidate-card"}
                key={`${candidate.network}-${candidate.url}`}
                role="listitem"
              >
                <div className="social-candidate-topline">
                  <strong>{candidate.network}</strong>
                  <span className="audit-sensitivity">{candidate.status}</span>
                </div>
                <a href={candidate.url} target="_blank" rel="noreferrer">
                  {candidate.url}
                </a>
                <div className="social-field-chips" aria-label={`${candidate.network} fields`}>
                  {candidate.fields.map((field) => (
                    <span className="source-chip" key={field}>
                      {field}
                    </span>
                  ))}
                </div>
                <div className="social-card-actions">
                  <a className="action-button" href={candidate.url} target="_blank" rel="noreferrer">
                    <ExternalLink size={16} aria-hidden="true" />
                    Open
                  </a>
                  <button className="action-button" type="button" onClick={() => void copyCandidateUrl(candidate.url)}>
                    <Copy size={16} aria-hidden="true" />
                    Copy URL
                  </button>
                </div>
              </article>
            ))}
            {candidates.length === 0 ? (
              <div className="social-empty-state">
                <Users size={32} aria-hidden="true" />
                <h3>No candidates generated yet.</h3>
                <p className="status-text">Enter a username and run Analyze to build a review queue from the offline catalog.</p>
              </div>
            ) : null}
            {candidates.length > 0 && filteredCandidates.length === 0 ? (
              <div className="social-empty-state">
                <Search size={32} aria-hidden="true" />
                <h3>No candidates match that filter.</h3>
                <p className="status-text">Try a network name, profile domain, or clear the filter.</p>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </section>
  );
}

function SocialMetric(props: { readonly icon: ReactNode; readonly label: string; readonly value: string; readonly hint: string }) {
  return (
    <div className="social-metric-card">
      <span>{props.icon}</span>
      <div>
        <small>{props.label}</small>
        <strong>{props.value}</strong>
        <em>{props.hint}</em>
      </div>
    </div>
  );
}

function FieldStat(props: { readonly label: string; readonly value: number }) {
  return (
    <div className="social-field-stat">
      <strong>{props.value}</strong>
      <span>{props.label}</span>
    </div>
  );
}

interface SocialGraphNode {
  readonly id: string;
  readonly label: string;
  readonly x: number;
  readonly y: number;
  readonly ring: number;
  readonly candidate: SocialCandidate | null;
  readonly kind: "seed" | "candidate";
}

interface SocialGraphEdge {
  readonly id: string;
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly angle: number;
}

function SocialCandidateGraph(props: {
  readonly graph: { readonly nodes: readonly SocialGraphNode[]; readonly edges: readonly SocialGraphEdge[] };
  readonly selectedKey: string;
  readonly onSelect: (candidate: SocialCandidate) => void;
}) {
  return (
    <div className="social-dot-graph" aria-label="Social candidate dot graph">
      <div className="social-dot-grid" />
      {props.graph.edges.map((edge) => (
        <span
          className="social-dot-edge"
          key={edge.id}
          style={{ left: `${edge.left}%`, top: `${edge.top}%`, width: `${edge.width}%`, transform: `rotate(${edge.angle}deg)` }}
        />
      ))}
      {props.graph.nodes.map((node) => {
        if (node.kind === "seed") {
          return (
            <div className="social-dot-node social-dot-seed" key={node.id} style={nodeStyle(node)}>
              <Network size={18} aria-hidden="true" />
              <strong>{node.label}</strong>
              <span>username hub</span>
            </div>
          );
        }
        const candidate = node.candidate;
        if (!candidate) {
          return null;
        }
        const isSelected = candidateKey(candidate) === props.selectedKey;
        return (
          <button
            className={isSelected ? "social-dot-node social-dot-candidate is-selected" : "social-dot-node social-dot-candidate"}
            key={node.id}
            type="button"
            style={nodeStyle(node)}
            title={`${candidate.network}: ${candidate.url}`}
            aria-label={`Select ${candidate.network} candidate`}
            onClick={() => props.onSelect(candidate)}
          >
            <span className="social-dot-light" />
            <strong>{node.label}</strong>
            <span>{candidate.fields.join(" / ")}</span>
          </button>
        );
      })}
      {props.graph.nodes.length <= 1 ? (
        <div className="social-dot-empty">
          <Users size={28} aria-hidden="true" />
          <span>Run Analyze to draw candidate dots.</span>
        </div>
      ) : null}
    </div>
  );
}

function buildSocialGraph(candidates: readonly SocialCandidate[], username: string): { readonly nodes: SocialGraphNode[]; readonly edges: SocialGraphEdge[] } {
  const seed: SocialGraphNode = {
    id: "seed",
    label: username.trim() || "username",
    x: 50,
    y: 50,
    ring: 0,
    candidate: null,
    kind: "seed"
  };
  const visibleCandidates = candidates.slice(0, 96);
  const nodes = [
    seed,
    ...visibleCandidates.map((candidate, index): SocialGraphNode => {
      const ring = 1 + (index % 3);
      const candidatesInRing = Math.ceil(visibleCandidates.length / 3) || 1;
      const ringIndex = Math.floor(index / 3);
      const angle = (ringIndex / candidatesInRing) * Math.PI * 2 + ring * 0.28;
      const radius = 15 + ring * 10;
      return {
        id: candidateKey(candidate),
        label: candidate.network,
        x: clampGraphPosition(50 + Math.cos(angle) * radius),
        y: clampGraphPosition(50 + Math.sin(angle) * radius),
        ring,
        candidate,
        kind: "candidate"
      };
    })
  ];
  const edges = nodes.slice(1).map((node): SocialGraphEdge => {
    const dx = node.x - seed.x;
    const dy = node.y - seed.y;
    return {
      id: `seed-${node.id}`,
      left: seed.x,
      top: seed.y,
      width: Math.sqrt(dx * dx + dy * dy),
      angle: Math.atan2(dy, dx) * (180 / Math.PI)
    };
  });
  return { nodes, edges };
}

function nodeStyle(node: SocialGraphNode): CSSProperties {
  return {
    "--social-node-x": `${node.x}%`,
    "--social-node-y": `${node.y}%`,
    "--social-node-ring": `${node.ring}`
  } as CSSProperties;
}

function clampGraphPosition(value: number): number {
  return Math.min(88, Math.max(12, value));
}

function candidateKey(candidate: SocialCandidate | null): string {
  return candidate ? `${candidate.network}-${candidate.url}` : "";
}

function filterCandidates(candidates: readonly SocialCandidate[], query: string): SocialCandidate[] {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return [...candidates];
  }
  return candidates.filter((candidate) => `${candidate.network} ${candidate.url} ${candidate.fields.join(" ")}`.toLowerCase().includes(needle));
}

function countFields(candidates: readonly SocialCandidate[]): Record<SocialCandidate["fields"][number], number> {
  return candidates.reduce(
    (counts, candidate) => {
      for (const field of candidate.fields) {
        counts[field] += 1;
      }
      return counts;
    },
    { profile: 0, relationships: 0, images: 0 }
  );
}
