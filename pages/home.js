import { useState } from 'react';
import TopNavbar from '../components/TopNavbar';

export default function Home() {
  const [bankroll] = useState(1000); // placeholder
  const [betCount] = useState(0); // placeholder

  return (
    <div className="bg-black text-white min-h-screen">
      <TopNavbar bankroll={bankroll} betCount={betCount} />
      <div className="pt-[100px] px-6">
        <h1 className="text-3xl text-green-400 font-bold mb-4">Welcome to Rollr</h1>
        <p className="text-green-200 text-lg mb-6">
          Take the challenge to get funded. Test your betting skills without risking real money.
        </p>
        <ul className="list-disc list-inside text-green-300 space-y-2">
          <li>Join the challenge with virtual cash.</li>
          <li>Make smart bets and grow your balance.</li>
          <li>Hit the funding goal and earn real cash prizes.</li>
        </ul>
      </div>
    </div>
  );
}
