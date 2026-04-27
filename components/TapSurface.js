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
  disabled = false,
  // Spread any additional props (aria-*, title, data-*, etc.) onto the
  // underlying <button> so callers can attach accessibility metadata
  // and tooltips without needing a custom wrapper.
  ...rest
}) {
  return (
    <button
      {...rest}
      type="button"
      disabled={disabled}
      onClick={() => { if (!disabled && onTap) onTap(); }}
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
        ...style,
      }}
      className={`no-hover-effect ${className}`.trim()}
    >
      {children}
    </button>
  );
}
