import TopNavbar from '../components/TopNavbar';

export default function Home() {
  return (
    <>
      <TopNavbar />
      <div className="pt-24 px-6 sm:px-12 text-green-300 font-mono">
        <h1 className="text-3xl sm:text-5xl font-bold mb-4">Welcome to Rollr</h1>
        <p className="text-lg sm:text-xl">
          Take the challenge. Bet smart. Get funded. This is where real betting skill gets rewarded.
        </p>
        <div className="mt-10 space-y-4">
          <div className="bg-zinc-900 p-6 rounded-lg border border-green-400 shadow">
            <h2 className="text-xl font-semibold mb-2">🔥 What is Rollr?</h2>
            <p>
              A funded sports betting challenge — prove your edge, grow your bankroll, and get paid.
            </p>
          </div>
          <div className="bg-zinc-900 p-6 rounded-lg border border-green-400 shadow">
            <h2 className="text-xl font-semibold mb-2">🎯 Why Join?</h2>
            <ul className="list-disc ml-5 space-y-1">
              <li>No risk to start</li>
              <li>Real-time odds</li>
              <li>Withdrawable profits when you complete a challenge</li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
