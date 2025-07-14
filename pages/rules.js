import { useState } from 'react';
import TopNavbar from '../components/TopNavbar';

export default function Rules() {
  const [bankroll] = useState(1000); // placeholder
  const [betCount] = useState(0); // placeholder

  return (
    <div className="bg-black text-white min-h-screen">
      <TopNavbar bankroll={bankroll} betCount={betCount} />
      <div className="pt-[100px] px-6">
        <h1 className="text-3xl text-green-400 font-bold mb-4">Challenge Rules</h1>
        <ol className="list-decimal list-inside text-green-300 space-y-2">
          <li>Start with $1,000 in virtual funds.</li>
          <li>Only moneyline bets are allowed.</li>
          <li>Reach $2,500 to complete the challenge.</li>
          <li>No real money involved—pure skill.</li>
          <li>Only one side per game can be selected.</li>
          <li>If your balance hits $0, you're out.</li>
        </ol>
      </div>
    </div>
  );
}
