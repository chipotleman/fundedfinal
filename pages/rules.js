import TopNavbar from '../components/TopNavbar';
import Footer from '../components/Footer';
import { useBetSlip } from '../contexts/BetSlipContext';

export default function HouseRules() {
  const { betSlip, showBetSlip, setShowBetSlip } = useBetSlip();

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#000000' }}>
      <TopNavbar
        betSlipCount={betSlip.length}
        onBetSlipClick={() => setShowBetSlip(!showBetSlip)}
      />
      <div className="px-4 sm:px-6 lg:px-8 py-8 pt-24">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold mb-8" style={{ color: '#ffffff' }}>
            House Rules
          </h1>
          
          <div className="space-y-6" style={{ color: '#d1d5db' }}>
            <section>
              <h2 className="text-xl font-semibold mb-3" style={{ color: '#ffffff' }}>
                1. Challenge Requirements
              </h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>Minimum of 20 picks required per challenge phase</li>
                <li>Risk between 1-5% of your bankroll per pick</li>
                <li>Maximum daily loss limit: 10%</li>
                <li>Maximum drawdown limit: 15%</li>
                <li>Profit target: 20% (Phase 1 & Phase 2)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3" style={{ color: '#ffffff' }}>
                2. Betting Rules
              </h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>Same-game parlays are allowed</li>
                <li>10% fee applies to pick cashouts</li>
                <li>All picks must be placed before game start time</li>
                <li>Odds must be -300 or longer (no heavy favorites)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3" style={{ color: '#ffffff' }}>
                3. Account Rules
              </h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>One account per person</li>
                <li>Users must be 21 years or older</li>
                <li>Account sharing is prohibited</li>
                <li>Any form of cheating or manipulation will result in immediate disqualification</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3" style={{ color: '#ffffff' }}>
                4. Payouts
              </h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>90% profit split in Reward phase</li>
                <li>Withdrawals processed within 5-7 business days</li>
                <li>Minimum withdrawal amount: $50</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-3" style={{ color: '#ffffff' }}>
                5. 1v1 Battles & Pik Pools
              </h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>Winner takes 90% of the combined prize pot</li>
                <li>Users can only participate in one active challenge at a time</li>
                <li>Opponent bets remain hidden until you place your own</li>
              </ul>
            </section>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
