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
        // Use CSS-var fallbacks for the inactive (default) palette so
        // light mode can recolor every TapSurface globally via
        // `--tap-inactive-bg` / `--tap-inactive-text` without losing
        // the caller-provided props (the prop value is the fallback).
        // Active state is left as the raw prop so caller-driven
        // selection highlights (e.g. blue when a bet is in the slip)
        // always win.
        backgroundColor: isActive ? activeColor : `var(--tap-inactive-bg, ${inactiveColor})`,
        color: isActive ? activeTextColor : `var(--tap-inactive-text, ${inactiveTextColor})`,
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
