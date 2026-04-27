// Helpers for syncing the "beta_access" gate to a cookie alongside
// localStorage. The cookie lets pages/_app.js read the gate state during
// SSR so the BetaLanding component does not have to render-then-flip on
// every hard reload — which used to cause a brief flash of the gate
// before the dashboard with games appeared.

const COOKIE_NAME = 'beta_access';
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function setBetaAccessCookie() {
  if (typeof document === 'undefined') return;
  const isHttps =
    typeof window !== 'undefined' && window.location?.protocol === 'https:';
  const secure = isHttps ? '; secure' : '';
  document.cookie = `${COOKIE_NAME}=true; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax${secure}`;
}

export function clearBetaAccessCookie() {
  if (typeof document === 'undefined') return;
  document.cookie = `${COOKIE_NAME}=; path=/; max-age=0; samesite=lax`;
}

export function grantBetaAccess() {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem('beta_access', 'true');
    } catch (_e) {}
  }
  setBetaAccessCookie();
}

export function readBetaAccessFromCookieHeader(cookieHeader) {
  if (!cookieHeader || typeof cookieHeader !== 'string') return false;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const [rawName, ...rest] = part.split('=');
    if ((rawName || '').trim() === COOKIE_NAME) {
      const value = rest.join('=').trim();
      return value === 'true';
    }
  }
  return false;
}
