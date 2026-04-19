import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { formatOdds as formatOddsBase } from '../utils/odds';

const UserPreferencesContext = createContext(null);

const DEFAULT_PREFS = {
  oddsFormat: 'american',
};

export const useUserPreferences = () => {
  const ctx = useContext(UserPreferencesContext);
  if (!ctx) {
    return {
      ...DEFAULT_PREFS,
      formatOdds: (o) => formatOddsBase(o, 'american'),
      setOddsFormat: () => {},
      refresh: () => {},
    };
  }
  return ctx;
};

export const UserPreferencesProvider = ({ children }) => {
  const { data: session, status } = useSession();
  const [oddsFormat, setOddsFormatState] = useState(() => {
    if (typeof window === 'undefined') return 'american';
    return localStorage.getItem('piks_odds_format') || 'american';
  });

  const refresh = useCallback(async () => {
    if (status !== 'authenticated' || !session?.user?.id) return;
    try {
      const res = await fetch('/api/user/settings');
      if (res.ok) {
        const data = await res.json();
        if (data?.settings?.oddsFormat) {
          setOddsFormatState(data.settings.oddsFormat);
          if (typeof window !== 'undefined') {
            localStorage.setItem('piks_odds_format', data.settings.oddsFormat);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load preferences:', err);
    }
  }, [session, status]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setOddsFormat = useCallback((value) => {
    setOddsFormatState(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem('piks_odds_format', value);
    }
  }, []);

  const formatOdds = useCallback((odds) => formatOddsBase(odds, oddsFormat), [oddsFormat]);

  return (
    <UserPreferencesContext.Provider
      value={{ oddsFormat, setOddsFormat, formatOdds, refresh }}
    >
      {children}
    </UserPreferencesContext.Provider>
  );
};
