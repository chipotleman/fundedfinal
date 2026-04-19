import { useMatchup } from '../../contexts/MatchupContext';

export default function ConnectionBadge({ className = '', style = {} }) {
  const { sseHealthy } = useMatchup();
  if (sseHealthy) return null;

  return (
    <div
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full ${className}`}
      style={{
        background: 'rgba(234,179,8,0.15)',
        border: '1px solid rgba(234,179,8,0.4)',
        ...style,
      }}
      title="Live connection lost — trying to reconnect. Updates may be delayed."
      role="status"
      aria-live="polite"
    >
      <style>{`
        @keyframes piksConnDot { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
        .piks-conn-dot { animation: piksConnDot 1.2s ease-in-out infinite; }
      `}</style>
      <span className="piks-conn-dot w-1.5 h-1.5 rounded-full" style={{ background: '#eab308' }} />
      <span className="text-[9px] font-semibold uppercase tracking-wider" style={{ color: '#facc15' }}>
        Reconnecting
      </span>
    </div>
  );
}
