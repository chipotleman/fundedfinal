import TopNavbar from '../components/TopNavbar';

export default function Rules({ bankroll = 0, selectedBets = [] }) {
  return (
    <div className="bg-black text-white min-h-screen font-mono">
      <TopNavbar bankroll={bankroll} selectedBets={selectedBets} />
      <div className="pt-[80px] px-4">
        <h1 className="text-3xl font-bold text-green-400 mb-4">Official Rules</h1>
        <ul className="list-disc list-inside text-zinc-300 space-y-2">
          <li>Start with a simulated bankroll of $1,000.</li>
          <li>Use real market odds to place parlay or straight bets.</li>
          <li>Reach $2,500 to pass the challenge and get funded.</li>
          <li>Dropping below $500 ends the challenge.</li>
          <li>No rebuys. One shot per challenge.</li>
          <li>Bets must be placed before the game starts.</li>
          <li>Void or canceled games are refunded to bankroll.</li>
        </ul>
      </div>
    </div>
  );
}
