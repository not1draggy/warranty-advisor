import { useEffect } from "react";

const BASE_TITLE = "Warranty Advisor";

/**
 * Mirrors the current state in the tab title.
 *
 * Research runs for one to three minutes, so people switch away. The title is
 * what tells them the verdict has landed without switching back.
 */
export function useDocumentTitle(title: string | null): void {
  useEffect(() => {
    document.title = title ? `${title} · ${BASE_TITLE}` : BASE_TITLE;
    return () => {
      document.title = BASE_TITLE;
    };
  }, [title]);
}
