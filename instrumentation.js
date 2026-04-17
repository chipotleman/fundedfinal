export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { warmupGoalserve } = await import('./lib/goalserve-autostart');
    
    console.log('[Instrumentation] Server starting - warming up Goalserve connection...');
    await warmupGoalserve();
    console.log('[Instrumentation] Warmup complete - server ready');

    try {
      const mod = await import('./lib/matchup-pnl-job');
      const start = mod.startMatchupPnlMarkToMarket
        || (mod.default && mod.default.startMatchupPnlMarkToMarket);
      if (typeof start === 'function') {
        start();
      } else {
        console.error('[Instrumentation] startMatchupPnlMarkToMarket export not found');
      }
    } catch (e) {
      console.error('[Instrumentation] Failed to start matchup PnL job:', e?.message || e);
    }
  }
}
