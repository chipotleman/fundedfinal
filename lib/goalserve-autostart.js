import { getInplayService } from './goalserve-inplay';
import { startSchedulePolling, waitForScheduleCache as waitForScheduleCacheInternal, getScheduledGamesForSSR as getScheduledGamesForSSRInternal, getScheduleCacheStatus } from './schedule-cache';
import { getAllGamesWithOdds } from './goalserve';

let isInitialized = false;
let initPromise = null;

export function initializeGoalservePolling() {
  if (isInitialized) {
    return;
  }
  
  const service = getInplayService();
  
  if (service.isPolling) {
    isInitialized = true;
    return;
  }
  
  console.log('[Goalserve Autostart] Initializing persistent live data connection...');
  
  const targetSports = ['basketball', 'hockey', 'amfootball', 'baseball'];
  service.startPolling(targetSports);
  
  startSchedulePolling();
  
  isInitialized = true;
  console.log('[Goalserve Autostart] Live data polling started - cache will be pre-populated for instant loading');
}

export async function warmupGoalserve() {
  initializeGoalservePolling();
  try {
    const games = await Promise.race([
      getAllGamesWithOdds(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('warmup timeout')), 2500))
    ]);
    if (games && games.length > 0) {
      console.log(`[Goalserve Autostart] Warmup: Goalserve API responding, ${games.length} games loaded`);
    } else {
      console.log('[Goalserve Autostart] Warmup: Goalserve returned no games, circuit breakers engaged');
    }
  } catch (e) {
    console.log('[Goalserve Autostart] Warmup: Goalserve API unavailable, circuit breakers activated');
  }
}

// Waits for cache to be populated (for SSR)
// Returns immediately if cache already has data, otherwise waits up to maxWait ms
export async function waitForCache(maxWait = 3000) {
  const service = getInplayService();
  
  // If cache already has data, return immediately
  if (Object.keys(service.events || {}).length > 0) {
    return true;
  }
  
  // Start polling if not already
  initializeGoalservePolling();
  
  // Wait for data with timeout
  const startTime = Date.now();
  while (Date.now() - startTime < maxWait) {
    if (Object.keys(service.events || {}).length > 0) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return false; // Timeout - no data available
}

export function isGoalserveReady() {
  const service = getInplayService();
  return service.isPolling && Object.keys(service.events).length > 0;
}

export function getGoalserveStatus() {
  const service = getInplayService();
  return {
    isPolling: service.isPolling,
    eventCount: Object.keys(service.events).length,
    lastUpdate: service.lastUpdate,
    isReady: isGoalserveReady()
  };
}

export async function waitForScheduleCache(maxWait = 5000) {
  initializeGoalservePolling();
  return waitForScheduleCacheInternal(maxWait);
}

export function getScheduledGamesForSSR() {
  return getScheduledGamesForSSRInternal();
}
