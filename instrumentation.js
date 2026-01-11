export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initializeGoalservePolling } = await import('./lib/goalserve-autostart');
    
    console.log('[Instrumentation] Server starting - initializing live data connection...');
    initializeGoalservePolling();
  }
}
