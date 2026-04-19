import TopNavbar from '../components/TopNavbar';
import Footer from '../components/Footer';

export default function Pikking101() {

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#000000' }}>
      <TopNavbar />
      <div className="px-4 sm:px-6 lg:px-8 py-8 pt-24">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold mb-8" style={{ color: '#ffffff' }}>
            Pikking 101
          </h1>
          
          <div className="space-y-6" style={{ color: '#d1d5db' }}>
            <p>
              Welcome to Piks! This guide will help you understand how to make picks and compete in challenges.
            </p>

            <section>
              <h2 className="text-xl font-semibold mb-3" style={{ color: '#ffffff' }}>
                Understanding Odds
              </h2>
              <p className="mb-3">American odds show how much you can win on a bet:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Positive odds (+150):</strong> How much you win on a $100 bet. +150 means win $150 on $100.</li>
                <li><strong>Negative odds (-150):</strong> How much you need to bet to win $100. -150 means bet $150 to win $100.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3" style={{ color: '#ffffff' }}>
                Types of Bets
              </h2>
              
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2" style={{ color: '#ffffff' }}>Moneyline</h3>
                  <p>Pick the team to win the game outright. The simplest bet type.</p>
                </div>

                <div>
                  <h3 className="font-semibold mb-2" style={{ color: '#ffffff' }}>Spread</h3>
                  <p>Pick a team to win by more than (or lose by less than) a certain number of points. Example: Lakers -5.5 means they must win by 6+ points.</p>
                </div>

                <div>
                  <h3 className="font-semibold mb-2" style={{ color: '#ffffff' }}>Totals (Over/Under)</h3>
                  <p>Pick whether the combined score of both teams will be over or under a set number.</p>
                </div>

                <div>
                  <h3 className="font-semibold mb-2" style={{ color: '#ffffff' }}>Parlays</h3>
                  <p>Combine multiple picks into one bet for higher payouts. All picks must win for the parlay to pay out.</p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3" style={{ color: '#ffffff' }}>
                How Challenges Work
              </h2>
              <ol className="list-decimal pl-6 space-y-2">
                <li><strong>Choose a Tier:</strong> Starter ($5k), Pro ($10k), or Elite ($25k) funded account</li>
                <li><strong>Phase 1:</strong> Hit the 20% profit target while following the rules</li>
                <li><strong>Phase 2:</strong> Prove consistency by hitting another 20% profit target</li>
                <li><strong>Reward Phase:</strong> Trade with real money and keep 90% of your profits!</li>
              </ol>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3" style={{ color: '#ffffff' }}>
                1v1 Battles
              </h2>
              <p>
                Compete head-to-head against another user. Both players put up a stake, and the winner takes 90% of the combined pot. Your opponent's picks are hidden until you place yours.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3" style={{ color: '#ffffff' }}>
                Pik Pools
              </h2>
              <p>
                Join multi-player competitions with 5-25 players. Everyone pays a buy-in, and the top performer wins 90% of the prize pool. Great for testing your skills against the crowd!
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3" style={{ color: '#ffffff' }}>
                Tips for Success
              </h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>Start with the Demo to practice without risk</li>
                <li>Manage your bankroll - never risk more than 5% on a single pick</li>
                <li>Do your research before making picks</li>
                <li>Stay disciplined and stick to your strategy</li>
                <li>Don't chase losses - tomorrow is a new day</li>
              </ul>
            </section>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
