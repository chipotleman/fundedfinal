import { useRouter } from 'next/router';
import haptic from '../utils/haptics';

// Dashboard promo container that surfaces "what the public is on"
// today. Lives in the same horizontal promo carousel as
// DepositMatchContainer and RushExplainerContainer. The full visual
// is rendered as a single branded image so the carousel slot displays
// the designed banner exactly as authored.
export default function TrendingBetContainer() {
  const router = useRouter();

  const handleClick = () => {
    haptic.tap();
    router.push('/dashboard');
  };

  return (
    <div
      className="w-[calc(100vw-32px)] md:w-[864px] flex-shrink-0 rounded-xl overflow-hidden cursor-pointer transition-transform duration-200 relative h-[48px] md:h-[64px] hover:scale-[1.02] active:scale-[0.98]"
      style={{ backgroundColor: '#000' }}
      onClick={handleClick}
      role="button"
      aria-label="Trending now — see what the public is betting on"
    >
      <img
        src="/promos/trending-picks.png"
        alt="Trending now — 1.6k picks on PUR ML -133 with 78% public confidence"
        className="absolute inset-0 w-full h-full object-cover object-center select-none pointer-events-none"
        draggable={false}
        loading="lazy"
      />
    </div>
  );
}
