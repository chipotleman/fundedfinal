import TopNavBar from '../components/TopNavBar';

export default function Rules() {
  const steps = [
    { title: '1. Start With a Free Bankroll', text: 'No risk. We fund you to begin betting.', emoji: '💰' },
    { title: '2. Build Your PNL', text: 'Prove you can profit by hitting targets.', emoji: '📈' },
    { title: '3. Get Funded', text: 'Hit the goal? We’ll bankroll you for real.', emoji: '🚀' },
  ];

  return (
    <div className="bg-black text-white min-h-screen font-mono">
      <TopNavBar />
      <div className="p-8">
        <h1 className="text-4xl text-green-400 font-bold mb-6">How It Works</h1>
        <div className="grid md:grid-cols-3 gap-6">
          {steps.map((step, idx) => (
            <div key={idx} className="bg-zinc-900 border border-green-400 rounded-lg p-6 text-center animate-fade-in">
              <div className="text-5xl mb-2">{step.emoji}</div>
              <h2 className="text-xl font-bold text-green-300">{step.title}</h2>
              <p className="text-gray-300 mt-2">{step.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
