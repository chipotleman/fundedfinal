// pages/how-it-works.js
import React from "react";

const HowItWorks = ({ selectedBets = [], bankroll = 1000 }) => {
  return (
    <div className="min-h-screen bg-black text-white pt-24 px-6 sm:px-12 lg:px-32 space-y-16">
      {/* Hero Section */}
      <section className="text-center space-y-4">
        <h1 className="text-4xl sm:text-5xl font-extrabold neon-text">
          Bet Smarter. Risk Nothing. Get Paid.
        </h1>
        <p className="text-lg sm:text-xl text-gray-300 max-w-3xl mx-auto">
          This isn’t a sportsbook. It’s a skill-based challenge where your bets are virtual, but your rewards are real.
        </p>
        <p className="text-md sm:text-lg text-green-400 mt-2 font-semibold">
          Place virtual bets. Climb the challenge. Earn real payouts.
        </p>
      </section>

      {/* Step-by-Step Section */}
      <section className="space-y-10">
        <h2 className="text-3xl font-bold neon-text text-center">How It Works</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            {
              title: "Pick Your Challenge",
              description: "Start with a goal like turning 100 into 1,000 in 30 bets. No real money needed to begin.",
            },
            {
              title: "Place Your Bets",
              description: "Use live odds from real sportsbooks. Every pick counts. Stay disciplined, stay sharp.",
            },
            {
              title: "Beat the Challenge",
              description: "Hit your profit target while managing risk. Miss? Restart and run it back — no penalty.",
            },
            {
              title: "Get Paid",
              description: "Finish the challenge, and we’ll send you a real payout. No catch, just performance.",
            },
          ].map((step, idx) => (
            <div
              key={idx}
              className="bg-gray-900 rounded-2xl p-6 text-center shadow-xl border border-gray-700 hover:border-green-500 transition-all"
            >
              <h3 className="text-xl font-bold mb-2 neon-text">{step.title}</h3>
              <p className="text-sm text-gray-300">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Challenge Tiers Section */}
      <section className="space-y-6">
        <h2 className="text-3xl font-bold text-center neon-text">Challenge Tiers</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { tier: "Tier 1", goal: "$100 → $300", payout: "$20" },
            { tier: "Tier 2", goal: "$250 → $750", payout: "$50" },
            { tier: "Tier 3", goal: "$500 → $1,500", payout: "$120" },
            { tier: "Tier 4+", goal: "Bigger Goals", payout: "Bigger Payouts" },
          ].map((t, idx) => (
            <div
              key={idx}
              className="bg-gray-900 rounded-2xl p-6 text-center border border-purple-700 hover:border-yellow-400 shadow-lg"
            >
              <h4 className="text-xl font-bold neon-text mb-2">{t.tier}</h4>
              <p className="text-md text-gray-300">{t.goal}</p>
              <p className="text-lg text-green-400 font-semibold mt-2">{t.payout}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Comparison Section */}
      <section className="space-y-6">
        <h2 className="text-3xl font-bold text-center neon-text">Why We're Different</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-gray-800 rounded-2xl p-6 border border-green-600">
            <h3 className="text-xl font-bold mb-3 text-green-400">Us</h3>
            <ul className="list-disc list-inside space-y-2 text-sm text-gray-200">
              <li>No risk to start</li>
              <li>We fund your challenge</li>
              <li>Real odds, real rewards</li>
              <li>Performance-based payouts</li>
              <li>Gamified & challenge-driven</li>
            </ul>
          </div>
          <div className="bg-gray-800 rounded-2xl p-6 border border-red-600">
            <h3 className="text-xl font-bold mb-3 text-red-400">Traditional Sportsbook</h3>
            <ul className="list-disc list-inside space-y-2 text-sm text-gray-200">
              <li>Your money at risk</li>
              <li>No challenge or structure</li>
              <li>Traps with bonuses & rollover</li>
              <li>House always wins long-term</li>
              <li>No reward for discipline</li>
            </ul>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="space-y-6">
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
