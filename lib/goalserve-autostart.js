import { getInplayService } from './goalserve-inplay';

let isInitialized = false;
let initPromise = null;

// Starts polling (does not wait for data)
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
  
  isInitialized = true;
  console.log('[Goalserve Autostart] Live data polling started - cache will be pre-populated for instant loading');
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
