import { useCallback, useRef } from 'react';

export default function TapSurface({ 
  children, 
  onTap, 
  isActive = false,
  activeColor = '#2563eb',
  inactiveColor = '#1a1a1a',
  activeTextColor = '#ffffff',
  inactiveTextColor = '#3b82f6',
  className = '',
  style = {},
  disabled = false
}) {
  const touchStartRef = useRef(null);
  const hasFiredRef = useRef(false);
  
  // Threshold in pixels - if finger moves more than this, it's a scroll not a tap
  const SCROLL_THRESHOLD = 10;

  const handleTouchStart = useCallback((e) => {
    if (disabled) return;
    // Record touch start position
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    hasFiredRef.current = false;
  }, [disabled]);

  const handleTouchEnd = useCallback((e) => {
    if (disabled || !touchStartRef.current) return;
    
    // Get end position
    const touch = e.changedTouches[0];
    const deltaX = Math.abs(touch.clientX - touchStartRef.current.x);
    const deltaY = Math.abs(touch.clientY - touchStartRef.current.y);
    
    // Only fire if finger didn't move much (true tap, not scroll)
    if (deltaX < SCROLL_THRESHOLD && deltaY < SCROLL_THRESHOLD) {
      e.preventDefault();
      hasFiredRef.current = true;
      if (onTap) onTap();
    }
    
    touchStartRef.current = null;
  }, [onTap, disabled]);

  const handleMouseDown = useCallback((e) => {
    if (disabled) return;
    e.preventDefault();
    if (!hasFiredRef.current) {
      if (onTap) onTap();
    }
    hasFiredRef.current = false;
  }, [onTap, disabled]);

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onFocus={(e) => e.target.blur()}
      style={{
        backgroundColor: isActive ? activeColor : inactiveColor,
        color: isActive ? activeTextColor : inactiveTextColor,
        cursor: disabled ? 'default' : 'pointer',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
        WebkitTouchCallout: 'none',
        touchAction: 'manipulation',
        outline: 'none',
        border: 'none',
        boxShadow: 'none',
        transition: 'none',
        ...style
      }}
      className={className}
    >
      {children}
    </div>
  );
}
