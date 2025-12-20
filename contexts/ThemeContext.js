import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

// Helper to get initial theme from localStorage (runs only on client)
const getInitialTheme = () => {
  if (typeof window !== 'undefined') {
    const savedTheme = localStorage.getItem('piks-theme');
    if (savedTheme) {
      return savedTheme === 'dark';
    }
  }
  return true; // Default to dark mode
};

export function ThemeProvider({ children }) {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('piks-theme');
    if (savedTheme) {
      setIsDarkMode(savedTheme === 'dark');
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    localStorage.setItem('piks-theme', isDarkMode ? 'dark' : 'light');
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

  // Prevent flash by not rendering children until mounted
  if (!mounted) {
    return (
      <ThemeContext.Provider value={{ isDarkMode: true, toggleTheme }}>
        <div style={{ visibility: 'hidden' }}>{children}</div>
      </ThemeContext.Provider>
    );
  }

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
