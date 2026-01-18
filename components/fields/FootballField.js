export default function FootballField({ className = '' }) {
  return (
    <svg
      viewBox="0 0 940 400"
      className={className}
      style={{ width: '100%', height: 'auto' }}
    >
      <rect x="0" y="0" width="940" height="400" fill="#2d8a3e" />
      
      <rect x="0" y="0" width="85" height="400" fill="#1e5c2a" />
      <rect x="855" y="0" width="85" height="400" fill="#1e5c2a" />
      
      <rect x="20" y="20" width="900" height="360" fill="none" stroke="#fff" strokeWidth="3" />
      
      {[10, 20, 30, 40, 50, 40, 30, 20, 10].map((num, i) => {
        const x = 85 + (i * 85.5);
        return (
          <g key={i}>
            <line x1={x} y1={20} x2={x} y2={380} stroke="#fff" strokeWidth="2" />
            <text x={x} y={60} fill="#fff" fontSize="20" fontWeight="bold" textAnchor="middle" fontFamily="Arial">
              {num}
            </text>
            <text x={x} y={370} fill="#fff" fontSize="20" fontWeight="bold" textAnchor="middle" fontFamily="Arial" transform={`rotate(180 ${x} 370)`}>
              {num}
            </text>
          </g>
        );
      })}
      
      {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((_, i) => {
        const x = 85 + (i * 85.5) + 42.75;
        return (
          <g key={`hash-${i}`}>
            <line x1={x} y1={140} x2={x} y2={145} stroke="#fff" strokeWidth="2" />
            <line x1={x} y1={255} x2={x} y2={260} stroke="#fff" strokeWidth="2" />
          </g>
        );
      })}
      
      <line x1={85 + (4 * 85.5)} y1={20} x2={85 + (4 * 85.5)} y2={380} stroke="#fff" strokeWidth="4" />
      
      <g>
        <rect x="32" y="170" width="8" height="60" fill="#ffeb3b" />
        <rect x="900" y="170" width="8" height="60" fill="#ffeb3b" />
      </g>
    </svg>
  );
}
