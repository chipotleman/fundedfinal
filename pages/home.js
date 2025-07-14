import TopNavbar from '../components/TopNavbar';

export default function Home({ bankroll = 0, selectedBets = [] }) {
  return (
    <div className="bg-black text-white min-h-screen font-mono">
      <TopNavbar bankroll={bankroll} selectedBets={selectedBets} />
      <div className="pt-[80px] px-4">
        <h1 className="text-3xl font-bold text-green-400 mb-4">Welcome to Funded Final</h1>
        <p className="text-zinc-300 mb-4">
          Compete in betting challenges with real odds, simulated money, and climb your way to becoming a funded bettor. Track your performance, challenge friends, and earn the right to play with real house money.
        </p>
        <div className="grid sm:grid-cols-2 gap-6 mt-8">
          <div className="bg-zinc-900 p-4 rounded-lg border border-zinc-700">
            <h2 className="text-xl text-green-300 font-semibold mb-2">Start a Challenge</h2>
            <p className="text-zinc-400">Choose your league, place bets, and try to reach the goal to get funded.</p>
          </div>
          <div className="bg-zinc-900 p-4 rounded-lg border border-zinc-700">
            <h2 className="text-xl text-green-300 font-semibold mb-2">Track Progress</h2>
            <p className="text-zinc-400">See your bankroll grow or shrink with every bet. Make smart picks and manage your risk.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
