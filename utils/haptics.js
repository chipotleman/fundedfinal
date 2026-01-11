/**
 * Cross-platform haptic feedback utility
 * - Uses Vibration API on Android
 * - Uses checkbox switch workaround on iOS Safari 18+ (iOS 18+)
 * 
 * Note: iOS haptics require Safari 18+ on iOS 18+ (released September 2024)
 */

function isIOSSafari() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSafari = /Safari/.test(ua) && !/Chrome|CriOS|FxiOS|EdgiOS/.test(ua);
  return isIOS && isSafari;
}

function triggerIOSHaptic() {
  try {
    const wrapper = document.createElement('div');
    wrapper.setAttribute('aria-hidden', 'true');
    wrapper.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.setAttribute('switch', '');
    const uniqueId = 'haptic-' + Math.random().toString(36).substring(2, 9);
    checkbox.id = uniqueId;
    
    const label = document.createElement('label');
    label.setAttribute('for', uniqueId);
    
    wrapper.appendChild(checkbox);
    wrapper.appendChild(label);
    document.body.appendChild(wrapper);
    
    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      label.click();
      
      // Clean up after haptic triggers
      setTimeout(() => {
        if (wrapper.parentNode) {
          wrapper.remove();
        }
      }, 50);
    });
    
    return true;
  } catch (e) {
    console.warn('iOS haptic failed:', e);
    return false;
  }
}

export function triggerHaptic(pattern = 'tap') {
  // Guard for non-browser contexts (SSR, tests)
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

  // Check if iOS Safari - use switch workaround
  if (isIOSSafari()) {
    const hapticCount = Array.isArray(vibrationPattern) 
      ? Math.floor(vibrationPattern.length / 2) + 1 
      : 1;
    
    // Trigger initial haptic
    triggerIOSHaptic();
    
    // For patterns, trigger multiple times with delays
    if (hapticCount > 1 && Array.isArray(vibrationPattern)) {
      let delay = 0;
      for (let i = 0; i < hapticCount - 1; i++) {
        delay += vibrationPattern[i * 2] + (vibrationPattern[i * 2 + 1] || 0);
        setTimeout(() => triggerIOSHaptic(), delay);
      }
    }
    
    return true;
  }

  // Try Vibration API (Android, etc.)
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      const result = navigator.vibrate(vibrationPattern);
      if (result) return true;
    } catch (e) {
      // Vibration API failed
    }
  }

  return false;
}

// Convenience methods
export const haptic = {
  tap: () => triggerHaptic('tap'),
  success: () => triggerHaptic('success'),
  error: () => triggerHaptic('error'),
  warning: () => triggerHaptic('warning'),
};

export default haptic;
