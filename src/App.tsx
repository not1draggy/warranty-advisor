import { useCallback, useEffect, useRef, useState } from "react";
import { AnalysisReport } from "./components/AnalysisReport";
import { ComparisonView } from "./components/ComparisonView";
import { HowItWorks } from "./components/HowItWorks";
import { LoadingSteps } from "./components/LoadingSteps";
import { PrivacyNote } from "./components/PrivacyNote";
import { SearchHero } from "./components/SearchHero";
import { RecentAnalyses } from "./components/RecentAnalyses";
import { StateNotice } from "./components/StateNotice";
import { analyze, type FailureReason } from "./lib/api";
import { parseComparison, type ParsedQuery } from "./lib/query";
import { resolveOutcomes } from "./lib/outcome";
import type { AnalysisEvidence } from "../shared/analysis";
import type { Candidate } from "../shared/compare";
import { VERDICT } from "../shared/format";
import { scoreAnalysis } from "../shared/scoring";
import { clearHistory, readHistory, recordAnalysis, type HistoryEntry } from "./lib/history";
import { useDocumentTitle } from "./lib/useDocumentTitle";

type View =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; evidence: AnalysisEvidence; query: ParsedQuery; live: boolean }
  | { kind: "compared"; candidates: Candidate[] }
  | { kind: "failed"; reason: FailureReason };

/**
 * Tab title for the current state. Research takes minutes, so people switch
 * away — the verdict in the title is how they learn it has landed.
 */
function titleFor(view: View): string | null {
  switch (view.kind) {
    case "loading":
      return "Analyzujem…";
    case "ready":
      return `${VERDICT[scoreAnalysis(view.evidence).verdict].icon} ${view.evidence.product.model}`;
    case "compared":
      return `Porovnanie ${view.candidates.length} výrobkov`;
    default:
      return null;
  }
}

/** Keeps the address bar in step with the result so it can be shared or reloaded. */
function syncUrl(query: string | null): void {
  const url = new URL(window.location.href);
  if (query) url.searchParams.set("q", query);
  else url.searchParams.delete("q");
  window.history.replaceState(null, "", url);
}

export default function App() {
  const [view, setView] = useState<View>({ kind: "idle" });
  const [history, setHistory] = useState<HistoryEntry[]>(readHistory);
  const lastQuery = useRef<string>("");
  const inFlight = useRef<AbortController | null>(null);

  const runSearch = useCallback(async (raw: string) => {
    const parts = parseComparison(raw);
    if (parts.length === 0) return;

    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;

    lastQuery.current = raw;
    syncUrl(raw);
    setView({ kind: "loading" });

    try {
      // Researched together: waiting out two runs back to back would double a
      // wait that is already minutes long.
      const outcomes = await Promise.all(
        parts.map((part) => analyze(part.product, controller.signal)),
      );
      if (controller.signal.aborted) return;

      const resolved = resolveOutcomes(parts, outcomes);

      if (resolved.kind !== "failed") {
        const shortlisted =
          resolved.kind === "compared"
            ? resolved.candidates
            : [{ query: resolved.evidence.product.model, evidence: resolved.evidence }];

        for (const entry of shortlisted) {
          const score = scoreAnalysis(entry.evidence);
          setHistory(
            recordAnalysis({
              query: entry.query,
              model: entry.evidence.product.model,
              verdict: score.verdict,
              risk: score.ownershipRisk,
            }),
          );
        }
      }

      setView(resolved);
    } catch {
      // An abort means a newer search took over and owns the view now.
      // Anything else must surface, or the user is stranded on the spinner.
      if (!controller.signal.aborted) setView({ kind: "failed", reason: "upstream_error" });
    } finally {
      if (inFlight.current === controller) inFlight.current = null;
    }
  }, []);

  // Restore a shared or reloaded result.
  useEffect(() => {
    const query = new URL(window.location.href).searchParams.get("q");
    if (query) void runSearch(query);
  }, [runSearch]);

  useEffect(() => () => inFlight.current?.abort(), []);

  useDocumentTitle(titleFor(view));

  return (
    <div className="flex min-h-screen flex-col">
      <SearchHero
        onSearch={(query) => void runSearch(query)}
        busy={view.kind === "loading"}
        compact={view.kind === "ready" || view.kind === "compared"}
      />

      <main className="flex-1">
        {view.kind === "idle" && (
          <>
            <div className="px-4">
              <RecentAnalyses
                entries={history}
                onPick={(query) => void runSearch(query)}
                onClear={() => {
                  clearHistory();
                  setHistory([]);
                }}
              />
            </div>
            <HowItWorks />
          </>
        )}

        {view.kind === "loading" && <LoadingSteps />}

        {view.kind === "failed" && (
          <StateNotice reason={view.reason} onRetry={() => void runSearch(lastQuery.current)} />
        )}

        {view.kind === "ready" && (
          <AnalysisReport evidence={view.evidence} query={view.query} live={view.live} />
        )}

        {view.kind === "compared" && <ComparisonView candidates={view.candidates} />}
      </main>

      <footer className="border-t border-line pt-8 print:hidden">
        <PrivacyNote />
        <p className="pb-6 text-center text-xs text-subtle">
          Warranty Advisor · {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  );
}
