export default function SoccerField({ className = '' }) {
  return (
    <svg
      viewBox="0 0 940 600"
      className={className}
      style={{ width: '100%', height: 'auto' }}
    >
      <defs>
        <pattern id="grassPattern" patternUnits="userSpaceOnUse" width="60" height="60">
          <rect width="30" height="60" fill="#2d8a3e" />
          <rect x="30" width="30" height="60" fill="#32994a" />
        </pattern>
      </defs>
      
      <rect x="0" y="0" width="940" height="600" fill="url(#grassPattern)" />
      
      <rect x="30" y="30" width="880" height="540" fill="none" stroke="#fff" strokeWidth="3" />
      
      <line x1="470" y1="30" x2="470" y2="570" stroke="#fff" strokeWidth="3" />
      
      <circle cx="470" cy="300" r="73" fill="none" stroke="#fff" strokeWidth="3" />
      <circle cx="470" cy="300" r="4" fill="#fff" />
      
      <rect x="30" y="180" width="132" height="240" fill="none" stroke="#fff" strokeWidth="3" />
      <rect x="778" y="180" width="132" height="240" fill="none" stroke="#fff" strokeWidth="3" />
      
      <rect x="30" y="240" width="44" height="120" fill="none" stroke="#fff" strokeWidth="3" />
      <rect x="866" y="240" width="44" height="120" fill="none" stroke="#fff" strokeWidth="3" />
      
      <path d="M 162 225 A 73 73 0 0 1 162 375" fill="none" stroke="#fff" strokeWidth="3" />
      <path d="M 778 225 A 73 73 0 0 0 778 375" fill="none" stroke="#fff" strokeWidth="3" />
      
      <circle cx="96" cy="300" r="4" fill="#fff" />
      <circle cx="844" cy="300" r="4" fill="#fff" />
      
      <rect x="20" y="270" width="10" height="60" fill="#fff" />
      <rect x="910" y="270" width="10" height="60" fill="#fff" />
      
      <path d="M 30 30 Q 15 45 30 60" fill="none" stroke="#fff" strokeWidth="2" />
      <path d="M 910 30 Q 925 45 910 60" fill="none" stroke="#fff" strokeWidth="2" />
      <path d="M 30 570 Q 15 555 30 540" fill="none" stroke="#fff" strokeWidth="2" />
      <path d="M 910 570 Q 925 555 910 540" fill="none" stroke="#fff" strokeWidth="2" />
    </svg>
  );
}
