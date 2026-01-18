export default function HockeyRink({ className = '' }) {
  return (
    <svg
      viewBox="0 0 940 400"
      className={className}
      style={{ width: '100%', height: 'auto' }}
    >
      <defs>
        <linearGradient id="iceGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#e8f4f8" />
          <stop offset="50%" stopColor="#fff" />
          <stop offset="100%" stopColor="#e8f4f8" />
        </linearGradient>
      </defs>
      
      <rect x="0" y="0" width="940" height="400" rx="100" ry="100" fill="url(#iceGradient)" stroke="#333" strokeWidth="3" />
      
      <line x1="470" y1="10" x2="470" y2="390" stroke="#e74c3c" strokeWidth="4" />
      
      <line x1="235" y1="10" x2="235" y2="390" stroke="#3498db" strokeWidth="4" />
      <line x1="705" y1="10" x2="705" y2="390" stroke="#3498db" strokeWidth="4" />
      
      <circle cx="470" cy="200" r="50" fill="none" stroke="#3498db" strokeWidth="3" />
      <circle cx="470" cy="200" r="6" fill="#3498db" />
      
      <circle cx="160" cy="120" r="45" fill="none" stroke="#e74c3c" strokeWidth="3" />
      <circle cx="160" cy="120" r="6" fill="#e74c3c" />
      <circle cx="160" cy="280" r="45" fill="none" stroke="#e74c3c" strokeWidth="3" />
      <circle cx="160" cy="280" r="6" fill="#e74c3c" />
      
      <circle cx="780" cy="120" r="45" fill="none" stroke="#e74c3c" strokeWidth="3" />
      <circle cx="780" cy="120" r="6" fill="#e74c3c" />
      <circle cx="780" cy="280" r="45" fill="none" stroke="#e74c3c" strokeWidth="3" />
      <circle cx="780" cy="280" r="6" fill="#e74c3c" />
      
      <circle cx="290" cy="120" r="4" fill="#e74c3c" />
      <circle cx="290" cy="280" r="4" fill="#e74c3c" />
      <circle cx="650" cy="120" r="4" fill="#e74c3c" />
      <circle cx="650" cy="280" r="4" fill="#e74c3c" />
      
      <line x1="60" y1="160" x2="60" y2="240" stroke="#e74c3c" strokeWidth="6" />
      <rect x="20" y="160" width="40" height="80" fill="none" stroke="#333" strokeWidth="2" />
      
      <line x1="880" y1="160" x2="880" y2="240" stroke="#e74c3c" strokeWidth="6" />
      <rect x="880" y="160" width="40" height="80" fill="none" stroke="#333" strokeWidth="2" />
      
      <path d="M 60 100 L 140 100 L 140 300 L 60 300" fill="none" stroke="#e74c3c" strokeWidth="3" />
      <path d="M 880 100 L 800 100 L 800 300 L 880 300" fill="none" stroke="#e74c3c" strokeWidth="3" />
    </svg>
  );
}
