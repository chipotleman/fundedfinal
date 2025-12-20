import { createContext, useContext, useState, useEffect, useRef } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('piks-theme');
    if (savedTheme) {
      setIsDarkMode(savedTheme === 'dark');
    }
    hasLoadedRef.current = true;
  }, []);

  useEffect(() => {
    if (hasLoadedRef.current) {
      localStorage.setItem('piks-theme', isDarkMode ? 'dark' : 'light');
    }
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
