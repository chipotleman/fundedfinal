import TopNavbar from '../components/TopNavbar';

export default function Rules() {
  return (
    <div className="bg-black min-h-screen text-green-300 font-mono">
      <TopNavbar />
      <div className="pt-24 px-6 max-w-4xl mx-auto text-left space-y-4">
        <h1 className="text-3xl font-bold text-[#4fe870]">How It Works</h1>
        <ol className="list-decimal list-inside space-y-2 text-lg">
          <li>Start with a funded virtual bankroll.</li>
          <li>Place bets using real-time odds across different leagues.</li>
          <li>Build parlays or place single bets—track your growth.</li>
          <li>Reach the challenge goal to unlock real-world funding.</li>
        </ol>
      </div>
    </div>
  );
}
