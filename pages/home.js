import TopNavbar from '../components/TopNavbar';

export default function Home() {
  return (
    <div className="bg-black text-white min-h-screen">
      <TopNavbar />
      <div className="pt-16 px-6">
        <h1 className="text-3xl font-bold text-[#4fe870] mb-4">Welcome to Rollr</h1>
        <p className="text-green-300">
          This is your entry point. Take the challenge and show your betting skill. Navigate to Dashboard to start placing your bets.
        </p>
      </div>
    </div>
  );
}
