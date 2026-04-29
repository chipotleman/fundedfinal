import { useRouter } from 'next/router';
import haptic from '../utils/haptics';

// Dashboard promo container that surfaces the daily Free Pick of the Day.
// Lives in the horizontal promo carousel alongside the other branded promo
// tiles. The full visual is rendered as a single branded image so the
// carousel slot displays the designed banner exactly as authored.
export default function FreePickContainer() {
  const router = useRouter();

  const handleClick = () => {
    haptic.tap();
    router.push('/marketplace');
  };

  return (
    <div
      className="w-[140px] md:w-[180px] flex-shrink-0 rounded-2xl overflow-hidden cursor-pointer transition-transform duration-200 relative h-[140px] md:h-[180px] hover:scale-[1.02] active:scale-[0.98]"
      style={{ backgroundColor: '#000' }}
      onClick={handleClick}
      role="button"
      aria-label="Claim today's free pick of the day"
    >
      <img
        src="/promos/free-pick.png"
        alt="Free Pick of the Day — limited, sharp action, high confidence"
        className="absolute inset-0 w-full h-full object-contain object-center select-none pointer-events-none"
        draggable={false}
        loading="lazy"
      />
    </div>
  );
}
