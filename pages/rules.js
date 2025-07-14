import TopNavbar from '../components/TopNavbar';

export default function Rules() {
  return (
    <div className="bg-black text-white min-h-screen">
      <TopNavbar />
      <section className="px-6 py-12 max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-[#4fe870] mb-6">Challenge Rules</h1>
        <ul className="space-y-4 list-disc list-inside text-zinc-300 text-sm">
          <li>Start with a funded bankroll (e.g. $1,000).</li>
          <li>Only parlay bets are allowed to maximize edge.</li>
          <li>Reach $2,500 to complete the challenge.</li>
          <li>Dropping below $500 results in disqualification.</li>
          <li>No rebuys, no resets. One shot. Real skill.</li>
          <li>Once funded, you're eligible for real money payouts.</li>
        </ul>
      </section>
    </div>
  );
}
