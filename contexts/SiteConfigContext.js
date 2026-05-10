import { createContext, useContext, useEffect, useState, useCallback } from 'react';

const DEFAULTS = {
  siteName: 'Piks',
  betaMode: true,
  maintenanceMode: false,
};

const SiteConfigContext = createContext({
  ...DEFAULTS,
  loaded: false,
  refresh: () => {},
});

export function SiteConfigProvider({ children }) {
  const [config, setConfig] = useState({ ...DEFAULTS, loaded: false });

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/site-config', { credentials: 'omit' });
      if (!res.ok) return;
      const data = await res.json();
      if (data && typeof data === 'object') {
        setConfig({
          siteName: typeof data.siteName === 'string' ? data.siteName : DEFAULTS.siteName,
          betaMode: !!data.betaMode,
          maintenanceMode: !!data.maintenanceMode,
          loaded: true,
        });
      }
    } catch (_e) {}
  }, []);

  useEffect(() => {
    fetchConfig();
    const id = setInterval(fetchConfig, 60_000);
    return () => clearInterval(id);
  }, [fetchConfig]);

  return (
    <SiteConfigContext.Provider value={{ ...config, refresh: fetchConfig }}>
      {children}
    </SiteConfigContext.Provider>
  );
}

export function useSiteConfig() {
  return useContext(SiteConfigContext);
}

export function useBetaMode() {
  const ctx = useContext(SiteConfigContext);
  return ctx.betaMode;
}
