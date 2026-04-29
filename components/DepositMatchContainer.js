import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import haptic from '../utils/haptics';

export default function DepositMatchContainer() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [hasDeposited, setHasDeposited] = useState(null);

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.id) {
      setHasDeposited(null);
      return;
    }
    let cancelled = false;
    fetch('/api/user/has-deposited', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : { hasDeposited: true }))
      .then(data => {
        if (!cancelled) setHasDeposited(!!data.hasDeposited);
      })
      .catch(() => {
        if (!cancelled) setHasDeposited(true);
      });
    return () => {
      cancelled = true;
    };
  }, [status, session?.user?.id]);

  const isReturning = status === 'authenticated' && hasDeposited === true;

  const handleClick = () => {
    haptic.tap();
    router.push('/withdrawal');
  };

  return (
    <div
      className="w-[calc(100vw-32px)] md:w-[864px] flex-shrink-0 rounded-2xl overflow-hidden cursor-pointer transition-transform duration-200 relative h-[140px] md:h-[180px] hover:scale-[1.02] active:scale-[0.98]"
      style={{ backgroundColor: '#000' }}
      onClick={handleClick}
      role="button"
      aria-label={isReturning ? 'Claim reload deposit match' : 'Claim first deposit match'}
    >
      {/* Static branded artwork — full-bleed image so the carousel slot
          shows the designed banner exactly as authored. The image is
          square; we cover-crop it into the slot with the focal "50%
          MATCH" headline and "CLAIM BONUS" CTA centered. */}
      <img
        src="/promos/reload-match.png"
        alt="Reload Match — 50% bonus, up to $50 free on your next deposit"
        className="absolute inset-0 w-full h-full object-contain object-center select-none pointer-events-none"
        draggable={false}
        loading="lazy"
      />
    </div>
  );
}
