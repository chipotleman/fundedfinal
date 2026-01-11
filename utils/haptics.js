/**
 * Cross-platform haptic feedback utility
 * - Uses Vibration API on Android
 * - Uses checkbox switch workaround on iOS Safari 17.4+
 */

export function triggerHaptic(pattern = 'tap') {
  const patterns = {
    tap: 50,
    success: [50, 30, 50],
    error: [100, 50, 100],
    warning: [30, 20, 30, 20, 30],
  };

  const vibrationPattern = patterns[pattern] || patterns.tap;

  // Try Vibration API first (Android, etc.)
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate(vibrationPattern);
      return true;
    } catch (e) {
      // Vibration API failed, try iOS workaround
    }
  }

  // iOS Safari 17.4+ workaround using checkbox switch
  try {
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;pointer-events:none;';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.setAttribute('switch', '');
    checkbox.id = 'haptic-trigger-' + Date.now();
    
    const label = document.createElement('label');
    label.setAttribute('for', checkbox.id);
    
    wrapper.appendChild(checkbox);
    wrapper.appendChild(label);
    document.body.appendChild(wrapper);
    
    // Trigger the haptic by clicking the label
    label.click();
    
    // For patterns, trigger multiple times
    if (Array.isArray(vibrationPattern) && vibrationPattern.length > 1) {
      const hapticCount = Math.floor(vibrationPattern.length / 2) + 1;
      for (let i = 1; i < hapticCount; i++) {
        setTimeout(() => {
          checkbox.checked = !checkbox.checked;
        }, vibrationPattern.slice(0, i * 2).reduce((a, b) => a + b, 0));
      }
    }
    
    // Clean up after a short delay
    setTimeout(() => {
      if (wrapper.parentNode) {
        wrapper.remove();
      }
    }, 100);
    
    return true;
  } catch (e) {
    // Haptic feedback not supported
    return false;
  }
}

// Convenience methods
export const haptic = {
  tap: () => triggerHaptic('tap'),
  success: () => triggerHaptic('success'),
  error: () => triggerHaptic('error'),
  warning: () => triggerHaptic('warning'),
};

export default haptic;
