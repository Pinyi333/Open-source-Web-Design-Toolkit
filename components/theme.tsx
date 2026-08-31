"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";

export type Theme = "dark" | "light" | "system";

const STORAGE_KEY = "wdt-theme";
const CHANGE_EVENT = "wdt-theme-change";

interface ThemeContextValue {
  /** What the user chose, which may be "system". */
  theme: Theme;
  /** What is actually on screen, with "system" resolved. */
  resolved: "dark" | "light";
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Runs before React hydrates so the page never paints in the wrong theme.
 * Deliberately tiny and defensive: a browser with storage disabled throws on
 * localStorage access, and a flash of the wrong theme is not worth a crash.
 */
export const themeScript = `
(function () {
  try {
    var stored = localStorage.getItem("${STORAGE_KEY}");
    var theme = stored === "light" || stored === "dark" ? stored
      : (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    document.documentElement.classList.add(theme);
  } catch (e) {
    document.documentElement.classList.add("dark");
  }
})();
`;

/**
 * The stored preference lives in localStorage, which React does not own, so it
 * is read through useSyncExternalStore. That keeps the server and the first
 * client render in agreement while still picking up the real value straight
 * after hydration — and avoids the cascading render that setting state inside
 * an effect would cause.
 */
function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  // Fires when another tab changes the preference.
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readStoredTheme(): Theme {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === "light" || value === "dark" || value === "system") return value;
  } catch {
    // Storage unavailable; fall back to following the system.
  }
  return "system";
}

function subscribeToSystem(onChange: () => void): () => void {
  const media = window.matchMedia("(prefers-color-scheme: light)");
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function readSystemTheme(): "dark" | "light" {
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

/** Server and first-paint fallback. The inline script has the real answer. */
const serverTheme = (): Theme => "system";
const serverSystem = (): "dark" | "light" => "dark";

function applyTheme(resolved: "dark" | "light") {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(resolved);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribe, readStoredTheme, serverTheme);
  const system = useSyncExternalStore(
    subscribeToSystem,
    readSystemTheme,
    serverSystem,
  );

  const resolved = theme === "system" ? system : theme;

  const setTheme = useCallback((next: Theme) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // The preference will not persist, but the page still switches.
    }
    applyTheme(next === "system" ? readSystemTheme() : next);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  const value = useMemo(
    () => ({ theme, resolved, setTheme }),
    [theme, resolved, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used inside <ThemeProvider>");
  }
  return context;
}
