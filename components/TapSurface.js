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
  const hasFiredRef = useRef(false);

  const handleTouchStart = useCallback((e) => {
    if (disabled) return;
    e.preventDefault();
    hasFiredRef.current = true;
    if (onTap) onTap();
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
