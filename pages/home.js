import TopNavbar from '../components/TopNavbar';

export default function Home() {
  return (
    <div className="bg-black text-white min-h-screen">
      <TopNavbar />
      <section className="px-6 py-12 text-center">
        <h1 className="text-4xl font-extrabold text-[#4fe870] mb-4">Do You Have What It Takes?</h1>
        <p className="text-lg text-zinc-400 mb-10">
          Welcome to the ultimate betting challenge. Climb the ladder, grow your bankroll, and prove you're the best.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {[
            { title: '1. Get Funded', desc: 'Start with a free bankroll and no risk.' },
            { title: '2. Bet Smart', desc: 'Use real-time odds and pick winners.' },
            { title: '3. Get Paid', desc: 'Reach the target and cash out real rewards.' },
          ].map((step, i) => (
            <div key={i} className="border border-zinc-700 rounded-lg p-6 bg-zinc-900 hover:bg-zinc-800 transition">
              <h2 className="text-xl text-[#4fe870] font-bold mb-2">{step.title}</h2>
              <p className="text-zinc-400 text-sm">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
