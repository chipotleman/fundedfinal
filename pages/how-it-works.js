// pages/how-it-works.js
import React from "react";

const HowItWorks = ({ selectedBets = [], bankroll = 1000 }) => {
  return (
    <div className="min-h-screen bg-black text-white pt-24 px-6 sm:px-12 lg:px-32 space-y-16">
      {/* Hero */}
      <section className="text-center space-y-4">
        <h1 className="text-4xl sm:text-5xl font-extrabold neon-text">
          Win Challenges. Get Paid. No Risk.
        </h1>
        <p className="text-lg sm:text-xl text-gray-300 max-w-3xl mx-auto">
          Virtual bets. Real rewards. Hit your targets, climb the ladder, and unlock payouts.
        </p>
      </section>

      {/* Progress Simulation Bar */}
      <section className="bg-gray-900 rounded-xl p-6 border border-green-500">
        <h2 className="text-2xl font-bold mb-4 neon-text">Challenge Progress</h2>
        <div className="space-y-4">
          <p className="text-sm text-gray-300">Current Challenge: Turn $100 into $300</p>
          <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden">
            <div className="bg-green-400 h-full rounded-full animate-pulse" style={{ width: "35%" }}></div>
          </div>
          <p className="text-sm text-green-400">Progress: $135 / $300</p>
          <ul className="text-sm text-gray-400 mt-3 list-disc list-inside">
            <li>🔥 +10% payout if completed in under 20 bets</li>
            <li>💎 Bonus for completing 3+ challenges in a row</li>
            <li>⚡ XP Boost if you win 5 straight</li>
          </ul>
        </div>
      </section>

      {/* Challenge Tiers */}
      <section className="space-y-6">
        <h2 className="text-3xl font-bold text-center neon-text">Challenge Tiers</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { tier: "Tier 1", goal: "$100 → $300", payout: "$20", progress: 25 },
            { tier: "Tier 2", goal: "$250 → $750", payout: "$50", progress: 0 },
            { tier: "Tier 3", goal: "$500 → $1,500", payout: "$120", progress: 0 },
            { tier: "Tier 4+", goal: "High Stakes", payout: "Custom", progress: 0 },
          ].map((t, idx) => (
            <div
              key={idx}
              className="bg-gray-900 rounded-2xl p-6 border border-purple-700 hover:border-yellow-400 shadow-lg"
            >
              <h4 className="text-xl font-bold neon-text mb-1">{t.tier}</h4>
              <p className="text-sm text-gray-300">{t.goal}</p>
              <div className="w-full bg-gray-700 rounded-full h-3 my-3 overflow-hidden">
                <div
                  className="bg-yellow-400 h-full rounded-full"
                  style={{ width: `${t.progress}%` }}
                ></div>
              </div>
              <p className="text-green-400 font-semibold">{t.payout}</p>
              <p className="text-xs text-gray-400 mt-2">🎯 Bonus if completed in <strong>under 20 bets</strong></p>
            </div>
          ))}
        </div>
      </section>

      {/* Boosts Section */}
      <section className="space-y-6">
        <h2 className="text-3xl font-bold text-center neon-text">Boost Bonuses</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            {
              title: "🔥 Streak Bonus",
              desc: "Hit 5 wins in a row and earn +10% payout on your challenge.",
            },
            {
              title: "⚡ Fast Track",
              desc: "Complete your challenge in under 20 bets for a boost payout.",
            },
            {
              title: "💎 Perfect Run",
              desc: "Go undefeated? You’ll unlock a special tier payout bonus.",
            },
          ].map((boost, idx) => (
            <div
              key={idx}
              className="bg-gray-900 border border-blue-600 rounded-2xl p-5 text-center hover:border-green-400 transition-all"
            >
              <h3 className="text-lg font-bold neon-text mb-2">{boost.title}</h3>
              <p className="text-sm text-gray-300">{boost.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="space-y-6 pb-24">
        <h2 className="text-3xl font-bold text-center neon-text">Frequently Asked Questions</h2>
        <div className="space-y-4 max-w-3xl mx-auto">
          {[
            {
              q: "Is this gambling?",
              a: "No. You’re not risking any real money. This is a skill-based challenge where performance earns payouts.",
            },
            {
              q: "Do I have to deposit?",
              a: "Nope. You can start a challenge without spending a dollar.",
            },
            {
              q: "What happens if I fail a challenge?",
              a: "Nothing. You can restart the challenge at any time — there are no fees or punishments.",
            },
            {
              q: "How do I get paid?",
              a: "Once you complete a challenge, we’ll send your payout via your preferred method — Venmo, PayPal, etc.",
            },
            {
              q: "Are the odds real?",
              a: "Yes. All odds are pulled from live sportsbooks. It’s just like placing a real bet, minus the risk.",
            },
          ].map((item, idx) => (
            <details key={idx} className="bg-gray-900 p-4 rounded-xl border border-gray-700 hover:border-blue-500 transition-all">
              <summary className="font-semibold text-white cursor-pointer">{item.q}</summary>
              <p className="mt-2 text-gray-300 text-sm">{item.a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
};

export default HowItWorks;
