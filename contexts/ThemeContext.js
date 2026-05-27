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
const DEFAULT_THEME = 'dark';

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
  const [theme, setThemeState] = useState(DEFAULT_THEME);

  // Hydrate from localStorage on mount. The `_document.js` inline
  // script has already applied the right class, so this just brings
  // React state in sync — no visible flicker.
  useEffect(() => {
    const stored = readStoredTheme();
    setThemeState(stored);
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
