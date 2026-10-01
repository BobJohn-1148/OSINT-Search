/**
 * Search is a command workspace: one composer launches passive OSINT fan-out,
 * while the rails keep cases, monitoring, and agent plugins close enough to act
 * on evidence without burying the user in raw source output.
 */
import {
  Bot,
  Briefcase,
  Database,
  FileUp,
  FolderOpen,
  GitBranch,
  Globe,
  Image as ImageIcon,
  Play,
  Radar,
  Save,
  Search as SearchIcon,
  Square,
  Users
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { AgentRecord } from "../../shared/schemas/agents";
import type { CaseRecord } from "../../shared/schemas/cases";
import type { MonitoringAlert, WatchRecord } from "../../shared/schemas/monitoring";
import type { PdfTextImportResponse, PdfTextSearchResponse } from "../../shared/schemas/pdf-text-import";
import type { DocxTextImportResponse, DocxTextSearchResponse } from "../../shared/schemas/docx-text-import";
import type { PptxTextImportResponse, PptxTextSearchResponse } from "../../shared/schemas/pptx-text-import";
import type { XlsxTextImportResponse, XlsxTextSearchResponse } from "../../shared/schemas/xlsx-text-import";
import { sourceReferenceMayContainSecret, type CorpusArchiveInspectResponse, type CorpusExactSearchResponse, type CorpusImportResponse } from "../../shared/schemas/corpus-import";
import type { Observation, SearchRunResult, SearchSeed, SeedType, SourceStatus } from "../../shared/types/search";
import { seedTypeValues } from "../../shared/types/search";
import { entityTypeValues, type EntityType } from "../../shared/types/entity-graph";
import { useReacherClient } from "../hooks/use-reacher-client";
import { observationsForOutput } from "./osint-results-model";
import { OsintResultsView, type OsintAssessment } from "./osint-results-view";

type SearchEffort = "low" | "standard" | "deep";

const effortOptions: readonly { readonly id: SearchEffort; readonly label: string; readonly hint: string }[] = [
  { id: "low", label: "Low", hint: "Fast passive sweep" },
  { id: "standard", label: "Standard", hint: "Balanced OSINT fan-out" },
  { id: "deep", label: "Deep", hint: "Longer AI scrape timeout" }
];

export function SearchView() {
  const { invoke } = useReacherClient();
  const [seedType, setSeedType] = useState<SeedType>("domain");
  const [seedValue, setSeedValue] = useState("example.com");
  const [seedJurisdiction, setSeedJurisdiction] = useState("");
  const [effort, setEffort] = useState<SearchEffort>("standard");
  const [imagePath, setImagePath] = useState("C:\\images\\subject.png");
  const [username, setUsername] = useState("jdoe");
  const [missionBrief, setMissionBrief] = useState("Find public evidence, cite sources, and flag pivots worth saving.");
  const [run, setRun] = useState<SearchRunResult | null>(null);
  const [arrivals, setArrivals] = useState<SourceStatus[]>([]);
  const [liveObservations, setLiveObservations] = useState<Observation[]>([]);
  const [selectedObservationId, setSelectedObservationId] = useState<string | null>(null);
  const [status, setStatus] = useState("Ready when you are");
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [watches, setWatches] = useState<WatchRecord[]>([]);
  const [alerts, setAlerts] = useState<MonitoringAlert[]>([]);
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState("osint-agent");
  const [graphEntityType, setGraphEntityType] = useState<EntityType>("unknown");
  const [graphEntityLabel, setGraphEntityLabel] = useState("");
  const [assessment, setAssessment] = useState<OsintAssessment | null>(null);
  const [corpusAccessBasis, setCorpusAccessBasis] = useState<"public" | "authorized">("public");
  const [corpusSourceName, setCorpusSourceName] = useState("");
  const [corpusSourceUrl, setCorpusSourceUrl] = useState("");
  const [corpusSourceDate, setCorpusSourceDate] = useState("");
  const [corpusIdentifierType, setCorpusIdentifierType] = useState("uei");
  const [corpusIdentifierField, setCorpusIdentifierField] = useState("uei");
  const [corpusLookupValue, setCorpusLookupValue] = useState("");
  const [corpusResults, setCorpusResults] = useState<CorpusExactSearchResponse["results"]>([]);
  const [pdfTextQuery, setPdfTextQuery] = useState("");
  const [pdfTextResults, setPdfTextResults] = useState<PdfTextSearchResponse["results"]>([]);
  const [docxTextQuery, setDocxTextQuery] = useState("");
  const [docxTextResults, setDocxTextResults] = useState<DocxTextSearchResponse["results"]>([]);
  const [pptxTextQuery, setPptxTextQuery] = useState("");
  const [pptxTextResults, setPptxTextResults] = useState<PptxTextSearchResponse["results"]>([]);
  const [xlsxTextQuery, setXlsxTextQuery] = useState("");
  const [xlsxTextResults, setXlsxTextResults] = useState<XlsxTextSearchResponse["results"]>([]);
  const [archiveInspection, setArchiveInspection] = useState<Extract<CorpusArchiveInspectResponse, { sessionToken: string }> | null>(null);
  const [archiveEntryIndex, setArchiveEntryIndex] = useState<number | null>(null);
  const [corpusStatus, setCorpusStatus] = useState("Imports stay on this computer and are searched by exact identifier.");
  // The run this view started. Observation batches carry their run id, so a late batch from an earlier or cancelled run is
  // dropped here instead of drawing (and pinging) in the current one. Source statuses carry no run id yet
  // (planning/OSINT-GRAPH-EVENT-CONTRACT.md, gap 1), so they cannot be filtered the same way.
  const activeRunRef = useRef<string | null>(null);
  // a second click on Cancel while the first is still being answered must not change anything
  const cancelRequestedFor = useRef<string | null>(null);
  // the run id whose cancel was accepted: the results show it as cancelled even when no source reported being cancelled
  const [cancelledRunId, setCancelledRunId] = useState<string | null>(null);

  useEffect(() => {
    const removeSourceListener = window.reacher.onSearchEvent("search:source-returned", (sourceStatus) => {
      setArrivals((current) => [...current, sourceStatus]);
    });
    const removeObservationListener = window.reacher.onSearchEvent("search:observations", (observations) => {
      const own = activeRunRef.current;
      const current = own === null ? observations : observations.filter((observation) => observation.runId === own);
      if (current.length > 0) {
        setLiveObservations((previous) => [...previous, ...current].slice(-5000));
      }
    });

    return () => {
      removeSourceListener();
      removeObservationListener();
    };
  }, []);

  const refreshRails = useCallback(async (): Promise<void> => {
    const [caseResult, watchResult, agentResult] = await Promise.all([
      invoke("cases:list", {}),
      invoke("watch:list", {}),
      invoke("agents:list", {})
    ]);
    if (caseResult.ok) {
      setCases(Array.isArray(caseResult.value.cases) ? caseResult.value.cases.filter(isCaseRecord) : []);
    }
    if (watchResult.ok) {
      setWatches(Array.isArray(watchResult.value.watches) ? watchResult.value.watches.filter(Boolean) : []);
      setAlerts(Array.isArray(watchResult.value.alerts) ? watchResult.value.alerts.filter(Boolean) : []);
    }
    if (agentResult.ok) {
      const nextAgents = Array.isArray(agentResult.value.agents) ? agentResult.value.agents.filter(Boolean) : [];
      setAgents(nextAgents);
      setSelectedAgentId((current) => current || nextAgents[0]?.id || "osint-agent");
    }
  }, [invoke]);

  useEffect(() => {
    let mounted = true;
    void Promise.resolve().then(async () => {
      if (mounted) {
        await refreshRails();
      }
    });
    return () => {
      mounted = false;
    };
  }, [refreshRails]);

  const activeSeed: SearchSeed = useMemo(() => ({ type: seedType, value: seedValue, ...(seedType === "parcel" && seedJurisdiction.trim() ? { jurisdiction: seedJurisdiction.trim() } : {}) }), [seedType, seedValue, seedJurisdiction]);
  const observations = useMemo(() => observationsForOutput(run, liveObservations), [liveObservations, run]);
  const selectedObservation = selectedObservationId
    ? observations.find((observation) => observation.id === selectedObservationId) ?? firstItem(observations)
    : firstItem(observations);
  const previewUrl = useMemo(() => websitePreviewUrl(run?.seed ?? activeSeed), [activeSeed, run?.seed]);
  const effectiveStatuses = run?.statuses ?? arrivals;

  async function runSearch(pivotSeed?: SearchSeed): Promise<void> {
    const seed = pivotSeed ?? activeSeed;
    if (!seed.value) {
      setStatus("Enter a seed before searching");
      return;
    }
    if (seed.type === "parcel" && !seed.jurisdiction?.trim()) {
      setStatus("Enter a parcel jurisdiction before searching");
      return;
    }

    setRun(null);
    setAssessment(null);
    setSelectedObservationId(null);
    setArrivals([]);
    setLiveObservations([]);
    setStatus(`${effortLabel(effort)} search started`);
    const runId = crypto.randomUUID();
    activeRunRef.current = runId;
    setActiveRunId(runId);

    const result = await invoke(pivotSeed ? "search:pivot" : "search:run", { seed, runId, effort });
    setActiveRunId(null);
    if (!result.ok) {
      setStatus(result.error.message);
      return;
    }

    setRun(result.value.run);
    setSelectedObservationId(result.value.run.observations[0]?.id ?? null);
    setStatus(cancelRequestedFor.current === runId ? `Search cancelled; ${result.value.run.observations.length} observations kept` : `Search complete with ${result.value.run.observations.length} observations`);
    await refreshRails();
  }

  async function cancelSearch(): Promise<void> {
    if (!activeRunId || cancelRequestedFor.current === activeRunId) {
      return;
    }
    cancelRequestedFor.current = activeRunId;
    const result = await invoke("search:cancel", { runId: activeRunId });
    const cancelled = result.ok && result.value.cancelled;
    if (cancelled) {
      setCancelledRunId(activeRunId);
    }
    setStatus(cancelled ? "Search cancelled" : "No active search to cancel");
    // A cancelled run keeps showing as running until its own result arrives (runSearch clears it then), so the tree does not
    // flash back to "not started" in between and then show partial evidence as if it were a fresh state.
    if (!cancelled) {
      setActiveRunId(null);
    }
  }

  async function searchImage(): Promise<void> {
    const targetCase = await ensureCase();
    const result = await invoke("search:image", { imagePath, caseId: targetCase?.id });
    if (!result.ok) {
      setStatus(result.error.message);
      return;
    }
    setRun(result.value.run);
    setSelectedObservationId(result.value.run.observations[0]?.id ?? null);
    setStatus(result.value.usedBrowserFallback ? "Image search used browser fallback" : "Image search complete");
  }

  async function pickImage(): Promise<void> {
    const result = await invoke("system:pickImage", {});
    if (!result.ok) {
      setStatus(result.error.message);
      return;
    }
    if (result.value.imagePath) {
      setImagePath(result.value.imagePath);
      setStatus("Image selected");
    }
  }

  async function usernameSweep(): Promise<void> {
    const targetCase = await ensureCase();
    const result = await invoke("search:usernameSweep", {
      username,
      wslDistro: "Ubuntu",
      caseId: targetCase?.id,
      sendToAgent: true
    });
    if (!result.ok) {
      setStatus(result.error.message);
      return;
    }
    setRun(result.value.run);
    setSelectedObservationId(result.value.run.observations[0]?.id ?? null);
    setStatus(`Username sweep complete; saved:${result.value.savedItems}`);
  }

  async function saveSelectedObservation(): Promise<void> {
    if (!selectedObservation) {
      return;
    }
    const targetCase = await ensureCase();
    if (!targetCase) {
      return;
    }
    const result = await invoke("case:addItem", {
      caseId: targetCase.id,
      itemType: "observation",
      refId: selectedObservation.id,
      title: selectedObservation.value,
      text: selectedObservation.value,
      metadata: {
        entity: selectedObservation.entity,
        strength: selectedObservation.confidence,
        sourceId: selectedObservation.source,
        raw: selectedObservation.raw ?? {}
      }
    });
    setStatus(result.ok ? `Saved to ${targetCase.title}` : result.error.message);
    await refreshRails();
  }

  async function saveSelectedObservationAsEntity(): Promise<void> {
    if (!selectedObservation) return;
    if (!graphEntityLabel.trim()) {
      setStatus("Enter a display label before saving this evidence as an entity");
      return;
    }
    const result = await invoke("entityGraph:saveObservation", {
      observationId: selectedObservation.id,
      type: graphEntityType,
      label: graphEntityLabel.trim()
    });
    if (!result.ok) {
      setStatus(result.error.message);
      return;
    }
    setStatus(`Saved ${result.value.entity.label} to the evidence graph with its source record`);
  }

  async function importCorpus(): Promise<void> {
    if (!corpusSourceName.trim()) {
      setCorpusStatus("Enter the dataset or source name before importing.");
      return;
    }
    if (sourceReferenceMayContainSecret(corpusSourceUrl)) {
      setCorpusStatus("Remove token-like query parameters from the source reference before importing.");
      return;
    }
    const result = await invoke("corpus:import", {
      accessBasis: corpusAccessBasis,
      sourceName: corpusSourceName.trim(),
      ...(corpusSourceUrl.trim() ? { sourceUrl: corpusSourceUrl.trim() } : {}),
      ...(corpusSourceDate ? { sourceDate: corpusSourceDate } : {}),
      identifierType: corpusIdentifierType,
      identifierField: corpusIdentifierField
    });
    if (!result.ok) {
      setCorpusStatus(result.error.message);
      return;
    }
    const imported: CorpusImportResponse = result.value;
    if (imported.cancelled || !imported.manifest) {
      setCorpusStatus("Import canceled; no data was stored.");
      return;
    }
    const rowLabel = imported.manifest.recordCount === 1 ? "row" : "rows";
    setCorpusStatus(`${imported.reusedExistingImport ? "Already imported" : "Quarantined and indexed"}: ${imported.manifest.originalName} · ${imported.manifest.recordCount.toLocaleString()} ${rowLabel} · SHA-256 ${imported.manifest.sha256.slice(0, 12)}…`);
  }

  async function importPdfText(): Promise<void> {
    if (!corpusSourceName.trim()) {
      setCorpusStatus("Enter the source or dataset name before choosing a PDF.");
      return;
    }
    if (sourceReferenceMayContainSecret(corpusSourceUrl)) {
      setCorpusStatus("Remove token-like query parameters from the source reference before importing.");
      return;
    }
    const result = await invoke("corpus:pdf-import", {
      accessBasis: corpusAccessBasis,
      sourceName: corpusSourceName.trim(),
      ...(corpusSourceUrl.trim() ? { sourceUrl: corpusSourceUrl.trim() } : {}),
      ...(corpusSourceDate ? { sourceDate: corpusSourceDate } : {})
    });
    if (!result.ok) {
      setCorpusStatus(result.error.message);
      return;
    }
    const imported: PdfTextImportResponse = result.value;
    if (imported.cancelled || !imported.manifest) {
      setCorpusStatus("PDF import canceled; no data was stored.");
      return;
    }
    const { manifest } = imported;
    setCorpusStatus(`${imported.reusedExistingImport ? "Already indexed" : "PDF quarantined and indexed"}: ${manifest.originalName} · ${manifest.textPageCount}/${manifest.pageCount} text pages · ${manifest.extractedBytes.toLocaleString()} bytes · SHA-256 ${manifest.sha256.slice(0, 12)}…${manifest.textPageCount === 0 ? " · no selectable text; OCR is not included" : " · local only, not sent to AI"}`);
  }

  async function searchPdfText(): Promise<void> {
    if (pdfTextQuery.trim().length < 3) {
      setCorpusStatus("Enter at least three characters to search indexed PDF pages.");
      return;
    }
    const result = await invoke("corpus:pdf-search", { query: pdfTextQuery.trim(), limit: 25 });
    if (!result.ok) {
      setCorpusStatus(result.error.message);
      return;
    }
    setPdfTextResults(result.value.results);
    setCorpusStatus(`${result.value.results.length} local PDF page match${result.value.results.length === 1 ? "" : "es"}; snippets are page-cited and never submitted to a model.`);
  }

  async function importDocxText(): Promise<void> {
    if (!corpusSourceName.trim()) { setCorpusStatus("Enter the source or dataset name before choosing a DOCX."); return; }
    if (sourceReferenceMayContainSecret(corpusSourceUrl)) { setCorpusStatus("Remove token-like query parameters from the source reference before importing."); return; }
    const result = await invoke("corpus:docx-import", {
      accessBasis: corpusAccessBasis, sourceName: corpusSourceName.trim(),
      ...(corpusSourceUrl.trim() ? { sourceUrl: corpusSourceUrl.trim() } : {}), ...(corpusSourceDate ? { sourceDate: corpusSourceDate } : {})
    });
    if (!result.ok) { setCorpusStatus(result.error.message); return; }
    const imported: DocxTextImportResponse = result.value;
    if (imported.cancelled || !imported.manifest) { setCorpusStatus("DOCX import canceled; no data was stored."); return; }
    const { manifest } = imported;
    setCorpusStatus(`${imported.reusedExistingImport ? "Already indexed" : "DOCX quarantined and indexed"}: ${manifest.originalName} · ${manifest.paragraphCount.toLocaleString()} text paragraphs · ${manifest.extractedBytes.toLocaleString()} bytes · SHA-256 ${manifest.sha256.slice(0, 12)}… · local only, not sent to AI`);
  }

  async function searchDocxText(): Promise<void> {
    if (docxTextQuery.trim().length < 3) { setCorpusStatus("Enter at least three characters to search indexed DOCX paragraphs."); return; }
    const result = await invoke("corpus:docx-search", { query: docxTextQuery.trim(), limit: 25 });
    if (!result.ok) { setCorpusStatus(result.error.message); return; }
    setDocxTextResults(result.value.results);
    setCorpusStatus(`${result.value.results.length} local DOCX paragraph match${result.value.results.length === 1 ? "" : "es"}; snippets are paragraph-cited and never submitted to a model.`);
  }

  async function importPptxText(): Promise<void> {
    if (!corpusSourceName.trim()) { setCorpusStatus("Enter the source or dataset name before choosing a PPTX."); return; }
    if (sourceReferenceMayContainSecret(corpusSourceUrl)) { setCorpusStatus("Remove token-like query parameters from the source reference before importing."); return; }
    const result = await invoke("corpus:pptx-import", {
      accessBasis: corpusAccessBasis, sourceName: corpusSourceName.trim(),
      ...(corpusSourceUrl.trim() ? { sourceUrl: corpusSourceUrl.trim() } : {}), ...(corpusSourceDate ? { sourceDate: corpusSourceDate } : {})
    });
    if (!result.ok) { setCorpusStatus(result.error.message); return; }
    const imported: PptxTextImportResponse = result.value;
    if (imported.cancelled || !imported.manifest) { setCorpusStatus("PPTX import canceled; no data was stored."); return; }
    const { manifest } = imported;
    setCorpusStatus(`${imported.reusedExistingImport ? "Already indexed" : "PPTX quarantined and indexed"}: ${manifest.originalName} · ${manifest.textSlideCount}/${manifest.slideCount} text slides · ${manifest.extractedBytes.toLocaleString()} bytes · SHA-256 ${manifest.sha256.slice(0, 12)}… · shape/table text only (chart, notes and media omitted) · local only, not sent to AI`);
  }

  async function searchPptxText(): Promise<void> {
    if (pptxTextQuery.trim().length < 3) { setCorpusStatus("Enter at least three characters to search indexed PPTX slides."); return; }
    const result = await invoke("corpus:pptx-search", { query: pptxTextQuery.trim(), limit: 25 });
    if (!result.ok) { setCorpusStatus(result.error.message); return; }
    setPptxTextResults(result.value.results);
    setCorpusStatus(`${result.value.results.length} local PPTX slide match${result.value.results.length === 1 ? "" : "es"}; snippets are slide-cited and never submitted to a model.`);
  }

  async function importXlsxText(): Promise<void> {
    if (!corpusSourceName.trim()) { setCorpusStatus("Enter the source or dataset name before choosing an XLSX workbook."); return; }
    if (sourceReferenceMayContainSecret(corpusSourceUrl)) { setCorpusStatus("Remove token-like query parameters from the source reference before importing."); return; }
    const result = await invoke("corpus:xlsx-import", {
      accessBasis: corpusAccessBasis, sourceName: corpusSourceName.trim(),
      ...(corpusSourceUrl.trim() ? { sourceUrl: corpusSourceUrl.trim() } : {}), ...(corpusSourceDate ? { sourceDate: corpusSourceDate } : {})
    });
    if (!result.ok) { setCorpusStatus(result.error.message); return; }
    const imported: XlsxTextImportResponse = result.value;
    if (imported.cancelled || !imported.manifest) { setCorpusStatus("XLSX import canceled; no data was stored."); return; }
    const { manifest } = imported;
    setCorpusStatus(`${imported.reusedExistingImport ? "Already indexed" : "XLSX quarantined and indexed"}: ${manifest.originalName} · ${manifest.cellCount.toLocaleString()} cells in ${manifest.sheetCount} sheets · ${manifest.hiddenSheetCount} hidden sheets and ${manifest.formulaCellCount.toLocaleString()} formulas excluded · ${manifest.extractedBytes.toLocaleString()} bytes · SHA-256 ${manifest.sha256.slice(0, 12)}… · local only, not sent to AI`);
  }

  async function searchXlsxText(): Promise<void> {
    if (xlsxTextQuery.trim().length < 3) { setCorpusStatus("Enter at least three characters to search indexed XLSX cells."); return; }
    const result = await invoke("corpus:xlsx-search", { query: xlsxTextQuery.trim(), limit: 25 });
    if (!result.ok) { setCorpusStatus(result.error.message); return; }
    setXlsxTextResults(result.value.results);
    setCorpusStatus(`${result.value.results.length} local XLSX cell match${result.value.results.length === 1 ? "" : "es"}; values are cell-cited, dates remain raw, and matches are never submitted to a model.`);
  }

  async function searchCorpus(): Promise<void> {
    if (!corpusLookupValue.trim()) {
      setCorpusStatus("Enter an exact identifier to search imported records.");
      return;
    }
    const result = await invoke("corpus:exact-search", {
      identifierType: corpusIdentifierType,
      identifierValue: corpusLookupValue.trim(),
      limit: 25
    });
    if (!result.ok) {
      setCorpusStatus(result.error.message);
      return;
    }
    setCorpusResults(result.value.results);
    setCorpusStatus(`${result.value.results.length} exact local match${result.value.results.length === 1 ? "" : "es"}; similar identifiers are not included.`);
  }

  async function inspectCorpusArchive(): Promise<void> {
    if (!corpusSourceName.trim()) {
      setCorpusStatus("Enter the dataset or source name before choosing an archive.");
      return;
    }
    if (sourceReferenceMayContainSecret(corpusSourceUrl)) {
      setCorpusStatus("Remove token-like query parameters from the source reference before importing.");
      return;
    }
    const result = await invoke("corpus:archive-inspect", {
      accessBasis: corpusAccessBasis,
      sourceName: corpusSourceName.trim(),
      ...(corpusSourceUrl.trim() ? { sourceUrl: corpusSourceUrl.trim() } : {}),
      ...(corpusSourceDate ? { sourceDate: corpusSourceDate } : {}),
      identifierType: corpusIdentifierType,
      identifierField: corpusIdentifierField
    });
    if (!result.ok) {
      setCorpusStatus(result.error.message);
      return;
    }
    if ("cancelled" in result.value) {
      setArchiveInspection(null);
      setArchiveEntryIndex(null);
      setCorpusStatus("Archive selection canceled.");
      return;
    }
    setArchiveInspection(result.value);
    const firstImportable = result.value.entries.find((entry) => entry.importable);
    setArchiveEntryIndex(firstImportable?.index ?? null);
    setCorpusStatus(`${result.value.entries.length} archive entr${result.value.entries.length === 1 ? "y" : "ies"} inspected · SHA-256 ${result.value.sha256.slice(0, 12)}… · paths are never extracted.`);
  }

  async function importCorpusArchiveEntry(): Promise<void> {
    if (!archiveInspection || archiveEntryIndex === null) {
      setCorpusStatus("Choose one supported CSV or JSON Lines entry first.");
      return;
    }
    const result = await invoke("corpus:archive-import", { sessionToken: archiveInspection.sessionToken, entryIndex: archiveEntryIndex });
    if (!result.ok) {
      setCorpusStatus(result.error.message);
      setArchiveInspection(null);
      setArchiveEntryIndex(null);
      return;
    }
    if (!result.value.manifest) {
      setCorpusStatus("Archive entry was not imported.");
      return;
    }
    const rowLabel = result.value.manifest.recordCount === 1 ? "row" : "rows";
    setCorpusStatus(`${result.value.reusedExistingImport ? "Already imported" : "Quarantined and indexed"}: ${archiveInspection.originalName} · ${result.value.manifest.recordCount.toLocaleString()} ${rowLabel} · SHA-256 ${result.value.manifest.sha256.slice(0, 12)}…`);
    setArchiveInspection(null);
    setArchiveEntryIndex(null);
  }

  async function sendSelectedToAgent(): Promise<void> {
    if (!selectedObservation) {
      return;
    }
    const targetCase = await ensureCase();
    if (!targetCase) {
      return;
    }
    const result = await invoke("agent:run", {
      agentId: selectedAgentId,
      seed: pivotSeedForObservation(run?.seed.type ?? seedType, selectedObservation),
      caseId: targetCase.id,
      missionBrief: missionBrief.trim() || undefined
    });
    if (result.ok) {
      // Shown as an interpretation, exactly as the run reported it: its citations and confidence are not recalculated here.
      setAssessment({
        agentName: agentName(agents, selectedAgentId),
        title: result.value.finding.title,
        summary: result.value.finding.summary,
        sources: result.value.finding.sources,
        confidence: result.value.finding.confidence,
        about: `${selectedObservation.type}: ${selectedObservation.value}`
      });
    }
    setStatus(result.ok ? `Sent to ${agentName(agents, selectedAgentId)} for ${targetCase.title}` : result.error.message);
  }

  async function ensureCase(): Promise<CaseRecord | null> {
    const existingOpenCase = cases.find((item) => item.status === "open") ?? firstItem(cases);
    if (existingOpenCase) {
      return existingOpenCase;
    }
    const createResult = await invoke("cases:create", { title: "Quick evidence", tags: ["search"] });
    if (!createResult.ok) {
      setStatus(createResult.error.message);
      return null;
    }
    const createdCase = valueAsCase(createResult.value);
    if (!createdCase) {
      setStatus("No case selected");
      return null;
    }
    setCases((current) => [createdCase, ...current]);
    return createdCase;
  }

  return (
    <section className="search-workspace" aria-labelledby="search-title">
      <aside className="search-rail" aria-label="Search workspace rail">
        <RailBlock icon={<Briefcase size={16} aria-hidden="true" />} title="Cases">
          {cases.slice(0, 6).map((item) => (
            <button className="rail-item" type="button" key={item.id} onClick={() => setMissionBrief(`Work this search into ${item.title}.`)}>
              <span>{item.title}</span>
              <small>{item.status}</small>
            </button>
          ))}
          {cases.length === 0 ? <p className="status-text">No cases yet.</p> : null}
        </RailBlock>

        <RailBlock icon={<Radar size={16} aria-hidden="true" />} title="Data monitoring">
          {watches.slice(0, 5).map((watch) => (
            <button
              className="rail-item"
              type="button"
              key={watch.id}
              onClick={() => {
                setSeedType(watch.type);
                setSeedValue(watch.value);
              }}
            >
              <span>{watch.value}</span>
              <small>{watch.lastCheckedTs ? "checked" : "new watch"}</small>
            </button>
          ))}
          {alerts.length > 0 ? <span className="rail-alert">{alerts.length} open alerts</span> : null}
          {watches.length === 0 ? <p className="status-text">No watch targets yet.</p> : null}
        </RailBlock>

        <RailBlock icon={<Bot size={16} aria-hidden="true" />} title="Agent plugins">
          {agents.map((agent) => (
            <button
              className="rail-item"
              type="button"
              aria-pressed={selectedAgentId === agent.id}
              key={agent.id}
              onClick={() => setSelectedAgentId(agent.id)}
            >
              <span>{agent.name}</span>
              <small>{agent.provider} / {agent.model}</small>
            </button>
          ))}
        </RailBlock>
      </aside>

      <main className="search-main" aria-labelledby="search-title">
        <div className="search-hero">
          <div>
            <p className="console-line">OSINT search console</p>
            <h1 className="route-title" id="search-title">
              Search
            </h1>
            <p className="route-summary">Ready when you are.</p>
          </div>
          <div className="search-effort-control" role="radiogroup" aria-label="Search effort">
            {effortOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                className="effort-button"
                aria-checked={effort === option.id}
                role="radio"
                onClick={() => setEffort(option.id)}
              >
                <span>{option.label}</span>
                <small>{option.hint}</small>
              </button>
            ))}
          </div>
        </div>

        <section className="search-composer" aria-label="OSINT search composer">
          <div className="composer-grid">
            <label className="compact-field">
              Seed type
              <select className="field-control" value={seedType} onChange={(event) => setSeedType(event.target.value as SeedType)}>
                {seedTypeValues.map((value) => (
                  <option key={value} value={value}>
                    {value === "uei" ? "UEI (federal recipient)" : value === "cik" ? "SEC CIK (exact filer)" : value === "ein" ? "EIN (exact organization)" : value}
                  </option>
                ))}
              </select>
            </label>
            <label className="compact-field composer-seed">
              Search
              <div className="composer-input-shell">
                <SearchIcon size={18} aria-hidden="true" />
                <input className="composer-input" value={seedValue} onChange={(event) => setSeedValue(event.target.value)} />
              </div>
            </label>
            {seedType === "parcel" && (
              <label className="compact-field">
              Parcel jurisdiction
                <input className="field-control" value={seedJurisdiction} onChange={(event) => setSeedJurisdiction(event.target.value)} placeholder="US-IL-COOK" required aria-describedby="parcel-jurisdiction-help" />
                <small id="parcel-jurisdiction-help">For US-IL-COOK, the exact 14-digit PIN is sent to Cook County’s public API. Only current-year class, township, and neighborhood metadata are requested.</small>
              </label>
            )}
            <button className="composer-icon-button" type="button" aria-label="Search" title="Search" onClick={() => void runSearch()}>
              <Play size={18} aria-hidden="true" />
            </button>
            <button className="composer-icon-button" type="button" aria-label="Cancel search" title="Cancel search" disabled={!activeRunId} onClick={() => void cancelSearch()}>
              <Square size={18} aria-hidden="true" />
            </button>
          </div>
          <label className="compact-field">
            Mission brief for agent handoff
            <textarea className="field-control mission-brief-input" value={missionBrief} onChange={(event) => setMissionBrief(event.target.value)} />
          </label>
          <div className="search-quick-tools">
            <label className="compact-field">
              Image path
              <input className="field-control" value={imagePath} onChange={(event) => setImagePath(event.target.value)} />
            </label>
            <button className="action-button" type="button" onClick={() => void pickImage()}>
              <FolderOpen size={16} aria-hidden="true" />
              Browse image
            </button>
            <button className="action-button" type="button" onClick={() => void searchImage()}>
              <ImageIcon size={16} aria-hidden="true" />
              Search image
            </button>
            <label className="compact-field">
              Username
              <input className="field-control" value={username} onChange={(event) => setUsername(event.target.value)} />
            </label>
            <button className="action-button" type="button" onClick={() => void usernameSweep()}>
              <Users size={16} aria-hidden="true" />
              Username sweep
            </button>
          </div>
          <span className="status-text" role="status">{status}</span>
        </section>

        <OsintResultsView
          seed={run?.seed ?? activeSeed}
          run={run}
          phase={activeRunId ? "running" : run ? "complete" : "idle"}
          runKey={activeRunId ?? run?.runId ?? null}
          cancelled={cancelledRunId !== null && cancelledRunId === (run?.runId ?? activeRunId)}
          effort={effortLabel(effort)}
          statuses={effectiveStatuses}
          observations={observations}
          selectedObservationId={selectedObservation?.id ?? null}
          onSelectObservation={setSelectedObservationId}
          assessment={assessment}
          detailActions={
            selectedObservation ? (
              <>
                <button className="action-button" type="button" onClick={() => void saveSelectedObservation()}>
                  <Save size={16} aria-hidden="true" />
                  Save node
                </button>
                {selectedObservation.kind !== "discovery" && <details className="entity-graph-save-menu">
                  <summary>Save as entity</summary>
                  <div className="entity-graph-save-fields">
                    <label className="compact-field">Display label
                      <input className="field-control" value={graphEntityLabel} maxLength={200} onChange={(event) => setGraphEntityLabel(event.target.value)} placeholder={selectedObservation.entity} />
                    </label>
                    <label className="compact-field">Entity type
                      <select className="field-control" value={graphEntityType} onChange={(event) => setGraphEntityType(event.target.value as EntityType)}>
                        {entityTypeValues.map((type) => <option value={type} key={type}>{type}</option>)}
                      </select>
                    </label>
                    <button className="action-button" type="button" onClick={() => void saveSelectedObservationAsEntity()}>Save cited evidence</button>
                    <small>This creates a separate entity and source assertion. It never merges records with similar names or identifiers.</small>
                  </div>
                </details>}
                <button className="action-button" type="button" onClick={() => void sendSelectedToAgent()}>
                  <Bot size={16} aria-hidden="true" />
                  Send to agent
                </button>
                <button
                  className="action-button"
                  type="button"
                  onClick={() => void runSearch(pivotSeedForObservation(run?.seed.type ?? seedType, selectedObservation))}
                >
                  <GitBranch size={16} aria-hidden="true" />
                  Pivot
                </button>
              </>
            ) : null
          }
        />

        <section className="detail-section" aria-label="Website preview">
          <div className="output-header">
            <h2 className="section-title">Website preview</h2>
            <Globe size={18} aria-hidden="true" />
          </div>
          {previewUrl ? (
            <iframe className="website-preview" title={`Preview of ${previewUrl}`} src={previewUrl} sandbox="allow-same-origin allow-scripts" />
          ) : (
            <p className="status-text">Domain searches show a live website preview here.</p>
          )}
        </section>

        <section className="detail-section corpus-workspace" aria-labelledby="corpus-title">
          <div className="output-header">
            <Database size={18} aria-hidden="true" />
            <div>
              <h2 className="section-title" id="corpus-title">Local corpus</h2>
              <p className="status-text">CSV / JSON Lines, one selected table entry from ZIP, or selectable text from PDF. Imports stay local and are never sent to an AI model. PDF extraction is limited to 25 MiB, 200 pages, 128 KiB/page, 5 MiB total text and 20 seconds; OCR is not included. Source/access details are your declarations, not independently verified.</p>
            </div>
          </div>
          <div className="corpus-import-grid">
            <label className="compact-field">Declared access basis
              <select className="field-control" value={corpusAccessBasis} disabled={Boolean(archiveInspection)} onChange={(event) => setCorpusAccessBasis(event.target.value as "public" | "authorized")}>
                <option value="public">Public dataset</option>
                <option value="authorized">I’m authorized to use it</option>
              </select>
            </label>
            <label className="compact-field">Source or dataset name
              <input className="field-control" value={corpusSourceName} disabled={Boolean(archiveInspection)} onChange={(event) => setCorpusSourceName(event.target.value)} maxLength={200} placeholder="Dataset title / publisher" />
            </label>
              <label className="compact-field">Source reference (stored, not fetched)
                <input className="field-control" type="url" value={corpusSourceUrl} disabled={Boolean(archiveInspection)} onChange={(event) => setCorpusSourceUrl(event.target.value)} placeholder="https://…" />
                {sourceReferenceMayContainSecret(corpusSourceUrl) ? <span className="status-text" role="alert">This link appears to include a token or secret in its query string. Remove it before importing.</span> : null}
              </label>
            <label className="compact-field">Source date (optional)
              <input className="field-control" type="date" value={corpusSourceDate} disabled={Boolean(archiveInspection)} onChange={(event) => setCorpusSourceDate(event.target.value)} />
            </label>
            <label className="compact-field">Identifier type
              <input className="field-control" value={corpusIdentifierType} disabled={Boolean(archiveInspection)} onChange={(event) => setCorpusIdentifierType(event.target.value)} maxLength={64} placeholder="uei, parcel_id:WA, …" />
            </label>
            <label className="compact-field">Identifier column / field
              <input className="field-control" value={corpusIdentifierField} disabled={Boolean(archiveInspection)} onChange={(event) => setCorpusIdentifierField(event.target.value)} maxLength={128} />
            </label>
              <button className="action-button" type="button" onClick={() => void importCorpus()} disabled={sourceReferenceMayContainSecret(corpusSourceUrl)}>
                <FileUp size={16} aria-hidden="true" />
                Choose file and import
              </button>
              <button className="action-button" type="button" onClick={() => void inspectCorpusArchive()} disabled={sourceReferenceMayContainSecret(corpusSourceUrl)}>
                <FileUp size={16} aria-hidden="true" />
                Choose ZIP archive
              </button>
              <button className="action-button" type="button" onClick={() => void importPdfText()} disabled={sourceReferenceMayContainSecret(corpusSourceUrl)}>
                <FileUp size={16} aria-hidden="true" />
                Choose PDF and index text
              </button>
              <button className="action-button" type="button" onClick={() => void importDocxText()} disabled={sourceReferenceMayContainSecret(corpusSourceUrl)}>
                <FileUp size={16} aria-hidden="true" />
                Choose DOCX and index text
              </button>
              <button className="action-button" type="button" onClick={() => void importPptxText()} disabled={sourceReferenceMayContainSecret(corpusSourceUrl)}>
                <FileUp size={16} aria-hidden="true" />
                Choose PPTX and index text
              </button>
              <button className="action-button" type="button" onClick={() => void importXlsxText()} disabled={sourceReferenceMayContainSecret(corpusSourceUrl)}>
                <FileUp size={16} aria-hidden="true" />
                Choose XLSX and index cell values
              </button>
            </div>
            <p className="status-text">XLSX imports keep visible-sheet cell values and sheet/cell citations on this computer. Formulas, hidden sheets, macros, links, and embedded objects are excluded; date-like numeric values stay raw and are not interpreted. Workbook text is not sent to AI.</p>
            {archiveInspection ? (
              <>
              <p className="status-text" role="note">Source and identifier details above are locked to the values captured when this archive was inspected. Choose another archive to refresh its review.</p>
              <div className="corpus-search-row">
                <label className="compact-field">Supported entry in {archiveInspection.originalName}
                  <select className="field-control" value={archiveEntryIndex ?? ""} onChange={(event) => setArchiveEntryIndex(event.target.value ? Number(event.target.value) : null)}>
                    <option value="">Select an importable entry</option>
                    {archiveInspection.entries.map((entry) => <option key={entry.index} value={entry.index} disabled={!entry.importable}>{entry.filename}{entry.importable ? ` · ${(entry.uncompressedSize / 1024).toFixed(1)} KiB` : ` · ${entry.reason ?? "Not importable"}`}</option>)}
                  </select>
                </label>
                <button className="action-button" type="button" onClick={() => void importCorpusArchiveEntry()} disabled={archiveEntryIndex === null}>Import selected entry</button>
              </div>
              </>
            ) : null}
          <div className="corpus-search-row">
            <label className="compact-field">Exact identifier lookup
              <input className="field-control" value={corpusLookupValue} onChange={(event) => setCorpusLookupValue(event.target.value)} maxLength={256} placeholder="Exact value; no fuzzy matching" />
            </label>
            <button className="action-button" type="button" onClick={() => void searchCorpus()}><SearchIcon size={16} aria-hidden="true" />Search local records</button>
          </div>
          <div className="corpus-search-row">
            <label className="compact-field">Search indexed DOCX paragraphs
              <input className="field-control" value={docxTextQuery} onChange={(event) => setDocxTextQuery(event.target.value)} maxLength={256} minLength={3} placeholder="At least three characters" />
            </label>
            <button className="action-button" type="button" onClick={() => void searchDocxText()}><SearchIcon size={16} aria-hidden="true" />Search DOCX text</button>
          </div>
          <div className="corpus-search-row">
            <label className="compact-field">Search indexed PPTX slides
              <input className="field-control" value={pptxTextQuery} onChange={(event) => setPptxTextQuery(event.target.value)} maxLength={256} minLength={3} placeholder="At least three characters" />
            </label>
            <button className="action-button" type="button" onClick={() => void searchPptxText()}><SearchIcon size={16} aria-hidden="true" />Search PPTX text</button>
          </div>
          <div className="corpus-search-row">
            <label className="compact-field">Search indexed XLSX cell values
              <input className="field-control" value={xlsxTextQuery} onChange={(event) => setXlsxTextQuery(event.target.value)} maxLength={256} minLength={3} placeholder="At least three characters" />
            </label>
            <button className="action-button" type="button" onClick={() => void searchXlsxText()}><SearchIcon size={16} aria-hidden="true" />Search XLSX cells</button>
          </div>
          <div className="corpus-search-row">
            <label className="compact-field">Search indexed PDF pages
              <input className="field-control" value={pdfTextQuery} onChange={(event) => setPdfTextQuery(event.target.value)} maxLength={256} minLength={3} placeholder="At least three characters" />
            </label>
            <button className="action-button" type="button" onClick={() => void searchPdfText()}><SearchIcon size={16} aria-hidden="true" />Search PDF text</button>
          </div>
          <p className="status-text" role="status">{corpusStatus}</p>
          {corpusResults.length > 0 ? (
            <ul className="corpus-result-list" aria-label="Exact local corpus matches">
              {corpusResults.map((item) => (
                <li className="corpus-result" key={item.id}>
                  <div><strong>{item.sourceName}</strong><span>{item.locator} · {item.identifierType}: {item.identifierValue}</span></div>
                  <small>Access basis: {item.accessBasis} · SHA-256 {item.sha256.slice(0, 12)}…{item.sourceDate ? ` · ${item.sourceDate}` : ""}</small>
                  <details><summary>View inert record data</summary><pre>{JSON.stringify(item.record, null, 2)}</pre></details>
                  {item.sourceUrl ? <a href={item.sourceUrl} target="_blank" rel="noreferrer">Source reference</a> : null}
                </li>
              ))}
            </ul>
          ) : null}
          {pdfTextResults.length > 0 ? (
            <ul className="corpus-result-list" aria-label="Local PDF page matches">
              {pdfTextResults.map((item) => (
                <li className="corpus-result" key={`${item.importId}-${item.pageNumber}`}>
                  <div><strong>{item.sourceName}</strong><span>{item.originalName} · PDF page {item.pageNumber}</span></div>
                  <small>Access basis: {item.accessBasis} · SHA-256 {item.sha256.slice(0, 12)}…{item.sourceDate ? ` · ${item.sourceDate}` : ""}</small>
                  <p>{item.excerpt}</p>
                </li>
              ))}
            </ul>
          ) : null}
          {docxTextResults.length > 0 ? (
            <ul className="corpus-result-list" aria-label="Local DOCX paragraph matches">
              {docxTextResults.map((item) => (
                <li className="corpus-result" key={`${item.importId}-${item.paragraphNumber}`}>
                  <div><strong>{item.sourceName}</strong><span>{item.originalName} · Word paragraph {item.paragraphNumber}</span></div>
                  <small>Access basis: {item.accessBasis} · SHA-256 {item.sha256.slice(0, 12)}…{item.sourceDate ? ` · ${item.sourceDate}` : ""}</small>
                  <p>{item.excerpt}</p>
                </li>
              ))}
            </ul>
          ) : null}
          {pptxTextResults.length > 0 ? (
            <ul className="corpus-result-list" aria-label="Local PPTX slide matches">
              {pptxTextResults.map((item) => (
                <li className="corpus-result" key={`${item.importId}-${item.slideNumber}`}>
                  <div><strong>{item.sourceName}</strong><span>{item.originalName} · PowerPoint slide {item.slideNumber}</span></div>
                  <small>Access basis: {item.accessBasis} · SHA-256 {item.sha256.slice(0, 12)}…{item.sourceDate ? ` · ${item.sourceDate}` : ""}</small>
                  <p>{item.excerpt}</p>
                </li>
              ))}
            </ul>
          ) : null}
          {xlsxTextResults.length > 0 ? (
            <ul className="corpus-result-list" aria-label="Local XLSX cell matches">
              {xlsxTextResults.map((item) => (
                <li className="corpus-result" key={`${item.importId}-${item.sheetName}-${item.cellRef}`}>
                  <div><strong>{item.sourceName}</strong><span>{item.originalName} · {item.sheetName}!{item.cellRef}</span></div>
                  <small>Access basis: {item.accessBasis} · SHA-256 {item.sha256.slice(0, 12)}…{item.sourceDate ? ` · ${item.sourceDate}` : ""}</small>
                  <p>{item.excerpt}</p>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </main>
    </section>
  );
}

function RailBlock(props: { readonly icon: ReactNode; readonly title: string; readonly children: ReactNode }) {
  return (
    <div className="rail-block">
      <div className="rail-title-row">
        {props.icon}
        <span>{props.title}</span>
      </div>
      <div className="rail-list">{props.children}</div>
    </div>
  );
}

function websitePreviewUrl(seed: SearchSeed): string | null {
  if (seed.type !== "domain" || !seed.value.trim()) {
    return null;
  }
  const value = seed.value.trim();
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function pivotSeedForObservation(fallbackType: SeedType, observation: Observation): SearchSeed {
  const type = seedTypeValues.includes(observation.type as SeedType) ? (observation.type as SeedType) : fallbackType;
  return { type, value: observation.raw?.treeNodeId ? observation.entity : observation.value };
}

function agentName(agents: readonly AgentRecord[], agentId: string): string {
  if (agentId === "osint-agent") {
    return agents.find((agent) => agent.id === agentId)?.name ?? "OSINT agent";
  }
  return agents.find((agent) => agent.id === agentId)?.name ?? agentId;
}

function firstItem<T>(items: readonly T[]): T | null {
  for (const item of items) {
    return item;
  }
  return null;
}

function valueAsCase(value: unknown): CaseRecord | null {
  if (!value || typeof value !== "object" || !("case" in value)) {
    return null;
  }
  return isCaseRecord(value.case) ? value.case : null;
}

function isCaseRecord(value: unknown): value is CaseRecord {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Partial<CaseRecord>;
  return typeof candidate.id === "string" && typeof candidate.title === "string" && typeof candidate.status === "string";
}

function effortLabel(effort: SearchEffort): string {
  return effortOptions.find((option) => option.id === effort)?.label ?? "Standard";
}
