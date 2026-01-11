import { getInplayService } from './goalserve-inplay';

let isInitialized = false;

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
