import TopNavbar from '../components/TopNavbar';

export default function HowItWorks({ bankroll = 0, selectedBets = [] }) {
  return (
    <div className="bg-black text-white min-h-screen font-mono">
      <TopNavbar bankroll={bankroll} selectedBets={selectedBets} />
      <div className="pt-[80px] px-4">
        <h1 className="text-3xl font-bold text-green-400 mb-6">How It Works</h1>
        <div className="grid sm:grid-cols-3 gap-6">
          <div className="bg-zinc-900 p-4 rounded-lg border border-zinc-700">
            <h2 className="text-xl font-semibold text-green-300 mb-2">1. Join the Challenge</h2>
            <p className="text-zinc-400">Start with $1,000 virtual bankroll. You’re competing to prove you can bet smart.</p>
          </div>
          <div className="bg-zinc-900 p-4 rounded-lg border border-zinc-700">
            <h2 className="text-xl font-semibold text-green-300 mb-2">2. Place Bets</h2>
            <p className="text-zinc-400">Use real odds from our sportsbook feed. Pick winners, build parlays, and grow your stack.</p>
          </div>
          <div className="bg-zinc-900 p-4 rounded-lg border border-zinc-700">
            <h2 className="text-xl font-semibold text-green-300 mb-2">3. Get Funded</h2>
            <p className="text-zinc-400">Reach $2,500 without busting. Pass the test and we fund you with real money betting capital.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
