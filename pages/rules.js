import TopNavbar from '../components/TopNavbar';

export default function Rules() {
  return (
    <div className="bg-black text-white min-h-screen">
      <TopNavbar />
      <div className="pt-16 px-6">
        <h1 className="text-3xl font-bold text-[#4fe870] mb-4">How It Works</h1>
        <ol className="list-decimal list-inside text-green-300 space-y-2">
          <li>Sign up and start with $1,000 virtual bankroll.</li>
          <li>Place real-odds bets using your bankroll.</li>
          <li>Reach $2,500 and you’ll be funded with real money.</li>
          <li>Stay sharp — if you lose the bankroll, you’re out.</li>
        </ol>
      </div>
    </div>
  );
}
