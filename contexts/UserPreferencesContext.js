import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { formatOdds as formatOddsBase } from '../utils/odds';
import { ANALYTICS_OPT_OUT_KEY } from '../lib/promoTracking';

const UserPreferencesContext = createContext(null);

const DEFAULT_PREFS = {
  oddsFormat: 'american',
  analyticsOptOut: false,
};

export const useUserPreferences = () => {
  const ctx = useContext(UserPreferencesContext);
  if (!ctx) {
    return {
      ...DEFAULT_PREFS,
      formatOdds: (o) => formatOddsBase(o, 'american'),
      setOddsFormat: () => {},
      setAnalyticsOptOut: () => {},
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
  const [analyticsOptOut, setAnalyticsOptOutState] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem(ANALYTICS_OPT_OUT_KEY) === 'true';
    } catch {
      return false;
    }
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
        const serverOptOut = !!data?.settings?.privacy?.analyticsOptOut;
        setAnalyticsOptOutState(serverOptOut);
        if (typeof window !== 'undefined') {
          try {
            if (serverOptOut) {
              localStorage.setItem(ANALYTICS_OPT_OUT_KEY, 'true');
            } else {
              localStorage.removeItem(ANALYTICS_OPT_OUT_KEY);
            }
          } catch {
            // localStorage may be unavailable; in-memory state still updated
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

  const setAnalyticsOptOut = useCallback((value) => {
    const next = !!value;
    setAnalyticsOptOutState(next);
    if (typeof window !== 'undefined') {
      try {
        if (next) {
          localStorage.setItem(ANALYTICS_OPT_OUT_KEY, 'true');
        } else {
          localStorage.removeItem(ANALYTICS_OPT_OUT_KEY);
        }
      } catch {
        // localStorage may be unavailable; in-memory state still updated
      }
    }
  }, []);

  const formatOdds = useCallback((odds) => formatOddsBase(odds, oddsFormat), [oddsFormat]);

  return (
    <UserPreferencesContext.Provider
      value={{
        oddsFormat,
        setOddsFormat,
        formatOdds,
        analyticsOptOut,
        setAnalyticsOptOut,
        refresh,
      }}
    >
      {children}
    </UserPreferencesContext.Provider>
  );
};
