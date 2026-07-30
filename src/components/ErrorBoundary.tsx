import { Component, type ErrorInfo, type ReactNode } from "react";

interface State {
  failed: boolean;
}

/**
 * Last line of defence: a render error must not leave the user staring at a
 * blank page after waiting minutes for an analysis.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("Render failed", error, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-md rounded-2xl border border-line bg-surface p-6 text-center">
          <h1 className="font-medium">Zobrazenie sa nečakane prerušilo</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Analýza mohla prebehnúť správne, len sa ju nepodarilo vykresliť. Skúste stránku načítať
            znova — hotový výsledok sa načíta okamžite.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-canvas transition hover:bg-accent-strong"
          >
            Načítať znova
          </button>
        </div>
      </div>
    );
  }
}
