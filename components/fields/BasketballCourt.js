export default function BasketballCourt({ className = '' }) {
  return (
    <svg
      viewBox="0 0 940 500"
      className={className}
      style={{ width: '100%', height: 'auto' }}
    >
      <defs>
        <linearGradient id="courtGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#c65c1a" />
          <stop offset="50%" stopColor="#d4702a" />
          <stop offset="100%" stopColor="#c65c1a" />
        </linearGradient>
        <linearGradient id="paintGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#8b4513" />
          <stop offset="100%" stopColor="#a0522d" />
        </linearGradient>
      </defs>
      
      <rect x="0" y="0" width="940" height="500" fill="url(#courtGradient)" rx="4" />
      
      <rect x="10" y="10" width="920" height="480" fill="none" stroke="#fff" strokeWidth="3" />
      
      <line x1="470" y1="10" x2="470" y2="490" stroke="#fff" strokeWidth="3" />
      
      <circle cx="470" cy="250" r="60" fill="none" stroke="#fff" strokeWidth="3" />
      <circle cx="470" cy="250" r="6" fill="#fff" />
      
      <rect x="10" y="170" width="190" height="160" fill="url(#paintGradient)" stroke="#fff" strokeWidth="3" />
      <rect x="740" y="170" width="190" height="160" fill="url(#paintGradient)" stroke="#fff" strokeWidth="3" />
      
      <circle cx="200" cy="250" r="60" fill="none" stroke="#fff" strokeWidth="3" />
      <circle cx="740" cy="250" r="60" fill="none" stroke="#fff" strokeWidth="3" />
      
      <path d="M 10 170 Q 60 250 10 330" fill="none" stroke="#fff" strokeWidth="3" />
      <path d="M 930 170 Q 880 250 930 330" fill="none" stroke="#fff" strokeWidth="3" />
      
      <rect x="10" y="210" width="60" height="80" fill="none" stroke="#fff" strokeWidth="2" />
      <rect x="870" y="210" width="60" height="80" fill="none" stroke="#fff" strokeWidth="2" />
      
      <line x1="40" y1="250" x2="40" y2="250" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
      <path d="M 30 225 L 30 205 L 50 205 L 50 225" fill="none" stroke="#fff" strokeWidth="3" />
      
      <line x1="900" y1="250" x2="900" y2="250" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
      <path d="M 890 225 L 890 205 L 910 205 L 910 225" fill="none" stroke="#fff" strokeWidth="3" />
    </svg>
  );
}
