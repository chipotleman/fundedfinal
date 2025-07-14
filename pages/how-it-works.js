import { useState } from 'react';
import TopNavbar from '../components/TopNavbar';

export default function HowItWorks() {
  const [bankroll] = useState(1000); // placeholder
  const [betCount] = useState(0); // placeholder

  const steps = [
    {
      title: "1. Join the Challenge",
      description: "Start with $1,000 in virtual funds and take your shot at getting funded.",
    },
    {
      title: "2. Make Bets",
      description: "Pick moneyline bets across your favorite sports — only one team per matchup.",
    },
    {
      title: "3. Track Your Progress",
      description: "Your bets impact your challenge progress. Climb from $1,000 to $2,500.",
    },
    {
      title: "4. Get Funded",
      description: "Hit the goal, prove your skill, and get rewarded — real payouts, real bragging rights.",
    },
  ];

  return (
    <div className="bg-black text-white min-h-screen">
      <TopNavbar bankroll={bankroll} betCount={betCount} />
      <div className="pt-[100px] px-6 max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-green-400 mb-8 text-center">How It Works</h1>

        <div className="space-y-8">
          {steps.map((step, index) => (
            <div key={index} className="border-l-4 border-green-400 pl-4">
              <h2 className="text-2xl font-semibold text-green-300">{step.title}</h2>
              <p className="text-green-200 mt-1">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
