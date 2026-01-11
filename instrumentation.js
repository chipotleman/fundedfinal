export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Skip inplay polling in development - the feeds require IP whitelisting (production only)
    // The schedule API works fine in dev for odds data
    const isDev = process.env.NODE_ENV === 'development';
    if (isDev) {
      console.log('[Instrumentation] Development mode - skipping inplay polling (IP whitelisting required for production)');
      return;
    }
    
    const { initializeGoalservePolling } = await import('./lib/goalserve-autostart');
    
    console.log('[Instrumentation] Server starting - initializing live data connection...');
    initializeGoalservePolling();
  }
}
