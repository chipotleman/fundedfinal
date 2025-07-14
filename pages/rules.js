import TopNavbar from '../components/TopNavbar';

export default function Rules() {
  return (
    <>
      <TopNavbar />
      <div className="pt-24 px-6 sm:px-12 text-green-300 font-mono max-w-3xl mx-auto">
        <h1 className="text-3xl sm:text-5xl font-bold mb-6">📜 Rules of the Challenge</h1>

        <ol className="list-decimal ml-6 space-y-4 text-lg">
          <li>
            Start with a funded bankroll (e.g., $1,000) — this is your challenge capital.
          </li>
          <li>
            Bet using real-time odds from the daily game slate.
          </li>
          <li>
            Reach the goal (e.g., $2,500) without violating risk parameters.
          </li>
          <li>
            No overbetting — stay within your daily loss limits and wager sizing.
          </li>
          <li>
            Once funded, you’ll be able to bet with real payouts based on performance.
          </li>
        </ol>

        <div className="mt-10 text-sm text-gray-400">
          Subject to verification and fair play checks.
        </div>
      </div>
    </>
  );
}
