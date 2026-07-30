import { useEffect, useState } from "react";

type Theme = "dark" | "light";

const STORAGE_KEY = "wa-theme";

/**
 * Dark is the product default, matching the `data-theme` already on <html> so
 * the first paint is never corrected. Light is opt-in and remembered.
 */
function initialTheme(): Theme {
  return localStorage.getItem(STORAGE_KEY) === "light" ? "light" : "dark";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const next = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={next === "light" ? "Prepnúť na svetlý režim" : "Prepnúť na tmavý režim"}
      className="rounded-full border border-line px-3 py-1.5 text-xs text-muted transition hover:border-accent hover:text-accent"
    >
      {/* Shows the mode you switch to, so the control reads as an action. */}
      <span aria-hidden="true">{next === "light" ? "☀" : "☾"}</span>
      <span className="ml-2">{next === "light" ? "Svetlý režim" : "Tmavý režim"}</span>
    </button>
  );
}
