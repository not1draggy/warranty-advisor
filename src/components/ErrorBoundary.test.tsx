/**
 * The last line of defence.
 *
 * This exists for one moment: a render fault after the user has waited minutes
 * for an analysis. If it were broken they would get a blank page instead of a
 * blank page with an explanation — and nothing was checking, which is a poor
 * state for a safety net to be in.
 *
 * Rendered statically, so this covers the boundary's own behaviour rather than
 * React's recovery machinery.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary";

function Exploding(): never {
  throw new Error("render blew up");
}

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

afterEach(() => {
  vi.restoreAllMocks();
});

describe("when everything below it is fine", () => {
  it("stays out of the way", () => {
    const html = renderToStaticMarkup(
      <ErrorBoundary>
        <p>Analýza</p>
      </ErrorBoundary>,
    );

    expect(text(html)).toContain("Analýza");
    expect(text(html)).not.toContain("prerušilo");
  });
});

describe("when a render fault reaches it", () => {
  /** Static rendering does not run boundaries, so drive the state directly. */
  function caught() {
    const boundary = new ErrorBoundary({ children: <Exploding /> });
    boundary.state = ErrorBoundary.getDerivedStateFromError();
    return renderToStaticMarkup(<>{boundary.render()}</>);
  }

  it("turns a blank page into an explanation", () => {
    const rendered = text(caught());

    expect(rendered).toContain("Zobrazenie sa nečakane prerušilo");
    // The distinction that matters after a long wait: the work may be fine.
    expect(rendered).toContain("Analýza mohla prebehnúť správne");
  });

  it("offers the one action that can recover", () => {
    // The finished analysis is cached, so a reload is genuinely instant rather
    // than another multi-minute wait.
    expect(text(caught())).toContain("Načítať znova");
  });

  it("records the fault instead of swallowing it", () => {
    // Without this the only trace of a render bug would be a user complaint.
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const boundary = new ErrorBoundary({ children: null });

    boundary.componentDidCatch(new Error("boom"), { componentStack: "<AnalysisReport>" });

    expect(logged).toHaveBeenCalled();
    expect(String(logged.mock.calls[0]?.[0])).toContain("Render failed");
  });

  it("says nothing that reads as a failed analysis", () => {
    // A render fault is not thin evidence, and must not be described as one.
    const rendered = text(caught()).toLowerCase();

    for (const phrase of ["nedostatok inform", "neznáme", "nenašli sa"]) {
      expect(rendered).not.toContain(phrase);
    }
  });
});
