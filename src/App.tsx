import { useCallback, useEffect, useRef, useState } from "react";
import { AnalysisReport } from "./components/AnalysisReport";
import { HowItWorks } from "./components/HowItWorks";
import { LoadingSteps } from "./components/LoadingSteps";
import { SearchHero } from "./components/SearchHero";
import { RecentAnalyses } from "./components/RecentAnalyses";
import { StateNotice } from "./components/StateNotice";
import { analyze, type FailureReason } from "./lib/api";
import { parseQuery, type ParsedQuery } from "./lib/query";
import type { AnalysisEvidence } from "../shared/analysis";
import { VERDICT } from "../shared/format";
import { scoreAnalysis } from "../shared/scoring";
import { clearHistory, readHistory, recordAnalysis, type HistoryEntry } from "./lib/history";
import { useDocumentTitle } from "./lib/useDocumentTitle";

type View =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; evidence: AnalysisEvidence; query: ParsedQuery; live: boolean }
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
    const parsed = parseQuery(raw);
    if (!parsed.product) return;

    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;

    lastQuery.current = raw;
    syncUrl(raw);
    setView({ kind: "loading" });

    try {
      const outcome = await analyze(parsed.product, controller.signal);
      if (controller.signal.aborted) return;

      if (outcome.status === "ready") {
        const score = scoreAnalysis(outcome.evidence);
        setHistory(
          recordAnalysis({
            query: raw,
            model: outcome.evidence.product.model,
            verdict: score.verdict,
            risk: score.ownershipRisk,
          }),
        );
        setView({ kind: "ready", evidence: outcome.evidence, query: parsed, live: outcome.live });
      } else {
        setView({ kind: "failed", reason: outcome.reason });
      }
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
        compact={view.kind === "ready"}
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
      </main>

      <footer className="border-t border-line py-6 text-center text-xs text-subtle print:hidden">
        Warranty Advisor · {new Date().getFullYear()}
      </footer>
    </div>
  );
}
