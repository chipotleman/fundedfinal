
import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html>
      <Head>
        {/* Preload critical images */}
        <link rel="preload" as="image" href="/pikslogotransparent.png" />
        
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#000000" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black" />
        <meta name="apple-mobile-web-app-title" content="Piks" />
        
        <link rel="icon" href="/favicon.ico?v=3" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icon-192x192.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon.ico?v=3" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon.ico?v=3" />
        
        {/* Open Graph / Social Media Meta Tags */}
        <meta property="og:title" content="Piks - Get Funded to Bet" />
        <meta property="og:description" content="Get funded up to $25,000 to bet with and keep 80% of your profits. No risk betting with our money, not yours." />
        <meta property="og:image" content="https://fundmybet.vercel.app/funder-social-banner.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://fundmybet.vercel.app" />
        
        {/* Twitter Card Meta Tags */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Piks - Get Funded to Bet" />
        <meta name="twitter:description" content="Get funded up to $25,000 to bet with and keep 80% of your profits. No risk betting with our money, not yours." />
        <meta name="twitter:image" content="https://fundmybet.vercel.app/funder-social-banner.png" />
        
        {/* General Meta Tags */}
        <meta name="description" content="Get funded up to $25,000 to bet with and keep 80% of your profits. No risk betting with our money, not yours." />
        <meta name="keywords" content="sports betting, funded betting, no risk betting, profit sharing" />
      </Head>
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function() {
  try {
    var SCROLL_KEY = 'piks_dashboard_scroll';
    var SCROLL_TIME_KEY = 'piks_dashboard_scroll_time';
    var FROZEN_KEY = 'piks_dashboard_frozen';
    var MAX_AGE_MS = 30 * 60 * 1000;
    
    var savedPos = parseInt(localStorage.getItem(SCROLL_KEY) || '0', 10);
    var savedTime = parseInt(localStorage.getItem(SCROLL_TIME_KEY) || '0', 10);
    var isFresh = Date.now() - savedTime < MAX_AGE_MS;
    
    if (savedPos > 0 && isFresh && window.location.pathname === '/dashboard') {
      if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
      }
      document.body.style.position = 'fixed';
      document.body.style.top = '-' + savedPos + 'px';
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.width = '100%';
      document.body.style.overflowY = 'scroll';
      localStorage.setItem(FROZEN_KEY, 'true');
    }
  } catch (e) {}
})();
            `,
          }}
        />
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
