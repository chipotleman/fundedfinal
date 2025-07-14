import TopNavbar from '../components/TopNavbar';

export default function Home() {
  return (
    <div className="bg-black min-h-screen text-green-300 font-mono">
      <TopNavbar />
      <div className="pt-24 px-6 max-w-4xl mx-auto text-center">
        <h1 className="text-4xl font-bold text-[#4fe870] mb-6">Do You Have What It Takes?</h1>
        <p className="text-lg mb-4">
          Welcome to Rollr. Compete in our challenge and get funded based on your betting skills. Make picks, build parlays, and track your progress.
        </p>
      </div>
    </div>
  );
}
