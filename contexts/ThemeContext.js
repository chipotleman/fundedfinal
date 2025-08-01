
import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(true);

  useEffect(() => {
    // Check for saved theme preference or default to dark mode
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      setIsDarkMode(savedTheme === 'dark');
    } else {
      // Check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setIsDarkMode(prefersDark);
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    localStorage.setItem('theme', newTheme ? 'dark' : 'light');
  };

  const theme = {
    isDarkMode,
    toggleTheme,
    colors: isDarkMode ? {
      // Dark theme colors
      bg: {
        primary: 'bg-slate-900',
        secondary: 'bg-slate-800',
        tertiary: 'bg-slate-700',
        accent: 'bg-slate-600'
      },
      text: {
        primary: 'text-white',
        secondary: 'text-gray-300',
        accent: 'text-gray-400'
      },
      border: 'border-slate-700',
      hover: 'hover:bg-slate-700'
    } : {
      // Light theme colors
      bg: {
        primary: 'bg-white',
        secondary: 'bg-gray-100',
        tertiary: 'bg-gray-200',
        accent: 'bg-gray-300'
      },
      text: {
        primary: 'text-gray-900',
        secondary: 'text-gray-700',
        accent: 'text-gray-600'
      },
      border: 'border-gray-300',
      hover: 'hover:bg-gray-100'
    }
  };

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
};
