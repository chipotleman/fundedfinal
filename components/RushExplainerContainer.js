import { useRouter } from 'next/router';
import haptic from '../utils/haptics';

// Dashboard promo container that explains the new Rush battle mode.
// Lives in the same horizontal promo carousel as DepositMatchContainer
// and TrendingBetContainer. The full visual is rendered as a single
// branded image so the carousel slot displays the designed banner
// exactly as authored.
export default function RushExplainerContainer() {
  const router = useRouter();

  const handleClick = () => {
    haptic.tap();
    router.push('/battle');
  };

  return (
    <div
      className="w-[187px] md:w-[240px] flex-shrink-0 rounded-2xl overflow-hidden cursor-pointer transition-transform duration-200 relative h-[140px] md:h-[180px] hover:scale-[1.02] active:scale-[0.98]"
      style={{ backgroundColor: '#000' }}
      onClick={handleClick}
      role="button"
      aria-label="Try Rush — the fastest way to battle"
    >
      {/* Container is 4:3 to match the source banner art (1448×1086).
          object-cover gives a perfect edge-to-edge fill with no
          letterboxing or cropping. */}
      <img
        src="/promos/rush-explainer.png"
        alt="Rush — pick 6 props from one live game, most right wins, least time breaks the tie"
        className="absolute inset-0 w-full h-full object-cover object-center select-none pointer-events-none"
        draggable={false}
        loading="lazy"
      />
    </div>
  );
}
