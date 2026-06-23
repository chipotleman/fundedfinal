import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

// Light/dark theme state machine. Persists to localStorage as
// `piks-theme` and toggles the `light` / `dark` classes on
// `<html>` so global CSS rules (in `styles/globals.css`) can react.
//
// IMPORTANT: the first-paint class is applied by a tiny inline script
// in `pages/_document.js` so users on light mode don't flash the
// dark background before this provider hydrates. This context just
// keeps state in sync after hydration and writes future changes back
// to localStorage.

const STORAGE_KEY = 'piks-theme';
const DEFAULT_THEME = 'light';

const ThemeContext = createContext({
  theme: DEFAULT_THEME,
  setTheme: () => {},
  toggleTheme: () => {},
});

function applyThemeClass(theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'light') {
    root.classList.add('light');
    root.classList.remove('dark');
    root.setAttribute('data-theme', 'light');
  } else {
    root.classList.add('dark');
    root.classList.remove('light');
    root.setAttribute('data-theme', 'dark');
  }
}

function readStoredTheme() {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch (_e) {}
  return DEFAULT_THEME;
}

export function ThemeProvider({ children }) {
  // Initialize synchronously on the client from the class the `_document.js`
  // inline script already applied before paint (falling back to localStorage).
  // This way the very first React render uses the correct theme, so
  // JS-derived inline styles (e.g. the search bar, leaderboard surfaces)
  // don't flash dark before a post-paint effect corrects them.
  const [theme, setThemeState] = useState(() => {
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      if (root.classList.contains('light')) return 'light';
      if (root.classList.contains('dark')) return 'dark';
      return readStoredTheme();
    }
    return DEFAULT_THEME;
  });

  // Keep state/class in sync after mount as a safety net (covers any edge
  // where the lazy initializer couldn't read the DOM).
  useEffect(() => {
    const stored = readStoredTheme();
    setThemeState((prev) => (prev === stored ? prev : stored));
    applyThemeClass(stored);
  }, []);

  const setTheme = useCallback((next) => {
    const safe = next === 'light' ? 'light' : 'dark';
    setThemeState(safe);
    applyThemeClass(safe);
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, safe);
      }
    } catch (_e) {}
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  }, [theme, setTheme]);

  const value = useMemo(() => ({ theme, setTheme, toggleTheme }), [theme, setTheme, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
