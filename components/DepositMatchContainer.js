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
      className="w-[160px] md:w-[200px] flex-shrink-0 rounded-2xl overflow-hidden cursor-pointer transition-transform duration-200 relative h-[140px] md:h-[180px] hover:scale-[1.02] active:scale-[0.98]"
      style={{ backgroundColor: '#000' }}
      onClick={handleClick}
      role="button"
      aria-label={isReturning ? 'Claim reload deposit match' : 'Claim first deposit match'}
    >
      {/* Container is intentionally a touch wider than tall (160×140 / 200×180)
          so the square source PNG can `object-cover` the full width without
          any horizontal crop — the bordered card's left and right edges
          stay fully visible and the focal "50% MATCH" headline + "CLAIM
          BONUS" CTA sit fully inside the frame. The minor top/bottom
          overflow is what trims the ~6% black padding baked around the
          source image, so the bordered card lines up at the same visual
          height as the other promo tiles in the carousel. */}
      <img
        src="/promos/reload-match.png"
        alt="Reload Match — 50% bonus, up to $50 free on your next deposit"
        className="absolute inset-0 w-full h-full object-cover object-center select-none pointer-events-none"
        draggable={false}
        loading="lazy"
      />
    </div>
  );
}
