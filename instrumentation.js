export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Surface the in-process SSE bus's single-instance requirement at boot.
    // The whole real-time flow (invites, live PnL, forfeits) depends on this
    // server running as ONE always-on instance; this logs that constraint and
    // warns on the multi-worker red flag we can detect.
    try {
      const { assertSingleInstanceBus } = await import('./lib/battle-events');
      assertSingleInstanceBus();
    } catch (e) {
      console.error('[Instrumentation] bus guard failed:', e?.message || e);
    }

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
