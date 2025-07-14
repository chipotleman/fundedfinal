import TopNavbar from '../components/TopNavbar';

export default function Rules() {
  return (
    <div className="bg-black text-green-300 min-h-screen font-mono">
      <TopNavbar />
      <div className="pt-24 px-6 max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-[#4fe870] mb-6">How It Works</h1>
        <ol className="list-decimal list-inside space-y-4 text-lg">
          <li>Start with a funded virtual bankroll.</li>
          <li>Place bets using real-time odds across different leagues.</li>
          <li>Build parlays or place single bets — track your growth.</li>
          <li>Reach the challenge goal to unlock real-world funding.</li>
        </ol>
      </div>
    </div>
  );
}
