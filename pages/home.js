import TopNavBar from '../components/TopNavBar';
import Image from 'next/image';
import Link from 'next/link';

export default function Home() {
  return (
    <div className="bg-black text-white min-h-screen font-mono">
      <TopNavBar />

      {/* Hero Section */}
      <div className="flex flex-col items-center justify-center text-center px-6 py-20 bg-[url('/banner2.jpg')] bg-cover bg-center">
        <h1 className="text-5xl sm:text-6xl font-extrabold text-green-400 drop-shadow-lg mb-4 animate-fade-in">
          TAKE THE CHALLENGE TO GET FUNDED
        </h1>
        <p className="text-xl sm:text-2xl text-gray-200 max-w-2xl mb-6 animate-fade-in">
          Bet with no risk. Prove your skills. Get a real bankroll.
        </p>
        <Link href="/dashboard">
          <button className="bg-green-400 hover:bg-green-500 text-black font-bold px-8 py-3 rounded-lg text-lg transition animate-fade-in">
            Enter the Sportsbook
          </button>
        </Link>
      </div>

      {/* How It Works Preview */}
      <div className="px-8 py-16">
        <h2 className="text-3xl text-green-400 font-bold mb-6 text-center">How It Works</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { title: 'Start Free', text: 'We fund your account to start.', emoji: '🎁' },
            { title: 'Hit Targets', text: 'Climb the challenge to get funded.', emoji: '📊' },
            { title: 'Win Real Cash', text: 'Profit? We back you with real funds.', emoji: '💵' }
          ].map((step, i) => (
            <div key={i} className="bg-zinc-900 border border-green-400 rounded-lg p-6 text-center animate-fade-in">
              <div className="text-5xl mb-2">{step.emoji}</div>
              <h3 className="text-xl font-bold text-green-300">{step.title}</h3>
              <p className="text-gray-300 mt-2">{step.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
