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
      className="w-[214px] md:w-[275px] flex-shrink-0 rounded-2xl overflow-hidden cursor-pointer transition-transform duration-200 relative h-[140px] md:h-[180px] hover:scale-[1.02] active:scale-[0.98]"
      style={{ backgroundColor: '#000' }}
      onClick={handleClick}
      role="button"
      aria-label="Join the Premium Discord — VIP members only"
    >
      {/* Container width matches the trimmed banner aspect (1364×894 ≈ 1.53)
          at the unified carousel height (140/180), so the bordered card
          fills the tile edge-to-edge with no padding. */}
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
