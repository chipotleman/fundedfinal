import { useCallback } from 'react';

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
  const handlePointerDown = useCallback((e) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    if (onTap) onTap();
  }, [onTap, disabled]);

  const handleTouchStart = useCallback((e) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    if (onTap) onTap();
  }, [onTap, disabled]);

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      onPointerDown={handlePointerDown}
      onTouchStart={handleTouchStart}
      onMouseDown={(e) => e.preventDefault()}
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
