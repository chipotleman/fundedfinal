/**
 * Cross-platform haptic feedback utility
 * - Uses Vibration API on Android
 * - Uses checkbox switch workaround on iOS Safari 18+ (iOS 18+)
 * 
 * Note: iOS haptics require Safari 18+ on iOS 18+ (released September 2024)
 */

let cachedWrapper = null;
let cachedCheckbox = null;
let cachedLabel = null;
let cleanupTimeout = null;

function isIOSSafari() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSafari = /Safari/.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS/.test(ua);
  return isIOS && isSafari;
}

function ensureIOSHapticElement() {
  if (cachedWrapper && cachedWrapper.parentNode) {
    return true;
  }
  
  try {
    cachedWrapper = document.createElement('div');
    cachedWrapper.setAttribute('aria-hidden', 'true');
    cachedWrapper.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;pointer-events:none;';
    
    cachedCheckbox = document.createElement('input');
    cachedCheckbox.type = 'checkbox';
    cachedCheckbox.setAttribute('switch', '');
    cachedCheckbox.id = 'ios-haptic-switch';
    
    cachedLabel = document.createElement('label');
    cachedLabel.setAttribute('for', 'ios-haptic-switch');
    
    cachedWrapper.appendChild(cachedCheckbox);
    cachedWrapper.appendChild(cachedLabel);
    document.body.appendChild(cachedWrapper);
    
    return true;
  } catch (e) {
    console.warn('Failed to create iOS haptic element:', e);
    return false;
  }
}

function cleanupIOSHapticElement() {
  if (cachedWrapper && cachedWrapper.parentNode) {
    cachedWrapper.remove();
  }
  cachedWrapper = null;
  cachedCheckbox = null;
  cachedLabel = null;
}

function scheduleCleanup() {
  if (cleanupTimeout) {
    clearTimeout(cleanupTimeout);
  }
  cleanupTimeout = setTimeout(() => {
    cleanupIOSHapticElement();
    cleanupTimeout = null;
  }, 5000);
}

function triggerIOSHaptic() {
  try {
    if (!ensureIOSHapticElement()) {
      return false;
    }
    
    cachedLabel.click();
    scheduleCleanup();
    
    return true;
  } catch (e) {
    console.warn('iOS haptic failed:', e);
    return false;
  }
}

export function triggerHaptic(pattern = 'tap') {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }

  const patterns = {
    tap: 50,
    success: [50, 30, 50],
    error: [100, 50, 100],
    warning: [30, 20, 30, 20, 30],
  };

  const vibrationPattern = patterns[pattern] || patterns.tap;

  if (isIOSSafari()) {
    const hapticCount = Array.isArray(vibrationPattern) 
      ? Math.floor(vibrationPattern.length / 2) + 1 
      : 1;
    
    triggerIOSHaptic();
    
    if (hapticCount > 1 && Array.isArray(vibrationPattern)) {
      let delay = 0;
      for (let i = 0; i < hapticCount - 1; i++) {
        delay += vibrationPattern[i * 2] + (vibrationPattern[i * 2 + 1] || 0);
        setTimeout(() => triggerIOSHaptic(), delay);
      }
    }
    
    return true;
  }

  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      const result = navigator.vibrate(vibrationPattern);
      if (result) return true;
    } catch (e) {
    }
  }

  return false;
}

export const haptic = {
  tap: () => triggerHaptic('tap'),
  success: () => triggerHaptic('success'),
  error: () => triggerHaptic('error'),
  warning: () => triggerHaptic('warning'),
};

export default haptic;
