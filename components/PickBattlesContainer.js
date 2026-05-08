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
    // Prefer opening the dashboard's existing Battle Mode Chooser inline
    // via a window event — the YouVsCard mounted on the dashboard listens
    // for `piks:open-battle-chooser` and pops the same chooser. This keeps
    // the user on the dashboard so closing Quick Match returns them here
    // instead of stranding them on /battle (Social).
    if (typeof window !== 'undefined') {
      let handled = false;
      const ack = () => { handled = true; };
      window.addEventListener('piks:battle-chooser-opened', ack, { once: true });
      window.dispatchEvent(new CustomEvent('piks:open-battle-chooser'));
      // If nothing on the page handled the event in the next tick (e.g.
      // the user opened this promo from a context where YouVsCard isn't
      // mounted), fall back to routing to /battle so the page-level
      // chooser still picks it up.
      setTimeout(() => {
        window.removeEventListener('piks:battle-chooser-opened', ack);
        if (!handled) router.push('/battle?openChooser=1');
      }, 50);
      return;
    }
    router.push('/battle?openChooser=1');
  };

  return (
    <div
      className="w-[187px] md:w-[240px] flex-shrink-0 rounded-2xl overflow-hidden cursor-pointer transition-transform duration-200 relative h-[140px] md:h-[180px] hover:scale-[1.02] active:scale-[0.98]"
      style={{ backgroundColor: '#000' }}
      onClick={handleClick}
      role="button"
      aria-label="Enter a 1v1 Pick Battle"
    >
      {/* Container is 4:3 to match the source banner art (1448×1086).
          object-cover gives a perfect edge-to-edge fill with no
          letterboxing or cropping. */}
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
