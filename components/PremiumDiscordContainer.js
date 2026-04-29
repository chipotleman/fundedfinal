import { useRouter } from 'next/router';
import haptic from '../utils/haptics';

// Dashboard promo container that promotes the Premium Discord / VIP
// community. Lives in the horizontal promo carousel alongside the other
// branded promo tiles. The full visual is rendered as a single branded
// image so the carousel slot displays the designed banner exactly as
// authored.
export default function PremiumDiscordContainer() {
  const router = useRouter();

  const handleClick = () => {
    haptic.tap();
    router.push('/marketplace');
  };

  return (
    <div
      className="w-[187px] md:w-[240px] flex-shrink-0 rounded-2xl overflow-hidden cursor-pointer transition-transform duration-200 relative h-[140px] md:h-[180px] hover:scale-[1.02] active:scale-[0.98]"
      style={{ backgroundColor: '#000' }}
      onClick={handleClick}
      role="button"
      aria-label="Join the Premium Discord — VIP members only"
    >
      {/* Container is 4:3 to match the source banner art (1448×1086).
          object-cover gives a perfect edge-to-edge fill with no
          letterboxing or cropping. */}
      <img
        src="/promos/premium-discord.png"
        alt="Premium Discord — VIP access, instant alerts, expert chat, daily plays"
        className="absolute inset-0 w-full h-full object-cover object-center select-none pointer-events-none"
        draggable={false}
        loading="lazy"
      />
    </div>
  );
}
