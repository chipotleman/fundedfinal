export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { warmupGoalserve } = await import('./lib/goalserve-autostart');
    
    console.log('[Instrumentation] Server starting - warming up Goalserve connection...');
    await warmupGoalserve();
    console.log('[Instrumentation] Warmup complete - server ready');
  }
}
