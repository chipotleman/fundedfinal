import { useRouter } from 'next/router';
import haptic from '../utils/haptics';

// Dashboard promo container for the Beta Challenge — "Most points at the
// end of beta wins $1,000". The artwork is a single branded banner so the
// carousel slot displays the designed image exactly as authored. Tapping
// it routes to the leaderboard where users can see live standings.
export default function BetaChallengeContainer() {
  const router = useRouter();

  const handleClick = () => {
    haptic.tap();
    router.push('/leaderboard');
  };

  return (
    <div
      className="w-[187px] md:w-[240px] flex-shrink-0 rounded-2xl overflow-hidden cursor-pointer transition-transform duration-200 relative h-[140px] md:h-[180px] hover:scale-[1.02] active:scale-[0.98]"
      style={{ backgroundColor: '#000' }}
      onClick={handleClick}
      role="button"
      aria-label="Beta Challenge — top score wins $1,000. View the leaderboard."
    >
      {/* Source artwork is 4:3 (1024×768) so object-cover gives an
          edge-to-edge fill with no letterboxing. */}
      <img
        src="/promos/beta-challenge.png"
        alt="Beta Challenge — most points at the end wins $1,000"
        className="absolute inset-0 w-full h-full object-cover object-center select-none pointer-events-none"
        draggable={false}
        loading="lazy"
      />
    </div>
  );
}
