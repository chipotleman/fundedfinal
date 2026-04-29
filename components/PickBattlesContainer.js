import { useRouter } from 'next/router';
import haptic from '../utils/haptics';

// Dashboard promo container that promotes 1v1 Pick Battles. Lives in the
// horizontal promo carousel alongside the other branded promo tiles. The
// full visual is rendered as a single branded image so the carousel slot
// displays the designed banner exactly as authored.
export default function PickBattlesContainer() {
  const router = useRouter();

  const handleClick = () => {
    haptic.tap();
    router.push('/dashboard');
  };

  return (
    <div
      className="w-[228px] md:w-[293px] flex-shrink-0 rounded-2xl overflow-hidden cursor-pointer transition-transform duration-200 relative h-[140px] md:h-[180px] hover:scale-[1.02] active:scale-[0.98]"
      style={{ backgroundColor: '#000' }}
      onClick={handleClick}
      role="button"
      aria-label="Enter a 1v1 Pick Battle"
    >
      {/* Container width matches the trimmed banner aspect (1378×847 ≈ 1.63)
          at the unified carousel height (140/180), so the bordered card
          fills the tile edge-to-edge with no padding. */}
      <img
        src="/promos/pick-battles.png"
        alt="1v1 Pick Battles — fast, competitive, head-to-head matchups"
        className="absolute inset-0 w-full h-full object-cover object-center select-none pointer-events-none"
        draggable={false}
        loading="lazy"
      />
    </div>
  );
}
